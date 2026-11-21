/* Localquest — motor: montagem de provas, pontuação, cobertura de conteúdo e insights. */
(function () {
  const Q = window.Q;
  const G = Q.Guard;
  const S = () => Q.Store.state;
  const E = (Q.Engine = {});

  const CONF_W = { direct: 1, sure: 1, doubt: 0.6, guess: 0 };
  E.CONF_LABEL = { direct: 'Resposta', sure: 'Certeza', doubt: 'Dúvida', guess: 'Chute' };

  /* ---------- filtros ---------- */
  E.materials = (f = {}) =>
    S().materials.filter(
      (m) => (!f.curso || m.curso === f.curso) && (!f.periodo || m.periodo === f.periodo) && (!f.materia || m.materia === f.materia)
    );
  E.distinct = (field, f = {}) => {
    // valores únicos de `field` respeitando os demais filtros (filtros em cascata)
    const g = Object.assign({}, f);
    delete g[field];
    return [...new Set(E.materials(g).map((m) => m[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  };
  E.activeTopics = (m) => m.topics.filter((t) => !t.ignored);

  /* ---------- respostas ---------- */
  E.weight = (a) => {
    if (!a.correct) return 0;
    const base = CONF_W[a.conf] != null ? CONF_W[a.conf] : 0.6;
    return a.suspect ? base * 0.5 : base;
  };

  /** Lista plana de respostas (com data), respeitando o filtro de material. */
  E.answers = (f = {}, attempts = S().attempts) => {
    const ids = new Set(E.materials(f).map((m) => m.id));
    const out = [];
    attempts
      .slice()
      .sort((a, b) => a.at - b.at)
      .forEach((at) =>
        at.answers.forEach((an) => {
          if (ids.has(an.materialId)) out.push(Object.assign({ at: at.at, attemptId: at.id }, an));
        })
      );
    return out;
  };

  E.summarize = (answers) => {
    const n = answers.length;
    const correct = answers.filter((a) => a.correct).length;
    const guesses = answers.filter((a) => a.conf === 'guess').length;
    const fast = answers.filter((a) => a.fast).length;
    const patt = answers.filter((a) => a.patt).length;
    const behav = answers.filter((a) => a.fast || a.patt).length;
    const overconf = answers.filter((a) => !a.correct && a.conf === 'sure').length;
    const luck = answers.filter((a) => a.correct && (a.conf === 'guess' || a.suspect)).length;
    const raw = n ? correct / n : 0;
    const real = n ? Q.avg(answers.map(E.weight)) : 0;
    const integrity = n ? 1 - behav / n : 1;
    const ms = n ? Q.avg(answers.map((a) => a.ms || 0)) : 0;
    return { n, correct, raw, real, integrity, guesses, fast, patt, overconf, luck, ms };
  };

  /** Calibração: acerto real para cada nível de segurança declarado. */
  E.calibration = (answers) =>
    ['sure', 'doubt', 'guess'].map((c) => {
      const xs = answers.filter((a) => a.conf === c);
      return { conf: c, n: xs.length, acc: xs.length ? xs.filter((a) => a.correct).length / xs.length : 0 };
    });

  E.groupBy = (answers, keyFn) => {
    const map = new Map();
    answers.forEach((a) => {
      const k = keyFn(a);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(a);
    });
    return [...map.entries()].map(([key, xs]) => Object.assign({ key }, E.summarize(xs)));
  };

  /* ---------- cobertura & domínio por tópico ---------- */
  E.MASTERY = { dominado: 0.8, progresso: 0.5 };
  const stateOf = (m, touched) => (!touched ? 'none' : m >= E.MASTERY.dominado ? 'dominado' : m >= E.MASTERY.progresso ? 'progresso' : 'fragil');
  E.STATE_LABEL = { none: 'Não explorado', fragil: 'Frágil', progresso: 'Em progresso', dominado: 'Dominado', ignored: 'Ignorado', nobank: 'Sem questão' };

  /**
   * Cobertura de um material.
   * attempts: lista de tentativas consideradas (padrão: todas). `upTo` opcional para "estado até aquela prova".
   */
  E.coverage = (material, attempts = S().attempts) => {
    const qs = Q.Store.questionsOf(material.id);
    const byTopicQs = new Map();
    qs.forEach((q) => (q.topicIds || []).forEach((tid) => byTopicQs.set(tid, (byTopicQs.get(tid) || new Set()).add(q.id))));
    const ans = [];
    attempts
      .slice()
      .sort((a, b) => a.at - b.at)
      .forEach((at) => at.answers.forEach((an) => an.materialId === material.id && ans.push(an)));
    const seenQ = new Set(ans.map((a) => a.qid));
    const topics = material.topics.map((t) => {
      const mine = ans.filter((a) => (a.topicIds || []).includes(t.id));
      let mastery = 0;
      if (mine.length) {
        let tw = 0, sw = 0;
        mine.forEach((a, i) => {
          const wt = Math.pow(0.7, mine.length - 1 - i);
          tw += wt;
          sw += wt * E.weight(a);
        });
        mastery = sw / tw;
      }
      const bank = byTopicQs.get(t.id) ? byTopicQs.get(t.id).size : 0;
      const answered = new Set(mine.map((a) => a.qid)).size;
      let state = t.ignored ? 'ignored' : stateOf(mastery, mine.length > 0);
      return { topic: t, bank, answered, tries: mine.length, mastery, state, nobank: !t.ignored && bank === 0 };
    });
    const act = topics.filter((x) => !x.topic.ignored);
    const touched = act.filter((x) => x.tries > 0).length;
    const inBank = act.filter((x) => x.bank > 0).length;
    const mastered = act.filter((x) => x.state === 'dominado').length;
    const weak = act.filter((x) => x.state === 'fragil').length;
    const unseenQ = qs.filter((q) => !seenQ.has(q.id)).length;
    const exhausted = act.length > 0 && inBank === act.length && touched === act.length && unseenQ === 0 && qs.length > 0;
    return {
      material, topics, total: act.length, touched, inBank, mastered, weak,
      questions: qs.length, seen: qs.length - unseenQ, unseen: unseenQ,
      usage: act.length ? touched / act.length : 0,
      bankCoverage: act.length ? inBank / act.length : 0,
      masteryRate: act.length ? mastered / act.length : 0,
      avgMastery: act.length ? Q.avg(act.map((x) => x.mastery)) : 0,
      exhausted,
    };
  };

  E.coverageAll = (f = {}) => E.materials(f).map((m) => E.coverage(m));

  /* ---------- montagem de prova ---------- */
  E.questionHistory = () => {
    const h = new Map();
    S().attempts
      .slice()
      .sort((a, b) => a.at - b.at)
      .forEach((at) =>
        at.answers.forEach((an) => {
          const x = h.get(an.qid) || { seen: 0, last: null, wrong: 0 };
          x.seen++;
          x.last = an;
          if (!an.correct) x.wrong++;
          h.set(an.qid, x);
        })
      );
    return h;
  };

  /** exclude: ids de temas (slides) que o usuário desmarcou; enamed: inclui questões ENAMED vinculadas. */
  E.pool = (materialIds, exclude, enamed) => {
    const ids = new Set(materialIds);
    const ex = new Set(exclude || []);
    const valid = (q) => q.options && q.options.length === 4 && q.options.every((o) => String(o || '').trim());
    return S().questions.filter((q) => ids.has(q.materialId) && valid(q) && (enamed || q.origin !== 'enamed') &&
      !((q.topicIds || []).length && q.topicIds.every((t) => ex.has(t))));
  };

  /**
   * strategy: 'cobertura' (priorizar temas inéditos) | 'fraquezas' | 'misto' | 'aleatorio'
   * Retorna uma sessão pronta: { items:[{qid, order, pos}], key:'…' }.
   */
  E.buildSession = (opts) => {
    const rnd = opts.rnd || Math.random;
    const hist = E.questionHistory();
    const mats = opts.materialIds.map(Q.Store.material).filter(Boolean);
    const covBy = new Map(mats.map((m) => [m.id, E.coverage(m)]));
    const topicInfo = new Map();
    covBy.forEach((c) => c.topics.forEach((t) => topicInfo.set(t.topic.id, t)));
    let pool = E.pool(opts.materialIds, opts.excludeTopicIds, opts.enamed);
    if (opts.onlyIds) pool = pool.filter((q) => opts.onlyIds.includes(q.id));
    const useImages = opts.useImages !== false;
    const hasImg = (q) => (q.imageIds || []).length > 0;
    if (!useImages) pool = pool.filter((q) => !hasImg(q)); // questões que dependem de figura ficam de fora
    const n = Math.min(opts.n, pool.length);
    const strategy = opts.strategy || 'misto';

    const score = (q) => {
      const h = hist.get(q.id);
      const tinfo = (q.topicIds || []).map((id) => topicInfo.get(id)).filter(Boolean);
      const fresh = tinfo.filter((t) => t.tries === 0).length;
      const lowM = tinfo.length ? Q.avg(tinfo.map((t) => 1 - t.mastery)) : 0.5;
      const cob = fresh * 3 + (h ? 0 : 2) - (h ? h.seen * 0.4 : 0);
      const fra = lowM * 3 + (h && h.last && !h.last.correct ? 2.5 : 0) + (h && h.last && h.last.conf !== 'sure' ? 0.8 : 0) + (h ? 0 : 0.5);
      let s = strategy === 'cobertura' ? cob : strategy === 'fraquezas' ? fra : strategy === 'aleatorio' ? 0 : (cob + fra) / 1.6;
      if (G.lint(q).some((i) => i.level === 'bad')) s -= 4; // questões com pistas ficam por último
      return s + rnd() * 1.4;
    };
    const ranked = pool.map((q) => ({ q, s: score(q) })).sort((a, b) => b.s - a.s).map((x) => x.q);

    // Seleção com teto de "certa é a mais longa" (≈ acaso) para não premiar quem marca a maior.
    const cap = Math.max(1, Math.floor(n * 0.25) + (n >= 8 ? 1 : 0));
    // Imagens só onde há necessidade de aprendizado: no máx. ~25% da prova.
    const imgCap = Math.max(1, Math.ceil(n * 0.25));
    const chosen = [];
    const enCap = Math.max(1, Math.ceil(n * 0.25));
    let biased = 0, imgs = 0, enams = 0;
    for (const q of ranked) {
      if (chosen.length >= n) break;
      if (G.isLengthBiased(q) && biased >= cap) continue;
      if (hasImg(q) && imgs >= imgCap) continue;
      if (q.origin === 'enamed' && enams >= enCap) continue;
      if (G.isLengthBiased(q)) biased++;
      if (hasImg(q)) imgs++;
      if (q.origin === 'enamed') enams++;
      chosen.push(q);
    }
    for (const q of ranked) {
      if (chosen.length >= n) break;
      if (chosen.includes(q) || (hasImg(q) && imgs >= imgCap) || (q.origin === 'enamed' && enams >= enCap)) continue;
      if (hasImg(q)) imgs++;
      if (q.origin === 'enamed') enams++;
      chosen.push(q);
    }
    for (const q of ranked) {
      if (chosen.length >= n) break;
      if (!chosen.includes(q)) chosen.push(q);
    }
    const ordered = Q.shuffle(chosen, rnd);
    const fixed = ordered.map((q) => (q.fixedOrder ? q.correct : null));
    const keyIdx = G.makeKey(ordered.length, fixed, S().settings.maxRun || 2, rnd);
    const items = ordered.map((q, i) => ({ qid: q.id, pos: keyIdx[i], order: G.arrange(q, keyIdx[i], rnd), a: null }));
    return {
      id: Q.uid('ses'),
      startedAt: Date.now(),
      mode: opts.mode || 'prova',
      strategy,
      scope: { materialIds: opts.materialIds.slice(), filter: opts.filter || {} },
      timerMin: opts.timerMin || 0,
      useImages, enamed: !!opts.enamed,
      idx: 0,
      items,
      key: keyIdx.map((k) => Q.LETTERS[k]).join(''),
    };
  };

  /* ---------- fechamento da prova ---------- */
  E.finish = (session) => {
    const letters = session.items.map((it) => (it.a ? it.a.chosenPos : -1));
    const sus = G.patternSuspects(letters);
    const answers = session.items
      .map((it, i) => {
        if (!it.a) return null;
        const q = Q.Store.question(it.qid);
        if (!q) return null;
        const chosenOrig = it.order[it.a.chosenPos];
        const fast = G.tooFast(it.a.ms, q);
        const patt = sus.has(i);
        const correct = chosenOrig === q.correct;
        const an = {
          qid: q.id, materialId: q.materialId, topicIds: q.topicIds || [],
          order: it.order, pos: it.pos, chosenPos: it.a.chosenPos, chosenOrig, correct,
          conf: it.a.conf, ms: it.a.ms, fast, patt, suspect: fast || patt,
        };
        return an;
      })
      .filter(Boolean);
    const attempt = {
      id: session.id, at: Date.now(), startedAt: session.startedAt, durationMs: Date.now() - session.startedAt,
      mode: session.mode, strategy: session.strategy, scope: session.scope, key: session.key,
      requested: session.items.length, answers,
    };
    attempt.summary = E.summarize(answers);
    return attempt;
  };

  /* ---------- insights (valoriza conquistas e sugere melhorias) ---------- */
  E.insights = (attempt) => {
    const wins = [], tips = [];
    const sm = attempt.summary;
    const prev = S().attempts.filter((a) => a.at < attempt.at).sort((a, b) => b.at - a.at)[0];
    const pct = (x) => Math.round(x * 100) + '%';

    const matIds = [...new Set(attempt.answers.map((a) => a.materialId))];
    const covNow = matIds.map((id) => E.coverage(Q.Store.material(id))).filter(Boolean);
    const covBefore = matIds.map((id) => E.coverage(Q.Store.material(id), S().attempts.filter((a) => a.at < attempt.at)));

    if (sm.real >= 0.8) wins.push({ icon: '🏆', title: 'Domínio real excelente', text: `Seu domínio real foi de ${pct(sm.real)} — acertos com segurança e sem sinais de chute.` });
    else if (sm.real >= 0.6) wins.push({ icon: '📈', title: 'Base sólida', text: `Domínio real de ${pct(sm.real)}. Você está acima da metade do caminho; os pontos abaixo mostram onde ganhar os últimos pontos.` });
    if (prev && sm.real - prev.summary.real >= 0.05)
      wins.push({ icon: '🚀', title: 'Evolução', text: `Seu domínio real subiu ${Math.round((sm.real - prev.summary.real) * 100)} pontos em relação à prova anterior.` });
    const sure = attempt.answers.filter((a) => a.conf === 'sure');
    if (sure.length >= 5 && sure.filter((a) => a.correct).length / sure.length >= 0.85)
      wins.push({ icon: '🎯', title: 'Boa calibragem', text: `Quando você disse "tenho certeza", acertou ${pct(sure.filter((a) => a.correct).length / sure.length)}. Você sabe o que sabe.` });
    if (sm.n >= 5 && sm.integrity === 1) wins.push({ icon: '🛡️', title: 'Prova íntegra', text: 'Nenhum padrão de chute detectado: tempo de leitura adequado e marcações variadas.' });
    let streak = 0, best = 0;
    attempt.answers.forEach((a) => {
      streak = a.correct && a.conf !== 'guess' ? streak + 1 : 0;
      best = Math.max(best, streak);
    });
    if (best >= 4) wins.push({ icon: '🔥', title: `Sequência de ${best} acertos`, text: 'Maior sequência de acertos conscientes nesta prova.' });
    covNow.forEach((c, i) => {
      const gain = c.touched - covBefore[i].touched;
      if (gain > 0) wins.push({ icon: '🧭', title: `+${gain} tema${gain > 1 ? 's' : ''} explorado${gain > 1 ? 's' : ''}`, text: `${c.material.title}: agora ${c.touched}/${c.total} temas já foram cobrados (${pct(c.usage)} do conteúdo).` });
      if (c.exhausted) wins.push({ icon: '✅', title: 'Conteúdo exaurido', text: `Você respondeu todas as questões e tocou todos os temas de “${c.material.title}”.` });
    });
    const newlyMastered = covNow.reduce((s, c, i) => s + (c.mastered - covBefore[i].mastered), 0);
    if (newlyMastered > 0) wins.push({ icon: '🧠', title: `${newlyMastered} tema${newlyMastered > 1 ? 's' : ''} dominado${newlyMastered > 1 ? 's' : ''}`, text: 'Novos temas passaram para o nível “Dominado” com respostas consistentes e confiantes.' });

    /* ---- melhorias ---- */
    const weak = [];
    covNow.forEach((c) =>
      c.topics.filter((x) => !x.topic.ignored && x.tries > 0 && x.state === 'fragil').forEach((x) => weak.push({ c, x }))
    );
    weak.sort((a, b) => a.x.mastery - b.x.mastery);
    if (weak.length)
      tips.push({
        icon: '🩹', title: 'Revise estes slides',
        text: weak.slice(0, 4).map((w) => `Slide ${w.x.topic.n} — ${w.x.topic.title}`).join(' · '),
        action: { label: 'Treinar pontos frágeis', act: 'drill-weak' },
      });
    if (sm.overconf >= 2) tips.push({ icon: '⚠️', title: 'Erros com certeza', text: `Você errou ${sm.overconf} questões marcando “certeza”. São os conceitos mais perigosos: releia a explicação de cada uma.` });
    if (sm.n && sm.guesses / sm.n >= 0.25) tips.push({ icon: '🎲', title: 'Muitos chutes assumidos', text: `${sm.guesses} respostas (${pct(sm.guesses / sm.n)}) foram chutes. Acertos por chute não contam no domínio real — estude esses temas antes de arriscar.` });
    if (sm.n && sm.fast / sm.n >= 0.2) tips.push({ icon: '⏱️', title: 'Leitura apressada', text: `${sm.fast} respostas vieram rápido demais para uma leitura completa. Leia todas as alternativas antes de decidir.` });
    if (sm.patt > 0) tips.push({ icon: '🔁', title: 'Padrão de marcação', text: `Detectamos ${sm.patt} respostas em sequência suspeita (mesma letra ou escada). O gabarito é balanceado — não existe padrão a explorar.` });
    const lc = [0, 0, 0, 0];
    attempt.answers.forEach((a) => lc[a.chosenPos]++);
    if (sm.n >= 8 && Math.max(...lc) / sm.n > 0.45) tips.push({ icon: '🔤', title: 'Preferência por uma letra', text: `Você marcou a letra ${Q.LETTERS[lc.indexOf(Math.max(...lc))]} em ${pct(Math.max(...lc) / sm.n)} das questões. Isso costuma indicar chute por viés.` });
    covNow.forEach((c) => {
      const left = c.total - c.touched;
      if (left > 0) tips.push({ icon: '🗺️', title: `${left} tema${left > 1 ? 's' : ''} ainda não cobrado${left > 1 ? 's' : ''}`, text: `${c.material.title}: faltam ${left} de ${c.total} temas. Faça um simulado focado em cobertura.`, action: { label: 'Explorar o que falta', act: 'drill-new' } });
      const nob = c.topics.filter((x) => x.nobank);
      if (nob.length) tips.push({ icon: '📝', title: 'Temas sem questões no banco', text: `${c.material.title}: ${nob.slice(0, 4).map((x) => 'slide ' + x.topic.n).join(', ')}${nob.length > 4 ? '…' : ''} não têm nenhuma questão — o conteúdo não pode ser exaurido sem elas.`, action: { label: 'Criar questões', href: '#/banco/' + c.material.id } });
    });
    if (!tips.length) tips.push({ icon: '🌟', title: 'Sem pontos críticos', text: 'Continue variando os materiais e refaça provas espaçadas para consolidar a memória.' });
    return { wins, tips };
  };

  /** Justificativa de uma alternativa errada, extraída do material quando a questão não traz a sua. */
  E.whyNot = (q, optIdx) => {
    if (q.whyNot && q.whyNot[optIdx]) return q.whyNot[optIdx];
    const m = Q.Store.material(q.materialId);
    const tk = (s) => new Set(String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]{4,}/g) || []);
    const ot = tk(q.options[optIdx]);
    let best = null;
    // só aponta um trecho quando a alternativa tem conteúdo suficiente para uma correspondência confiável
    if (m && ot.size >= 2) m.topics.filter((t) => !t.ignored).forEach((t) => (t.text || '').split('\n').forEach((l) => {
      const hit = [...tk(l)].filter((w) => ot.has(w)).length;
      if (hit >= 2 && hit >= Math.ceil(ot.size * 0.6) && (!best || hit > best.hit)) best = { hit, t, l: l.trim() };
    }));
    if (!best) return 'Essa alternativa não é a que o material indica para o que foi perguntado. Veja abaixo a justificativa da correta.';
    const same = (q.topicIds || []).includes(best.t.id);
    return same ? `O slide ${best.t.n} diz: “${best.l}”. Isso não responde ao que foi perguntado.` : `Esse conteúdo aparece em outro ponto do material (slide ${best.t.n}, “${best.t.title}”: “${best.l}”) e não responde ao que foi perguntado.`;
  };

  /* ---------- “tentativa ao vivo”: alerta de letra repetida ---------- */
  E.liveWarning = (session) => {
    const letters = session.items.filter((it) => it.a).map((it) => it.a.chosenPos);
    if (letters.length >= 3 && G.tailRun(letters) >= 3) return `Você marcou a letra ${Q.LETTERS[letters[letters.length - 1]]} ${G.tailRun(letters)} vezes seguidas. O gabarito é balanceado — releia com calma.`;
    return null;
  };
})();
