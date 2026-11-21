/* Localquest — integração com o ENAMED (modo online opcional).
 * Fonte oficial: INEP (cadernos e gabaritos). O app NÃO embute nem baixa provas: você baixa o caderno e o gabarito
 * oficiais no portal do INEP e os importa aqui; a leitura é feita no seu navegador e as questões são vinculadas
 * aos temas das suas aulas por palavras em comum. Questões que dependem de figura são ignoradas. */
(function () {
  const Q = window.Q;
  const EN = (Q.Enamed = {});

  EN.OFFICIAL_URL = 'https://www.gov.br/pt-br/servicos/fazer-o-exame-nacional-de-avaliacao-da-formacao-medica';
  EN.provasUrl = () => 'https://www.google.com/search?q=' + encodeURIComponent('site:gov.br/inep enamed provas e gabaritos cadernos');
  EN.temaUrl = (tema) => 'https://www.google.com/search?q=' + encodeURIComponent('ENAMED prova questão ' + tema);
  EN.enabled = () => !!Q.Store.state.settings.enamed;
  EN.online = () => navigator.onLine !== false;

  const STOP = new Set('sobre entre quando qual quais pelo pela pelos pelas este esta esse essa estes estas aquele aquela assim ainda também apenas porque durante após antes forma maior menor segundo conforme paciente pacientes caso casos clínico clinico seguinte seguintes alternativa afirmativa correta incorreta'.split(' '));
  const tokens = (s) =>
    new Set(
      String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z]{5,}/g) || []
    );
  const NEEDS_FIGURE = /\b(figura|imagem|gr[aá]fico|tabela|radiografia|eletrocardiograma|ecg|tomografia|foto|ilustra[cç][aã]o|esquema|quadro)\b/i;

  /* ---------- leitura de texto (PDF ou TXT) ---------- */
  EN.readText = async (file) => {
    if (/\.pdf$/i.test(file.name)) {
      if (!window.pdfjsLib) throw new Error('Leitor de PDF indisponível.');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
      const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      let out = '';
      for (let p = 1; p <= pdf.numPages; p++) {
        const tc = await (await pdf.getPage(p)).getTextContent();
        const rows = [];
        tc.items.forEach((it) => {
          if (!it.str || !it.str.trim()) return;
          const y = it.transform[5];
          let r = rows.find((x) => Math.abs(x.y - y) < 3);
          if (!r) rows.push((r = { y, parts: [] }));
          r.parts.push({ x: it.transform[4], s: it.str });
        });
        rows.sort((a, b) => b.y - a.y).forEach((r) => (out += r.parts.sort((a, b) => a.x - b.x).map((x) => x.s).join(' ').replace(/\s+/g, ' ').trim() + '\n'));
        out += '\n';
      }
      return out;
    }
    return Q.readFileText(file);
  };

  /* ---------- parser do caderno ---------- */
  EN.parseCaderno = (text) => {
    const parts = String(text).split(/(?:^|\n)\s*QUEST[ÃA]O\s+(\d{1,3})\b[^\n]*\n?/gi);
    const out = [];
    for (let i = 1; i < parts.length; i += 2) {
      const n = +parts[i];
      const lines = parts[i + 1].split('\n').map((l) => l.trim()).filter((l) => l && !/^\d{1,3}$/.test(l) && !/^(enamed|inep|ministério)/i.test(l));
      const stem = [];
      const opts = [];
      let cur = -1;
      // alternativas explícitas "(A) …", "A) …", "A. …", "A - …" têm prioridade; "A texto" só se não houver nenhuma explícita
      const exp = (L) => new RegExp('^(?:\\(' + L + '\\)|' + L + '[\\)\\.\\-–:])\\s*(.*)$');
      const hasExplicit = lines.some((l) => exp('A').test(l)) && lines.some((l) => exp('B').test(l));
      lines.forEach((l) => {
        const L = 'ABCD'[opts.length];
        let m = null;
        if (L) {
          m = l.match(exp(L));
          if (!m && !hasExplicit) m = l.match(new RegExp('^' + L + '(?:\\s+(.+))?$'));
        }
        if (m) {
          opts.push((m[1] || '').trim());
          cur = opts.length - 1;
        } else if (cur >= 0) opts[cur] += (opts[cur] ? ' ' : '') + l;
        else stem.push(l);
      });
      if (opts.length === 4 && opts.every((o) => o.length > 0) && stem.join(' ').length > 15) out.push({ n, stem: stem.join(' '), options: opts });
    }
    return out;
  };

  /** Gabarito: pares "item letra" (ex.: "12 C", "12 - C", "12: C"). */
  EN.parseGabarito = (text) => {
    const map = {};
    const re = /(?:^|[\s,;])(\d{1,3})\s*[\-–:.)]*\s*([A-D])(?![A-Za-zÀ-ú])/g;
    let m;
    while ((m = re.exec(String(text)))) if (+m[1] >= 1 && +m[1] <= 200 && !(m[1] in map)) map[+m[1]] = m[2];
    return map;
  };

  /* ---------- vínculo com os temas das aulas ---------- */
  EN.bestTopic = (q) => {
    const qt = tokens(q.stem + ' ' + q.options.join(' '));
    [...qt].forEach((w) => STOP.has(w) && qt.delete(w));
    let best = null;
    Q.Store.state.materials.forEach((m) =>
      m.topics.filter((t) => !t.ignored).forEach((t) => {
        const tt = tokens(t.title + ' ' + t.title + ' ' + t.text);
        const hit = [...qt].filter((w) => tt.has(w));
        const titleHit = [...tokens(t.title)].filter((w) => qt.has(w)).length;
        const score = hit.length + titleHit * 2;
        if (hit.length >= 3 && (!best || score > best.score)) best = { m, t, score, hit };
      })
    );
    if (!best) return null;
    // trecho do slide com mais palavras em comum
    let line = '';
    let bs = -1;
    best.t.text.split('\n').forEach((l) => {
      const s = [...tokens(l)].filter((w) => qt.has(w)).length;
      if (s > bs) { bs = s; line = l.trim(); }
    });
    return { materialId: best.m.id, topicId: best.t.id, n: best.t.n, title: best.t.title, line, score: best.score };
  };

  /** Cria (ou completa) as questões ENAMED vinculadas aos temas atuais. Retorna quantas novas foram vinculadas. */
  EN.sync = () => {
    const st = Q.Store.state;
    const have = new Set(st.questions.filter((q) => q.origin === 'enamed').map((q) => q.enamedId));
    let n = 0;
    (st.enamed || []).forEach((e) => {
      if (have.has(e.id)) return;
      const b = EN.bestTopic(e);
      if (!b) return;
      st.questions.push({
        id: Q.uid('q'), materialId: b.materialId, topicIds: [b.topicId], stem: e.stem, options: e.options, correct: e.correct,
        explanation: `Gabarito oficial: letra ${'ABCD'[e.correct]}. No seu material, o tema mais próximo é o slide ${b.n} (“${b.title}”)${b.line ? `: “${b.line}”` : ''}.`,
        whyNot: e.options.map((_, i) => (i === e.correct ? '' : `Não é a alternativa indicada no gabarito oficial (${e.ref}). Compare com o slide ${b.n} (“${b.title}”).`)),
        imageIds: [], difficulty: 3, fixedOrder: false, origin: 'enamed', enamedId: e.id, ref: e.ref, createdAt: Date.now(),
      });
      n++;
    });
    if (n) Q.Store.save();
    return n;
  };

  /** Importa caderno + gabarito. Retorna resumo. */
  EN.importFiles = async (caderno, gabarito, label) => {
    const st = Q.Store.state;
    st.enamed = st.enamed || [];
    const qs = EN.parseCaderno(await EN.readText(caderno));
    const gab = EN.parseGabarito(await EN.readText(gabarito));
    let added = 0, noKey = 0, fig = 0, dup = 0;
    qs.forEach((q) => {
      const key = gab[q.n];
      if (!key) return noKey++;
      if (NEEDS_FIGURE.test(q.stem)) return fig++;
      const id = `${label}#${q.n}`;
      if (st.enamed.some((e) => e.id === id)) return dup++;
      st.enamed.push({ id, ref: `${label} · questão ${q.n}`, stem: q.stem, options: q.options, correct: 'ABCD'.indexOf(key) });
      added++;
    });
    const linked = EN.sync();
    Q.Store.save();
    return { found: qs.length, added, linked, noKey, fig, dup };
  };
})();
