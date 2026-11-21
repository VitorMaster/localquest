/* Localquest — leitura de slides: PPTX (texto + imagens por slide) e PDF (texto + imagem da página). */
(function () {
  const Q = window.Q;
  const Ingest = (Q.Ingest = {});
  const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp' };

  const parseXml = (s) => new DOMParser().parseFromString(s, 'application/xml');
  const byLocal = (root, name) => Array.from(root.getElementsByTagNameNS('*', name));
  const dirname = (p) => p.slice(0, p.lastIndexOf('/'));
  const resolvePath = (base, target) => {
    if (target.startsWith('/')) return target.slice(1);
    const parts = (dirname(base) + '/' + target).split('/');
    const out = [];
    parts.forEach((p) => (p === '..' ? out.pop() : p !== '.' && out.push(p)));
    return out.join('/');
  };
  const cleanText = (s) => s.replace(/\s+/g, ' ').trim();

  Ingest.accepts = (file) => /\.(pptx|pdf)$/i.test(file.name);

  /* ================= PPTX ================= */
  async function parsePPTX(file, progress) {
    if (!window.JSZip) throw new Error('Biblioteca JSZip não carregou.');
    const zip = await JSZip.loadAsync(file);
    const read = async (p) => {
      const f = zip.file(p);
      return f ? f.async('string') : null;
    };

    // ordem real dos slides
    const pres = parseXml(await read('ppt/presentation.xml'));
    const presRels = parseXml(await read('ppt/_rels/presentation.xml.rels'));
    const relMap = {};
    byLocal(presRels, 'Relationship').forEach((r) => (relMap[r.getAttribute('Id')] = r.getAttribute('Target')));
    const slidePaths = byLocal(pres, 'sldId')
      .map((s) => relMap[s.getAttributeNS(NS_R, 'id')])
      .filter(Boolean)
      .map((t) => resolvePath('ppt/presentation.xml', t));
    if (!slidePaths.length) throw new Error('Nenhum slide encontrado no arquivo.');

    const raw = [];
    const mediaUse = new Map(); // caminho da mídia → nº de slides em que aparece
    for (let i = 0; i < slidePaths.length; i++) {
      progress && progress(i / slidePaths.length, `Lendo slide ${i + 1} de ${slidePaths.length}…`);
      const sp = slidePaths[i];
      const doc = parseXml(await read(sp));
      const relsXml = await read(dirname(sp) + '/_rels/' + sp.split('/').pop() + '.rels');
      const rels = {};
      if (relsXml) byLocal(parseXml(relsXml), 'Relationship').forEach((r) => (rels[r.getAttribute('Id')] = r.getAttribute('Target')));

      // título = placeholder title/ctrTitle
      const shapes = byLocal(doc, 'sp');
      const phType = (sh) => {
        const ph = byLocal(sh, 'ph')[0];
        return ph ? ph.getAttribute('type') || 'body' : null;
      };
      const skip = new Set(['sldNum', 'ftr', 'dt']);
      const titleSp = shapes.find((sh) => ['title', 'ctrTitle'].includes(phType(sh)));
      const skipSps = shapes.filter((sh) => skip.has(phType(sh)));
      const title = titleSp ? cleanText(byLocal(titleSp, 't').map((t) => t.textContent).join(' ')) : '';
      const lines = [];
      byLocal(doc, 'p').forEach((p) => {
        if (titleSp && titleSp.contains(p)) return;
        if (skipSps.some((sh) => sh.contains(p))) return;
        const t = cleanText(byLocal(p, 't').map((x) => x.textContent).join(''));
        if (t) lines.push(t);
      });

      // imagens (ignora fundo do slide)
      const bg = byLocal(doc, 'bg')[0];
      const imgs = [];
      const seen = new Set();
      byLocal(doc, 'blip').forEach((b) => {
        if (bg && bg.contains(b)) return;
        const rid = b.getAttributeNS(NS_R, 'embed');
        if (!rid || !rels[rid]) return;
        const path = resolvePath(sp, rels[rid]);
        if (seen.has(path)) return;
        seen.add(path);
        let alt = '';
        let pic = b.parentNode;
        while (pic && pic.localName !== 'pic' && pic.localName !== 'sp') pic = pic.parentNode;
        if (pic) {
          const c = byLocal(pic, 'cNvPr')[0];
          alt = c ? c.getAttribute('descr') || '' : '';
        }
        imgs.push({ path, alt });
        mediaUse.set(path, (mediaUse.get(path) || 0) + 1);
      });
      raw.push({ n: i + 1, title, lines, imgs });
    }

    // descarta logos/decoração que se repetem em muitos slides
    const decor = new Set();
    if (raw.length >= 4) mediaUse.forEach((c, p) => c / raw.length > 0.5 && decor.add(p));

    const topics = [];
    let skipped = 0;
    for (let i = 0; i < raw.length; i++) {
      progress && progress(i / raw.length, `Extraindo imagens do slide ${i + 1}…`);
      const r = raw[i];
      const images = [];
      for (const im of r.imgs) {
        if (decor.has(im.path)) continue;
        const ext = (im.path.split('.').pop() || '').toLowerCase();
        if (!MIME[ext]) {
          skipped++;
          continue; // emf/wmf/tiff não renderizam no navegador
        }
        const f = zip.file(im.path);
        if (!f) continue;
        const data = await f.async('uint8array');
        if (data.length < 3000) continue; // ícones/marcadores
        const id = Q.uid('img');
        await Q.Store.putImage(id, new Blob([data], { type: MIME[ext] }));
        images.push({ id, alt: cleanText(im.alt), kind: 'fig' });
      }
      const text = r.lines.join('\n');
      const ttl = r.title || (r.lines[0] ? r.lines[0].slice(0, 70) : `Slide ${r.n}`);
      topics.push({ id: Q.uid('tp'), n: r.n, title: ttl, text, images, ignored: text.length < 30 && !images.length });
    }
    return { topics, skipped, kind: 'pptx' };
  }

  /* ================= PDF ================= */
  async function parsePDF(file, progress) {
    if (!window.pdfjsLib) throw new Error('Biblioteca PDF.js não carregou.');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const topics = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      progress && progress((p - 1) / pdf.numPages, `Lendo página ${p} de ${pdf.numPages}…`);
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      // agrupa por linha (coordenada y)
      const rows = [];
      tc.items.forEach((it) => {
        if (!it.str || !it.str.trim()) return;
        const y = it.transform[5];
        const h = Math.abs(it.transform[3]) || it.height || 0;
        let row = rows.find((r) => Math.abs(r.y - y) < Math.max(2, h * 0.4));
        if (!row) rows.push((row = { y, h: 0, parts: [] }));
        row.parts.push({ x: it.transform[4], s: it.str });
        row.h = Math.max(row.h, h);
      });
      rows.sort((a, b) => b.y - a.y);
      const lines = rows.map((r) => ({ h: r.h, t: cleanText(r.parts.sort((a, b) => a.x - b.x).map((x) => x.s).join(' ')) })).filter((l) => l.t);
      const biggest = lines.reduce((m, l) => (l.h > m ? l.h : m), 0);
      const titleLine = lines.find((l) => l.h >= biggest * 0.95) || lines[0];
      const body = lines.filter((l) => l !== titleLine).map((l) => l.t);

      // imagem da página inteira (permite usar figuras/gráficos nas questões)
      const vp0 = page.getViewport({ scale: 1 });
      const scale = Math.min(2, 1100 / vp0.width);
      const vp = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vp.width);
      canvas.height = Math.round(vp.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.82));
      const id = Q.uid('img');
      await Q.Store.putImage(id, blob);
      page.cleanup();
      const text = body.join('\n');
      topics.push({
        id: Q.uid('tp'), n: p, title: titleLine ? titleLine.t.slice(0, 90) : `Página ${p}`, text,
        images: [{ id, alt: 'Página inteira do slide', kind: 'page' }],
        ignored: text.length < 30 && !(titleLine && titleLine.t.length > 3),
      });
    }
    return { topics, skipped: 0, kind: 'pdf' };
  }

  /** Lê o arquivo e devolve { topics, skipped, kind }. */
  Ingest.parse = (file, progress) => {
    if (/\.pptx$/i.test(file.name)) return parsePPTX(file, progress);
    if (/\.pdf$/i.test(file.name)) return parsePDF(file, progress);
    if (/\.ppt$/i.test(file.name)) throw new Error('Formato .ppt antigo não é suportado. Salve como .pptx ou exporte para PDF.');
    throw new Error('Formato não suportado. Envie .pptx ou .pdf.');
  };

  /** Cria o material a partir do que foi lido. */
  Ingest.createMaterial = (meta, parsed) => {
    const m = {
      id: Q.uid('mat'), title: meta.title, curso: meta.curso, periodo: meta.periodo, materia: meta.materia,
      createdAt: Date.now(), source: parsed.kind, topics: parsed.topics,
    };
    Q.Store.state.materials.push(m);
    Q.Store.save();
    return m;
  };

  /** Adiciona uma imagem avulsa (upload) e devolve seu id. */
  Ingest.addImageFile = async (file) => {
    const id = Q.uid('img');
    await Q.Store.putImage(id, file);
    return id;
  };
})();
