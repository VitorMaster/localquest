/* Localquest — geração automática de questões a partir do texto dos slides (offline, sem IA).
 * Tipos: descrição de um termo ("Termo: descrição"), item que NÃO pertence a uma lista, item que pertence,
 * lacuna numérica e afirmação que consta no slide (com figura, quando houver).
 * Cada questão guarda a justificativa da correta (trecho do slide) e, para cada alternativa errada,
 * de onde ela vem no material (`whyNot`). Questões com pistas graves são descartadas. */
(function () {
  const Q = window.Q, G = Q.Guard;
  const A = (Q.Autogen = {});

  const clean = (s) => s.replace(/^[\-•–·•▪►]\s*/, '').trim();
  const KV = /^([^:]{3,60}):\s+(.{8,})$/;
  const NUM = /(^|[^\w.,])(\d{1,3})(?![\d.,ªº])/;
  const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const linesOf = (t) => (t.text || '').split('\n').map(clean).filter(Boolean);

  /** Escolhe k itens ({t,why}) com tamanho de texto parecido ao do alvo (evita "a maior é a certa"). */
  const closest = (pool, target, k, exclude) => {
    const seen = new Set((exclude || []).map(norm));
    const uniq = [];
    pool.forEach((p) => {
      const n = norm(p.t);
      if (!seen.has(n)) { seen.add(n); uniq.push(p); }
    });
    return Q.shuffle(uniq)
      .sort((a, b) => Math.abs(a.t.length - target.length) - Math.abs(b.t.length - target.length) + (Math.random() - 0.5) * 6)
      .slice(0, k);
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

  A.forTopic = (material, t, ctx) => {
    t._mid = material.id;
    const out = [];
    const L = linesOf(t);
    const title = t.title;
    const where = `Conforme o slide ${t.n} (“${title}”)`;

    /* 1. termo: descrição */
    const kvs = L.map((l) => l.match(KV)).filter(Boolean).map((m) => ({ k: m[1].trim(), v: m[2].trim() })).filter((x) => x.v.length <= 150);
    Q.shuffle(kvs).slice(0, 2).forEach((x) => {
      const same = kvs.filter((y) => y !== x).map((y) => ({ t: y.v, why: `Essa alternativa descreve “${y.k}” (slide ${t.n}), e não “${x.k}”.` }));
      const other = ctx.kv.filter((y) => y.n !== t.n).map((y) => ({ t: y.v, why: `Essa alternativa descreve “${y.k}” no slide ${y.n} (“${y.title}”), e não “${x.k}”.` }));
      const d = closest(same, x.v, 3, [x.v]);
      if (d.length < 3) d.push(...closest(other, x.v, 3 - d.length, [x.v, ...d.map((z) => z.t)]));
      const q = build(t, `No slide “${title}”, qual das opções descreve corretamente “${x.k}”?`, x.v, d, `${where}: ${x.k}: ${x.v}.`);
      if (q) out.push(q);
    });

    /* 2. listas curtas */
    const items = L.filter((l) => l.length <= 50 && !KV.test(l));
    if (items.length >= 3) {
      const mine = new Set(items.map(norm));
      const foreign = ctx.items.filter((s) => !mine.has(norm(s.t)));
      const listTxt = items.join('; ');
      if (foreign.length >= 1) {
        const odd = closest(foreign, items[0], 1)[0];
        const d = Q.shuffle(items).slice(0, 3).map((it) => ({ t: it, why: `“${it}” faz parte da lista de “${title}” (slide ${t.n}); por isso não é a exceção.` }));
        const q = build(t, `Qual das opções NÃO faz parte de “${title}”, segundo o slide?`, odd.t, d, `“${odd.t}” não consta em “${title}” (aparece no slide ${odd.n}, “${odd.title}”). ${where} lista: ${listTxt}.`, { difficulty: 2 });
        if (q) out.push(q);
      }
      if (foreign.length >= 3) {
        const right = Q.shuffle(items)[0];
        const d = closest(foreign.map((f) => ({ t: f.t, why: `“${f.t}” aparece no slide ${f.n} (“${f.title}”), e não em “${title}”.` })), right, 3, [right]);
        const q = build(t, `Qual das opções faz parte de “${title}”, segundo o slide?`, right, d, `${where} lista: ${listTxt}.`);
        if (q) out.push(q);
      }
    }

    /* 3. lacuna numérica */
    for (const l of Q.shuffle(L)) {
      if (l.length < 25) continue;
      const m = NUM.exec(l);
      if (!m) continue;
      const n = +m[2];
      const idx = m.index + m[1].length;
      const stem = `Complete conforme o slide “${title}”: “${l.slice(0, idx)}____${l.slice(idx + m[2].length)}”`;
      const pool = [...ctx.numbers].filter((x) => x !== n).sort((a, b) => Math.abs(a - n) - Math.abs(b - n)).slice(0, 5);
      const arith = [n * 2, n + 2, Math.max(1, n - 2), n + 5, n * 3, n + 1].filter((x) => x !== n && x > 0);
      const d = [...new Set([...Q.shuffle(pool).slice(0, 2), ...arith])].filter((x) => x !== n).slice(0, 3).map((x) => ({ t: String(x), why: `O slide ${t.n} traz ${n} nesse ponto, e não ${x}: “${l}”.` }));
      const q = build(t, stem, String(n), d, `${where}: “${l}”.`, { difficulty: 2 });
      if (q) { out.push(q); break; }
    }

    /* 4. afirmação que consta no slide (com figura, quando houver) */
    const stmts = L.filter((l) => l.length >= 30 && l.length <= 170);
    if (stmts.length) {
      const s = Q.shuffle(stmts)[0];
      const pool = ctx.statements.filter((x) => x.tid !== t.id).map((x) => ({ t: x.s, why: `Essa afirmação é do slide ${x.n} (“${x.title}”), e não do slide ${t.n}.` }));
      const d = closest(pool, s, 3, [s]);
      const imgs = (t.images || []).filter((i) => i.kind === 'fig');
      const img = imgs.length ? imgs : (t.images || []).slice(0, 1);
      const withImg = img.length > 0;
      const q = build(t, withImg ? `Observe a figura do slide “${title}”. Qual afirmação está de acordo com o conteúdo desse slide?` : `Qual das afirmações abaixo consta no slide “${title}”?`, s, d, `${where}: “${s}”.`, { imageIds: withImg ? img.map((i) => i.id) : [] });
      if (q) out.push(q);
    }
    delete t._mid;
    return out;
  };

  const context = (material) => {
    const ctx = { kv: [], items: [], statements: [], numbers: new Set() };
    material.topics.filter((t) => !t.ignored).forEach((t) =>
      linesOf(t).forEach((l) => {
        const m = l.match(KV);
        if (m && m[2].length <= 150) ctx.kv.push({ k: m[1].trim(), v: m[2].trim(), n: t.n, title: t.title });
        if (l.length <= 50 && !m) ctx.items.push({ t: l, n: t.n, title: t.title });
        if (l.length >= 30 && l.length <= 170) ctx.statements.push({ tid: t.id, s: l, n: t.n, title: t.title });
        const g = new RegExp(NUM.source, 'g');
        let mm;
        while ((mm = g.exec(l))) ctx.numbers.add(+mm[2]);
      })
    );
    ctx.numbers.delete(0);
    return ctx;
  };

  /** Gera questões para os slides do material que ainda não têm nenhuma. Retorna quantas foram criadas. */
  A.fill = (material) => {
    const st = Q.Store.state;
    const have = new Set(Q.Store.questionsOf(material.id).flatMap((q) => q.topicIds || []));
    const stems = new Set(Q.Store.questionsOf(material.id).map((q) => norm(q.stem)));
    const ctx = context(material);
    let n = 0;
    material.topics.filter((t) => !t.ignored && !have.has(t.id)).forEach((t) => {
      A.forTopic(material, t, ctx).forEach((q) => {
        if (stems.has(norm(q.stem))) return;
        stems.add(norm(q.stem));
        st.questions.push(q);
        n++;
      });
    });
    if (n) Q.Store.save();
    return n;
  };
})();
