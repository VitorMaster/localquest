/* Localquest — núcleo das disputas (estilo Kahoot): montagem, pontuação e classificação.
 * Duas formas: "casa" (assíncrona, cada um responde dentro de uma janela de datas) e "live" (ao vivo, comandada pelo anfitrião).
 * A resposta certa NÃO viaja em texto claro: guarda-se o hash (SHA-256) da alternativa certa e cada participante confere
 * localmente. É proteção leve, adequada a grupos de estudo — não é um sistema à prova de fraude. */
(function () {
  const Q = window.Q;
  const D = (Q.Duel = {});

  D.code = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

  D.hash = async (code, i, text) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${code}|${i}|${String(text).trim()}`));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  /** Hashes das 4 alternativas de cada questão (para conferir respostas sem expor o gabarito). */
  const cache = new Map();
  D.hashes = async (duel) => {
    const key = duel.code + ':' + duel.questions.length + ':' + (duel.questions[0] || {}).h;
    if (cache.has(key)) return cache.get(key);
    const out = [];
    for (let i = 0; i < duel.questions.length; i++) out.push(await Promise.all(duel.questions[i].o.map((t) => D.hash(duel.code, i, t))));
    cache.set(key, out);
    return out;
  };
  D.isCorrect = (duel, hashes, i, choice) => !!(hashes[i] && hashes[i][choice] && hashes[i][choice] === duel.questions[i].h);

  /** Pontos estilo Kahoot: 500–1000 conforme a rapidez; erro ou fora do tempo = 0. */
  D.points = (correct, ms, tsec) => {
    const T = tsec * 1000;
    if (!correct || ms == null || ms > T + 500) return 0;
    return Math.round(1000 * (1 - 0.5 * Math.min(ms, T) / T));
  };

  /**
   * Monta uma disputa a partir do banco local. As questões já saem com as alternativas embaralhadas pelo
   * gabarito controlado (sem sequências de letras iguais). Questões com figura ficam de fora.
   */
  D.build = async (o) => {
    const code = o.code || D.code();
    const ses = Q.Engine.buildSession({ materialIds: o.materialIds, n: o.n, strategy: 'aleatorio', useImages: false, enamed: false, excludeTopicIds: o.excludeTopicIds });
    const questions = [];
    for (let i = 0; i < ses.items.length; i++) {
      const it = ses.items[i], q = Q.Store.question(it.qid);
      const opts = it.order.map((x) => q.options[x]);
      questions.push({
        s: q.stem, o: opts, h: await D.hash(code, i, opts[it.pos]),
        e: q.explanation || '', w: it.order.map((x, p) => (p === it.pos ? '' : Q.Engine.whyNot(q, x))),
      });
    }
    return {
      code, title: o.title, kind: o.kind, group: o.group || '', host: o.host, hostNick: o.hostNick || '', createdAt: Date.now(),
      tsec: o.tsec, opensAt: o.opensAt || 0, closesAt: o.closesAt || 0, startsAt: o.startsAt || 0,
      state: { phase: 'lobby', q: 0, qStart: 0 }, questions,
    };
  };

  /** players: [{uid,nick,answers:{i:{c,ms}}}] → ranking [{uid,nick,c,pts,ms,answered}] (acertos > pontos > tempo). */
  D.board = (duel, hashes, players, upTo) => {
    const last = upTo == null ? duel.questions.length - 1 : upTo;
    const rows = players.map((p) => {
      let c = 0, pts = 0, ms = 0, answered = 0;
      Object.entries(p.answers || {}).forEach(([k, a]) => {
        const i = +k;
        if (i > last || !duel.questions[i]) return;
        answered++;
        const ok = D.isCorrect(duel, hashes, i, a.c);
        const valid = ok && a.ms <= duel.tsec * 1000 + 500;
        if (valid) c++;
        pts += D.points(ok, a.ms, duel.tsec);
        ms += a.ms || 0;
      });
      return { uid: p.uid, nick: p.nick || 'Anônimo', c, pts, ms, answered };
    });
    rows.sort((a, b) => b.c - a.c || b.pts - a.pts || a.ms - b.ms);
    rows.forEach((r, i) => (r.pos = i > 0 && r.c === rows[i - 1].c && r.pts === rows[i - 1].pts ? rows[i - 1].pos : i + 1));
    return rows;
  };

  /** Situação na agenda: 'soon' | 'open' | 'closed' | 'live-lobby' | 'live-on' | 'live-done'. */
  D.status = (d, now = Date.now()) => {
    if (d.kind === 'live') return d.state.phase === 'done' ? 'live-done' : d.state.phase === 'lobby' ? 'live-lobby' : 'live-on';
    if (d.opensAt && now < d.opensAt) return 'soon';
    if (d.closesAt && now > d.closesAt) return 'closed';
    return 'open';
  };

  D.countdown = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}min` : m ? `${m}min` : `${s}s`;
  };
})();
