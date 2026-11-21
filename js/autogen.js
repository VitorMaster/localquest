/* Localquest — geração automática de questões a partir do texto dos slides (offline, sem IA).
 * Tipos: descrição de um termo ("Termo: descrição"), item que NÃO pertence a uma lista,
 * item que pertence, lacuna numérica e afirmação que consta no slide (com figura, quando houver).
 * Toda questão passa pelo lint anti-chute; as que têm pistas graves são descartadas. */
(function () {
  const Q = window.Q, G = Q.Guard;
  const A = (Q.Autogen = {});

  const clean = (s) => s.replace(/^[\-•–·•▪►]\s*/, '').trim();
  const KV = /^([^:]{3,60}):\s+(.{8,})$/;
  const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const linesOf = (t) => (t.text || '').split('\n').map(clean).filter(Boolean);

  /** Escolhe k textos de `pool` com tamanho parecido ao de `target` (evita "a maior é a certa"). */
  const closest = (pool, target, k, exclude) => {
    const seen = new Set((exclude || []).map(norm));
    const uniq = [];
    pool.forEach((p) => {
      const n = norm(p);
      if (!seen.has(n)) { seen.add(n); uniq.push(p); }
    });
    return Q.shuffle(uniq)
      .sort((a, b) => Math.abs(a.length - target.length) - Math.abs(b.length - target.length) + (Math.random() - 0.5) * 6)
      .slice(0, k);
  };

  const build = (t, stem, correct, distractors, explanation, extra = {}) => {
    if (distractors.length < 3) return null;
    const opts = Q.shuffle([correct, ...distractors.slice(0, 3)]);
    const q = Object.assign(
      { id: Q.uid('q'), materialId: t._mid, topicIds: [t.id], stem, options: opts, correct: opts.indexOf(correct), explanation,
        imageIds: [], difficulty: 1, fixedOrder: false, origin: 'auto', createdAt: Date.now() },
      extra
    );
    return G.lint(q).some((i) => i.level === 'bad' && i.code !== 'slide') ? null : q;
  };

  A.forTopic = (material, t, ctx) => {
    t._mid = material.id;
    const out = [];
    const L = linesOf(t);
    const title = t.title;
    const src = (s) => `Conforme o slide ${t.n} (“${title}”): ${s}`;

    /* 1. termo: descrição */
    const kvs = L.map((l) => l.match(KV)).filter(Boolean).map((m) => ({ k: m[1].trim(), v: m[2].trim() })).filter((x) => x.v.length <= 150);
    Q.shuffle(kvs).slice(0, 2).forEach((x) => {
      const same = kvs.filter((y) => y !== x).map((y) => y.v);
      const other = ctx.kvValues.filter((v) => !same.includes(v) && norm(v) !== norm(x.v));
      const d = [...closest(same, x.v, 3, [x.v])];
      if (d.length < 3) d.push(...closest(other, x.v, 3 - d.length, [x.v, ...d]));
      const q = build(t, `No slide “${title}”, qual das opções descreve corretamente “${x.k}”?`, x.v, d, src(`${x.k}: ${x.v}`));
      if (q) out.push(q);
    });

    /* 2. listas curtas */
    const items = L.filter((l) => l.length <= 50 && !KV.test(l));
    if (items.length >= 3) {
      const mine = new Set(items.map(norm));
      const foreign = ctx.shortItems.filter((s) => !mine.has(norm(s)));
      if (foreign.length >= 1) {
        const odd = closest(foreign, items[0], 1)[0];
        const d = Q.shuffle(items).slice(0, 3);
        const q = build(t, `Qual das opções NÃO faz parte de “${title}”, segundo o slide?`, odd, d, src(items.join('; ')), { difficulty: 2 });
        if (q) out.push(q);
      }
      if (foreign.length >= 3) {
        const right = Q.shuffle(items)[0];
        const d = closest(foreign, right, 3, [right]);
        const q = build(t, `Qual das opções faz parte de “${title}”, segundo o slide?`, right, d, src(items.join('; ')));
        if (q) out.push(q);
      }
    }

    /* 3. lacuna numérica */
    for (const l of Q.shuffle(L)) {
      if (l.length < 25) continue;
      const m = /(^|[^\w.,])(\d{1,3})(?![\d.,ªº])/.exec(l);
      if (!m) continue;
      const n = +m[2];
      const idx = m.index + m[1].length;
      const stem = `Complete conforme o slide “${title}”: “${l.slice(0, idx)}____${l.slice(idx + m[2].length)}”`;
      const pool = [...ctx.numbers].filter((x) => x !== n).sort((a, b) => Math.abs(a - n) - Math.abs(b - n)).slice(0, 5);
      const arith = [n * 2, n + 2, Math.max(1, n - 2), n + 5, n * 3, n + 1].filter((x) => x !== n && x > 0);
      const d = [...new Set([...Q.shuffle(pool).slice(0, 2), ...arith])].filter((x) => x !== n).slice(0, 3).map(String);
      const q = build(t, stem, String(n), d, src(l), { difficulty: 2 });
      if (q) { out.push(q); break; }
    }

    /* 4. afirmação que consta no slide (com figura, quando houver) */
    const stmts = L.filter((l) => l.length >= 30 && l.length <= 170);
    if (stmts.length) {
      const s = Q.shuffle(stmts)[0];
      const d = closest(ctx.statements.filter((x) => x.tid !== t.id).map((x) => x.s), s, 3, [s]);
      const imgs = (t.images || []).filter((i) => i.kind === 'fig');
      const img = imgs.length ? imgs : (t.images || []).slice(0, 1);
      const withImg = img.length > 0;
      const q = build(t, withImg ? `Observe a figura do slide “${title}”. Qual afirmação está de acordo com o conteúdo desse slide?` : `Qual das afirmações abaixo consta no slide “${title}”?`, s, d, src(s), { imageIds: withImg ? img.map((i) => i.id) : [] });
      if (q) out.push(q);
    }
    delete t._mid;
    return out;
  };

  const context = (material) => {
    const act = material.topics.filter((t) => !t.ignored);
    const ctx = { kvValues: [], shortItems: [], statements: [], numbers: new Set() };
    act.forEach((t) =>
      linesOf(t).forEach((l) => {
        const m = l.match(KV);
        if (m && m[2].length <= 150) ctx.kvValues.push(m[2].trim());
        if (l.length <= 50 && !m) ctx.shortItems.push(l);
        if (l.length >= 30 && l.length <= 170) ctx.statements.push({ tid: t.id, s: l });
        (l.match(/(^|[^\w.,])(\d{1,3})(?![\d.,ªº])/g) || []).forEach((x) => ctx.numbers.add(+x.replace(/\D/g, '')));
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

  /** Garante que todos os materiais selecionados tenham questões. */
  A.ensure = (materialIds) => {
    let total = 0;
    materialIds.forEach((id) => {
      const m = Q.Store.material(id);
      if (m && !Q.Store.questionsOf(id).length) total += A.fill(m);
    });
    return total;
  };
})();
