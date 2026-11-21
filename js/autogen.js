/* Localquest — criação de questões a partir do texto dos slides (offline, sem IA).
 * Você escolhe a QUANTIDADE (até 50) e o NÍVEL (fácil, médio, difícil ou misto). Nenhuma questão se repete:
 * cada linha do material gera no máximo uma questão por vez; só depois de esgotar as linhas é que variações
 * diferentes da mesma linha entram. Cada questão guarda a justificativa da correta (trecho do slide) e, para cada
 * alternativa errada, de onde ela vem no material. Questões com pistas graves (anti-chute) são descartadas. */
(function () {
  const Q = window.Q, G = Q.Guard;
  const A = (Q.Autogen = {});
  A.MAX = 50;
  A.LEVELS = { 1: 'Fácil', 2: 'Médio', 3: 'Difícil' };

  const clean = (s) => s.replace(/^[\-•–·•▪►]\s*/, '').trim();
  const KV = /^([^:]{3,60}):\s+(.{8,})$/;
  const NUM = /(^|[^\w.,])(\d{1,3})(?![\d.,ªº])/;
  const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
  const linesOf = (t) => (t.text || '').split('\n').map(clean).filter(Boolean);
  const words = (s) => new Set((norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]{3,}/g) || []));
  const sim = (a, b) => {
    const A1 = words(a), B1 = words(b);
    let i = 0;
    A1.forEach((w) => B1.has(w) && i++);
    const jac = i / Math.max(1, A1.size + B1.size - i);
    return jac + 0.3 * (1 - Math.min(1, Math.abs(a.length - b.length) / Math.max(a.length, b.length, 1)));
  };

  /**
   * Escolhe k distratores de `pool` ({t, why, topic}) conforme o nível:
   *  1 fácil   → bem diferentes do alvo, de outros slides;
   *  2 médio   → mistura;
   *  3 difícil → os mais parecidos (mesmo slide primeiro).
   * Em qualquer nível o tamanho de texto é mantido próximo (evita "a maior é a certa").
   */
  const pick = (pool, target, k, lvl, topicN, exclude) => {
    const seen = new Set((exclude || []).map(norm));
    const uniq = [];
    pool.forEach((p) => { const n = norm(p.t); if (!seen.has(n)) { seen.add(n); uniq.push(p); } });
    const score = (p) => {
      const lenPen = Math.abs(p.t.length - target.length) / Math.max(target.length, 1);
      const s = sim(p.t, target);
      const same = p.topic === topicN ? 1 : 0;
      if (lvl === 3) return -(same * 1.2 + s) + lenPen * 0.5 + Math.random() * 0.2;
      if (lvl === 1) return same * 1.2 + s + lenPen * 0.5 + Math.random() * 0.2;
      return lenPen + Math.random() * 0.9;
    };
    return Q.shuffle(uniq).sort((a, b) => score(a) - score(b)).slice(0, k);
  };

  const build = (t, stem, correct, distractors, explanation, extra = {}) => {
    if (distractors.length < 3) return null;
    const ds = distractors.slice(0, 3);
    const order = Q.shuffle([{ t: correct, why: '' }, ...ds]);
    const q = Object.assign(
      { id: Q.uid('q'), materialId: t._mid, topicIds: [t.id], stem, options: order.map((o) => o.t),
        correct: order.findIndex((o) => o.t === correct && !o.why), whyNot: order.map((o) => o.why),
        explanation, imageIds: [], difficulty: 1, fixedOrder: false, origin: 'auto', createdAt: Date.now() },
      extra
    );
    return G.lint(q).some((i) => i.level === 'bad' && i.code !== 'slide') ? null : q;
  };

  /* ---------- contexto do material ---------- */
  const context = (material) => {
    const ctx = { kv: [], items: [], statements: [], numbers: new Set(), keywords: [] };
    material.topics.filter((t) => !t.ignored).forEach((t) =>
      linesOf(t).forEach((l) => {
        const m = l.match(KV);
        if (m && m[2].length <= 150) ctx.kv.push({ t: m[2].trim(), k: m[1].trim(), topic: t.n, title: t.title });
        if (l.length <= 50 && !m) ctx.items.push({ t: l, topic: t.n, title: t.title });
        if (l.length >= 30 && l.length <= 170) ctx.statements.push({ t: l, tid: t.id, topic: t.n, title: t.title });
        const g = new RegExp(NUM.source, 'g');
        let mm;
        while ((mm = g.exec(l))) ctx.numbers.add(+mm[2]);
        (l.match(/[A-Za-zÀ-ú]{6,}/g) || []).forEach((w) => ctx.keywords.push({ t: w, topic: t.n, line: l }));
      })
    );
    ctx.numbers.delete(0);
    return ctx;
  };

  /* ---------- candidatos: cada um sabe montar a sua questão no nível pedido ---------- */
  const candidates = (material, ctx) => {
    const out = [];
    const act = material.topics.filter((t) => !t.ignored);
    act.forEach((t) => {
      const L = linesOf(t);
      const title = t.title;
      const where = `Conforme o slide ${t.n} (“${title}”)`;
      const stmts = L.filter((l) => l.length >= 30 && l.length <= 170);
      const items = L.filter((l) => l.length <= 50 && !KV.test(l));
      const kvs = L.map((l) => ({ l, m: l.match(KV) })).filter((x) => x.m && x.m[2].length <= 150).map((x) => ({ l: x.l, k: x.m[1].trim(), v: x.m[2].trim() }));
      const add = (src, kind, make) => out.push({ src: `${t.id}|${src}`, kind, topicId: t.id, t, make });

      kvs.forEach((x) => {
        // termo → descrição
        add('l:' + norm(x.l), 'def', (lvl) => {
          const same = kvs.filter((y) => y !== x).map((y) => ({ t: y.v, topic: t.n, why: `Essa alternativa descreve “${y.k}” (slide ${t.n}), e não “${x.k}”.` }));
          const other = ctx.kv.filter((y) => y.topic !== t.n).map((y) => ({ t: y.t, topic: y.topic, why: `Essa alternativa descreve “${y.k}” no slide ${y.topic} (“${y.title}”), e não “${x.k}”.` }));
          const d = pick(lvl === 1 ? other.concat(same) : same.concat(other), x.v, 3, lvl, t.n, [x.v]);
          return build(t, `No slide “${title}”, qual das opções descreve corretamente “${x.k}”?`, x.v, d, `${where}: ${x.k}: ${x.v}.`, { src: 'l:' + norm(x.l), kind: 'def' });
        });
        // descrição → termo
        add('l:' + norm(x.l), 'rev', (lvl) => {
          const same = kvs.filter((y) => y !== x).map((y) => ({ t: y.k, topic: t.n, why: `“${y.k}” é outro ponto do slide ${t.n}: ${y.v}.` }));
          const other = ctx.kv.filter((y) => y.topic !== t.n).map((y) => ({ t: y.k, topic: y.topic, why: `“${y.k}” aparece no slide ${y.topic} (“${y.title}”), e não descreve isso.` }));
          const d = pick(lvl === 1 ? other.concat(same) : same.concat(other), x.k, 3, lvl, t.n, [x.k]);
          return build(t, `No slide “${title}”, qual termo corresponde a: “${x.v}”?`, x.k, d, `${where}: ${x.k}: ${x.v}.`, { src: 'l:' + norm(x.l), kind: 'rev' });
        });
      });

      // lista curta: item que faz parte / que NÃO faz parte
      if (items.length >= 3) {
        const mine = new Set(items.map(norm));
        const foreign = ctx.items.filter((s) => !mine.has(norm(s.t)));
        const listTxt = items.join('; ');
        items.forEach((it) => {
          add('l:' + norm(it), 'in', (lvl) => {
            const d = pick(foreign.map((f) => ({ t: f.t, topic: f.topic, why: `“${f.t}” aparece no slide ${f.topic} (“${f.title}”), e não em “${title}”.` })), it, 3, lvl === 3 ? 2 : lvl, t.n, [it]);
            return build(t, `Qual das opções faz parte de “${title}”, segundo o slide?`, it, d, `${where} lista: ${listTxt}.`, { src: 'l:' + norm(it), kind: 'in' });
          });
        });
        for (let k = 0; k < Math.min(3, foreign.length); k++)
          add('not' + k, 'not', (lvl) => {
            const odd = pick(foreign, items[0], 1, lvl, t.n)[0];
            if (!odd) return null;
            const d = Q.shuffle(items).slice(0, 3).map((it) => ({ t: it, why: `“${it}” faz parte da lista de “${title}” (slide ${t.n}); por isso não é a exceção.` }));
            return build(t, `Qual das opções NÃO faz parte de “${title}”, segundo o slide?`, odd.t, d, `“${odd.t}” não consta em “${title}” (aparece no slide ${odd.topic}, “${odd.title}”). ${where} lista: ${listTxt}.`, { src: `${t.id}|not|${norm(odd.t)}`, kind: 'not' });
          });
      }

      stmts.forEach((s) => {
        const key = 'l:' + norm(s);
        // lacuna numérica
        const m = NUM.exec(s);
        if (m && s.length >= 25) add(key, 'num', (lvl) => {
          const n = +m[2], idx = m.index + m[1].length;
          const stem = `Complete conforme o slide “${title}”: “${s.slice(0, idx)}____${s.slice(idx + m[2].length)}”`;
          const far = [n * 2, n * 5, n + 10, n + 20, Math.max(1, n - 10)];
          const near = [n + 1, Math.max(1, n - 1), n + 2, Math.max(1, n - 2), n + 5];
          const others = [...ctx.numbers].filter((x) => x !== n);
          const rank = lvl === 3 ? near.concat(others.sort((a, b) => Math.abs(a - n) - Math.abs(b - n))) : lvl === 1 ? Q.shuffle(others).concat(far) : Q.shuffle(others.slice(0, 4).concat(near.slice(0, 2), far.slice(0, 2)));
          const d = [...new Set(rank)].filter((x) => x !== n && x > 0).slice(0, 3).map((x) => ({ t: String(x), why: `O slide ${t.n} traz ${n} nesse ponto, e não ${x}: “${s}”.` }));
          return build(t, stem, String(n), d, `${where}: “${s}”.`, { src: key, kind: 'num' });
        });
        // lacuna de palavra-chave
        const kw = (s.match(/[A-Za-zÀ-ú]{6,}/g) || []).sort((a, b) => b.length - a.length)[0];
        if (kw) add(key, 'cloze', (lvl) => {
          const stem = `Complete conforme o slide “${title}”: “${s.replace(kw, '____')}”`;
          const pool = ctx.keywords.filter((w) => norm(w.t) !== norm(kw) && !norm(s).includes(norm(w.t))).map((w) => ({ t: w.t, topic: w.topic, why: `“${w.t}” aparece em outro trecho do material (slide ${w.topic}), mas não completa esta frase do slide ${t.n}.` }));
          const d = pick(pool, kw, 3, lvl, t.n, [kw]);
          return build(t, stem, kw, d, `${where}: “${s}”.`, { src: key, kind: 'cloze' });
        });
        // afirmação que consta no slide (ou NÃO consta, no nível difícil)
        add(key, 'stmt', (lvl) => {
          const imgs = (t.images || []).filter((i) => i.kind === 'fig');
          const img = imgs.length ? imgs : (t.images || []).slice(0, 1);
          const withImg = img.length > 0 && lvl < 3;
          const others = ctx.statements.filter((x) => x.tid !== t.id).map((x) => ({ t: x.t, topic: x.topic, why: `Essa afirmação é do slide ${x.topic} (“${x.title}”), e não do slide ${t.n}.` }));
          if (lvl === 3 && stmts.length >= 4) {
            const mineOpts = Q.shuffle(stmts.filter((z) => z !== s)).slice(0, 3).map((z) => ({ t: z, why: `Essa afirmação consta no slide ${t.n} (“${title}”).` }));
            const odd = pick(others, s, 1, 3, t.n)[0];
            if (odd && mineOpts.length === 3) return build(t, `Qual das afirmações abaixo NÃO consta no slide “${title}”?`, odd.t, mineOpts, `“${odd.t}” é do slide ${odd.topic} (“${odd.title}”). ${where} traz: “${s}” e as demais afirmações listadas.`, { src: key, kind: 'stmt' });
          }
          const d = pick(others, s, 3, lvl, t.n, [s]);
          return build(t, withImg ? `Observe a figura do slide “${title}”. Qual afirmação está de acordo com o conteúdo desse slide?` : `Qual das afirmações abaixo consta no slide “${title}”?`, s, d, `${where}: “${s}”.`, { imageIds: withImg ? img.map((i) => i.id) : [], src: key, kind: 'stmt' });
        });
      });
    });
    return out;
  };

  /** Estimativa de quantas questões distintas o material ainda comporta (simula a criação, sem salvar). */
  A.capacity = (material) => {
    const ctx = context(material);
    const existing = Q.Store.questionsOf(material.id);
    const stems = new Set(existing.map((q) => norm(q.stem)));
    const optSets = new Set(existing.map((q) => norm(q.options.slice().sort().join('|'))));
    let total = 0;
    candidates(material, ctx).forEach((c) => {
      c.t._mid = material.id;
      const q = c.make(2);
      delete c.t._mid;
      if (!q) return;
      const o = norm(q.options.slice().sort().join('|'));
      if (stems.has(norm(q.stem)) || optSets.has(o)) return;
      stems.add(norm(q.stem)); optSets.add(o); total++;
    });
    return { total: Math.min(total, 99999) };
  };

  /**
   * Cria até n questões (máx. 50) sem repetir.
   * opts: { n, levels:[1|2|3,…] (padrão [1,2,3] = misto), replaceAuto:boolean }
   * Retorna { created, requested, available }.
   */
  A.create = (material, opts = {}) => {
    const n = Q.clamp(Math.round(opts.n || 20), 1, A.MAX);
    const levels = (opts.levels && opts.levels.length ? opts.levels : [1, 2, 3]).filter((l) => l >= 1 && l <= 3);
    const st = Q.Store.state;
    if (opts.replaceAuto) {
      const used = new Set(st.attempts.flatMap((a) => a.answers.map((x) => x.qid)));
      st.questions = st.questions.filter((q) => !(q.materialId === material.id && q.origin === 'auto' && !used.has(q.id)));
    }
    const existing = Q.Store.questionsOf(material.id);
    const stems = new Set(existing.map((q) => norm(q.stem)));
    const optSets = new Set(existing.map((q) => norm(q.options.slice().sort().join('|'))));
    const usedSrc = new Set(existing.map((q) => q.src).filter(Boolean));
    const ctx = context(material);
    const all = candidates(material, ctx);
    // intercala os slides (round-robin) para espalhar as questões pelo conteúdo
    const byTopic = new Map();
    Q.shuffle(all).forEach((c) => (byTopic.get(c.topicId) || byTopic.set(c.topicId, []).get(c.topicId)).push(c));
    const rr = [];
    for (let k = 0; rr.length < all.length; k++) byTopic.forEach((arr) => arr[k] && rr.push(arr[k]));
    const plan = Q.shuffle(Array.from({ length: n }, (_, i) => levels[i % levels.length]));
    const made = [];
    let longestN = 0;
    const tryPass = (allowSeenSrc) => {
      for (const c of rr) {
        if (made.length >= n) break;
        if (c.done) continue;
        const srcKey = c.src.split('|').slice(1).join('|');
        const seen = usedSrc.has(srcKey) || made.some((m) => m._src === c.src);
        if (seen && !allowSeenSrc) continue;
        c.t._mid = material.id;
        const lvl = plan[made.length];
        const q = c.make(lvl);
        delete c.t._mid;
        if (!q) { c.done = true; continue; }
        const okey = norm(q.options.slice().sort().join('|'));
        if (stems.has(norm(q.stem)) || optSets.has(okey)) { c.done = true; continue; }
        // mantém "a certa é a maior" perto do acaso (≈25%) para não premiar quem marca a mais longa
        const isLongest = q.options[q.correct].length === Math.max(...q.options.map((o) => o.length));
        if (isLongest && made.length >= 4 && (longestN + 1) / (made.length + 1) > 0.3) continue;
        if (isLongest) longestN++;
        stems.add(norm(q.stem)); optSets.add(okey); c.done = true;
        q.difficulty = lvl; q._src = c.src;
        made.push(q);
      }
    };
    tryPass(false);   // 1ª passada: uma questão por linha do material
    tryPass(true);    // 2ª: variações diferentes das mesmas linhas, se ainda faltar
    made.forEach((q) => { delete q._src; st.questions.push(q); });
    if (made.length) Q.Store.save();
    return { created: made.length, requested: n, available: all.length };
  };

  /** Compatibilidade: cria questões para o material inteiro (nível misto). */
  A.fill = (material, n = 20) => A.create(material, { n }).created;
})();
