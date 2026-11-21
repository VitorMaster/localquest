/* Localquest — Disputas (estilo Kahoot): em casa (cada um responde na sua hora) e ao vivo (todos juntos), com Agenda. */
(function () {
  const Q = window.Q, V = Q.V, E = Q.Engine, D = Q.Duel, esc = Q.esc;
  const S = () => Q.Store.state;
  const COLORS = ['ka', 'kb', 'kc', 'kd'];

  let be = null, demoMode = false, duels = {}, docs = [], groups = {}, unsubs = [];
  let tab = 'agenda', cur = null, hashes = null, hashesCode = null;
  let run = null, liveAns = {}, liveKey = '', t0 = 0, tickId = null, hostKey = '', agendaId = null, keyH = null;

  /* ====================== backends ====================== */
  const clone = (x) => JSON.parse(JSON.stringify(x));

  const dbBackend = async () => {
    if (!window.claude || !window.claude.use) return null;
    const db = await window.claude.use('db'), user = await window.claude.use('user');
    if (!db || !user) return null;
    const id = await user.id();
    if (!id) return null;
    let q = Promise.resolve();
    const run1 = (fn) => (q = q.then(fn).catch((e) => { console.warn(e); Q.toast('Não consegui salvar na disputa agora.', 'warn'); }));
    const touch = (code, nick, patch) =>
      run1(async () => {
        const ref = db.doc('duelplayers/' + id);
        const snap = await ref.get();
        const body = { d: { [code]: Object.assign({ nick }, patch) } };
        if (snap.exists) await ref.update(body); else await ref.set(body);
      });
    return {
      id,
      watchDuels: (cb) => db.collection('duels').onSnapshot((s) => cb(s.docs.map((d) => Object.assign({ code: d.id }, d.data()))), () => {}),
      watchPlayers: (cb) => db.collection('duelplayers').onSnapshot((s) => cb(s.docs.map((d) => ({ uid: d.id, d: (d.data() || {}).d || {} }))), () => {}),
      watchGroups: (cb) => db.collection('groups').onSnapshot((s) => { const g = {}; s.docs.forEach((d) => (g[d.id] = d.data())); cb(g); }, () => {}),
      saveDuel: (d) => run1(() => db.doc('duels/' + d.code).set(d)),
      patchState: (code, state) => run1(() => db.doc('duels/' + code).update({ state })),
      join: (code, nick) => touch(code, nick, { joinedAt: Date.now() }),
      answer: (code, nick, i, a) => touch(code, nick, { answers: { [i]: a } }),
    };
  };

  /** Backend local com bots — só para demonstração; nada sai do navegador. */
  const localBackend = () => {
    const L = { duels: {}, docs: {}, subs: { d: [], p: [], g: [] } };
    const emit = (k) => L.subs[k].forEach((f) => f());
    const sub = (k, f) => { L.subs[k].push(f); setTimeout(f, 0); return () => (L.subs[k] = L.subs[k].filter((x) => x !== f)); };
    const BOTS = [['Bia', 0.85], ['Carlos', 0.7], ['Dani', 0.6], ['Fernanda', 0.78], ['Eduardo', 0.5]];
    const doc = (uid) => (L.docs[uid] = L.docs[uid] || { uid, d: {} });
    const put = (uid, code, nick, i, a) => { const e = (doc(uid).d[code] = doc(uid).d[code] || { nick, answers: {} }); if (a) e.answers[i] = a; emit('p'); };
    const botsPlay = async (code, state) => {
      const d = L.duels[code]; if (!d || state.phase !== 'question') return;
      const hs = await D.hashes(d);
      const right = [0, 1, 2, 3].find((c) => hs[state.q][c] === d.questions[state.q].h);
      BOTS.forEach(([n, skill], k) => setTimeout(() => {
        const cur = L.duels[code];
        if (!cur || cur.state.q !== state.q || cur.state.phase !== 'question') return;
        const ok = Math.random() < skill;
        const c = ok ? right : [0, 1, 2, 3].filter((x) => x !== right)[Math.floor(Math.random() * 3)];
        put('bot_' + k, code, n, state.q, { c, ms: Math.round(1200 + Math.random() * d.tsec * 1000 * 0.7) });
      }, 700 + Math.random() * d.tsec * 700));
    };
    return {
      id: 'demo_me', demo: true,
      watchDuels: (cb) => sub('d', () => cb(Object.values(L.duels).map(clone))),
      watchPlayers: (cb) => sub('p', () => cb(Object.values(L.docs).map(clone))),
      watchGroups: (cb) => sub('g', () => cb({ DEMO: { name: 'Turma de estudo (demonstração)' } })),
      saveDuel: async (d) => { L.duels[d.code] = clone(d); emit('d'); BOTS.forEach(([n], k) => setTimeout(() => put('bot_' + k, d.code, n), 500 + k * 450)); },
      patchState: async (code, state) => { L.duels[code].state = state; emit('d'); botsPlay(code, state); },
      join: async (code, nick) => put('demo_me', code, nick),
      answer: async (code, nick, i, a) => put('demo_me', code, nick, i, a),
    };
  };

  const stopSubs = () => { unsubs.forEach((u) => u && u()); unsubs = []; };
  const startSubs = () => {
    stopSubs();
    unsubs.push(be.watchDuels((l) => { duels = Object.fromEntries(l.map((d) => [d.code, d])); onData(); }));
    unsubs.push(be.watchPlayers((l) => { docs = l; onData(); }));
    unsubs.push(be.watchGroups((g) => { groups = g; onData(); }));
  };
  const onData = Q.debounce(() => repaint(false), 90);

  const playersOf = (code) => docs.filter((x) => x.d && x.d[code]).map((x) => ({ uid: x.uid, nick: x.d[code].nick || 'Anônimo', answers: x.d[code].answers || {}, joinedAt: x.d[code].joinedAt }));
  const myGroups = () => S().settings.groups || [];
  const nick = () => S().settings.nick || '';
  const gname = (g) => (g && (groups[g] || {}).name) || (g ? 'Grupo ' + g : 'Sem grupo');

  /* ====================== helpers de tela ====================== */
  const fmtDT = (t) => (t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '') : '—');
  const toLocalInput = (t) => { const d = new Date(t); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const medal = (p) => (p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : p);

  const ensureHashes = async (d) => {
    if (hashesCode === d.code && hashes) return;
    hashes = await D.hashes(d);
    hashesCode = d.code;
    repaint();
  };

  const boardHTML = (d, rows, o = {}) => {
    const max = Math.max(1, ...rows.map((r) => r.pts));
    return `<div class="lb">${rows.slice(0, o.top || 50).map((r) => `<div class="lb-r ${r.uid === be.id ? 'me' : ''}"><span class="lb-p">${medal(r.pos)}</span><span class="lb-n">${esc(r.nick)}${r.uid === be.id ? ' <span class="badge b-info">você</span>' : ''}</span>
      <span class="lb-bar"><i style="width:${Math.max(4, (r.pts / max) * 100)}%"></i></span><span class="lb-c"><b>${r.c}</b>/${d.questions.length}</span><span class="lb-s">${r.pts.toLocaleString('pt-BR')} pts</span></div>`).join('')}</div>`;
  };

  const podium = (rows) => {
    const [a, b, c] = rows;
    const slot = (r, cls, m) => (r ? `<div class="pd ${cls}"><div class="pd-n">${esc(r.nick)}</div><div class="pd-b"><span>${m}</span><b>${r.c}</b><small>${r.pts.toLocaleString('pt-BR')} pts</small></div></div>` : '<div class="pd"></div>');
    return `<div class="podium">${slot(b, 'p2', '🥈')}${slot(a, 'p1', '🥇')}${slot(c, 'p3', '🥉')}</div>`;
  };

  const tiles = (q, o = {}) =>
    `<div class="kt">${q.o.map((t, i) => {
      let cls = COLORS[i];
      if (o.reveal) cls += o.right === i ? ' right' : ' dim';
      if (o.pick === i) cls += ' picked' + (o.reveal && o.right !== i ? ' wrong' : '');
      return `<button class="kt-o ${cls}" data-act="du-pick" data-c="${i}" ${o.lock ? 'disabled' : ''}><span class="kt-l">${Q.LETTERS[i]}</span><span>${esc(t)}</span></button>`;
    }).join('')}</div>`;

  /* ====================== AGENDA / CRIAR / ENTRAR ====================== */
  const visible = () =>
    Object.values(duels).filter((d) => d.host === be.id || myGroups().includes(d.group) || playersOf(d.code).some((p) => p.uid === be.id) || demoMode);

  const statusBadge = (d) => {
    const s = D.status(d);
    return { soon: '<span class="badge b-info">abre em ' + D.countdown(d.opensAt - Date.now()) + '</span>', open: '<span class="badge b-good">aberta' + (d.closesAt ? ' · fecha em ' + D.countdown(d.closesAt - Date.now()) : '') + '</span>', closed: '<span class="badge b-mute">encerrada</span>',
      'live-lobby': '<span class="badge b-warn">sala aberta' + (d.startsAt ? ' · ' + fmtDT(d.startsAt) : '') + '</span>', 'live-on': '<span class="badge b-bad">● ao vivo agora</span>', 'live-done': '<span class="badge b-mute">finalizada</span>' }[s];
  };

  const card = (d) => {
    const mine = d.host === be.id;
    const pl = playersOf(d.code);
    const s = D.status(d);
    const done = Object.keys((pl.find((p) => p.uid === be.id) || { answers: {} }).answers).length;
    const cta = d.kind === 'casa'
      ? (s === 'open' ? `<a class="btn primary sm" href="#/disputas/${d.code}">${done >= d.questions.length ? 'Ver ranking' : done ? '▶ Continuar' : '▶ Responder'}</a>` : `<a class="btn sm" href="#/disputas/${d.code}">Ver ranking</a>`)
      : (s === 'live-done' ? `<a class="btn sm" href="#/disputas/${d.code}">Ver pódio</a>` : `<a class="btn primary sm" href="#/disputas/${d.code}">${mine ? '🎙 Abrir sala' : '⚡ Entrar'}</a>`);
    return `<div class="card tight du-card"><div class="row between wrap gap"><div><span class="chip">${d.kind === 'casa' ? '🏠 Em casa' : '⚡ Ao vivo'}</span> ${statusBadge(d)}</div><code class="k">${d.code}</code></div>
      <h3 style="margin:10px 0 4px">${esc(d.title)}</h3>
      <p class="muted" style="margin:0 0 10px"><small>${esc(gname(d.group))} · ${d.questions.length} questões · ${d.tsec}s cada${d.kind === 'casa' ? ` · ${fmtDT(d.opensAt)} → ${fmtDT(d.closesAt)}` : ''} · ${pl.length} participante(s)</small></p>
      <div class="row gap wrap">${cta}<button class="btn sm ghost" data-act="du-copy" data-code="${d.code}">Copiar código</button>${mine && d.kind === 'casa' ? `<button class="btn sm danger" data-act="du-del" data-code="${d.code}">Excluir</button>` : ''}</div></div>`;
  };

  const agendaHTML = () => {
    const list = visible().sort((a, b) => (b.opensAt || b.startsAt || b.createdAt) - (a.opensAt || a.startsAt || a.createdAt));
    const grp = [
      ['🔥 Acontecendo agora', list.filter((d) => ['open', 'live-on', 'live-lobby'].includes(D.status(d)))],
      ['📅 Em breve', list.filter((d) => D.status(d) === 'soon')],
      ['✅ Encerradas', list.filter((d) => ['closed', 'live-done'].includes(D.status(d)))],
    ];
    return `<p class="muted">Organize quando cada disputa acontece. As disputas <b>em casa</b> ficam abertas numa janela de datas; as <b>ao vivo</b> têm horário combinado e começam quando o anfitrião inicia a sala.</p>
      ${list.length ? grp.filter((g) => g[1].length).map(([t, l]) => `<h3 class="mt">${t}</h3><div class="grid g-auto">${l.map(card).join('')}</div>`).join('') : `<div class="empty"><div class="big">⚔️</div><h3>Nenhuma disputa ainda</h3><p class="muted">Crie a primeira na aba <b>Criar</b>, ou veja como funciona com bots.</p><button class="btn" data-act="du-demo">🎮 Demonstração ao vivo com bots</button></div>`}`;
  };

  const createHTML = () => {
    const mats = S().materials.filter((m) => Q.Store.questionsOf(m.id).length);
    if (!mats.length) return '<div class="empty"><div class="big">📚</div><p class="muted">Envie um material na Biblioteca para criar uma disputa com as suas questões.</p><a class="btn primary" href="#/biblioteca">Ir para a Biblioteca</a></div>';
    const now = Date.now();
    return `<div class="grid g2"><div class="card">
      <div class="field"><label>Título da disputa</label><input type="text" id="dc-title" placeholder="Ex.: Desafio de Geriatria — semana 3" maxlength="60"></div>
      <div class="field"><label>Formato</label><div class="grid g2"><button class="opt-card on" data-act="dc-kind" data-k="casa" id="dc-k-casa"><span class="em">🏠</span><span><b>Em casa</b><small class="muted">Cada um responde quando quiser, dentro das datas.</small></span></button>
        <button class="opt-card" data-act="dc-kind" data-k="live" id="dc-k-live"><span class="em">⚡</span><span><b>Ao vivo</b><small class="muted">Todos juntos, estilo Kahoot, comandado por você.</small></span></button></div></div>
      <div class="field"><label>Grupo</label><select id="dc-group"><option value="">Sem grupo (quem tiver o código entra)</option>${myGroups().map((g) => `<option value="${g}">${esc(gname(g))}</option>`).join('')}</select></div>
      <div class="grid g2"><div class="field"><label>Nº de questões</label><input type="number" id="dc-n" value="10" min="3" max="40"></div><div class="field"><label>Tempo por questão (s)</label><input type="number" id="dc-t" value="30" min="10" max="120"></div></div>
      <div id="dc-casa" class="grid g2"><div class="field"><label>Abre em</label><input type="datetime-local" id="dc-open" value="${toLocalInput(now)}"></div><div class="field"><label>Fecha em</label><input type="datetime-local" id="dc-close" value="${toLocalInput(now + 7 * 86400000)}"></div></div>
      <div id="dc-live" class="field" hidden><label>Horário combinado (opcional)</label><input type="datetime-local" id="dc-start" value="${toLocalInput(now + 3600000)}"><small class="muted">Só aparece na Agenda; a disputa começa quando você clicar em Iniciar.</small></div>
    </div><div class="card"><h3>Materiais das questões</h3><p class="muted"><small>As questões vêm do seu banco. Figuras ficam de fora para todos verem igual.</small></p>
      ${mats.map((m) => `<label class="opt-card mt-s" style="align-items:center"><input type="checkbox" class="dc-mat" value="${m.id}" checked style="width:20px;height:20px;accent-color:var(--accent2)"><span style="flex:1"><b>${esc(m.title)}</b><small>${esc(m.materia)} · ${Q.Store.questionsOf(m.id).length} questões</small></span></label>`).join('')}
      <button class="btn primary lg mt" data-act="dc-create">⚔️ Criar disputa</button></div></div>`;
  };

  const joinHTML = () => `<div class="card" style="max-width:520px"><h3>Entrar com um código</h3><p class="muted">Peça o código de 6 caracteres a quem criou a disputa.</p>
    <div class="row gap"><input type="text" id="dj-code" placeholder="Ex.: K7M2QX" maxlength="6" style="text-transform:uppercase"><button class="btn primary" data-act="du-join">Entrar</button></div></div>
    <div class="card mt" style="max-width:520px"><h3>🎮 Quer ver como é?</h3><p class="muted">Uma disputa ao vivo de mentirinha, com 5 colegas virtuais. Nada é enviado a ninguém.</p><button class="btn" data-act="du-demo">Iniciar demonstração com bots</button></div>`;

  const homeHTML = () => `
    <div class="page-h"><div><div class="eyebrow">Disputas</div><h1>Estudar com prazer, subir no ranking</h1><p>Responda em casa na sua hora ou entre numa sala ao vivo. Vence quem acerta mais; a rapidez desempata.</p></div></div>
    ${nick() ? '' : `<div class="card mb"><b>Escolha seu nome para aparecer nas disputas</b><div class="row gap mt-s"><input type="text" id="du-nick" placeholder="Seu nome" maxlength="30" style="max-width:300px"><button class="btn primary" data-act="du-nick">Salvar</button></div></div>`}
    <div class="seg mb">${[['agenda', '📅 Agenda'], ['criar', '➕ Criar'], ['entrar', '🔑 Entrar com código']].map(([k, l]) => `<button data-act="du-tab" data-k="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="du-body"></div>`;

  /* ====================== DETALHE ====================== */
  const detailShell = (d) => `<div class="page-h"><div><div class="eyebrow"><a href="#/disputas">← Disputas</a></div><h1>${esc(d.title)}</h1>
      <div class="row wrap gap" style="margin-top:6px"><span class="chip">${d.kind === 'casa' ? '🏠 Em casa' : '⚡ Ao vivo'}</span><span class="chip">${esc(gname(d.group))}</span><span id="du-status">${statusBadge(d)}</span><code class="k">${d.code}</code><button class="btn sm ghost" data-act="du-copy" data-code="${d.code}">Copiar código</button></div></div></div><div id="du-stage"></div>`;

  const joinedMe = (d) => playersOf(d.code).some((p) => p.uid === be.id);

  const stageCasa = (d) => {
    const pl = playersOf(d.code);
    const me = pl.find((p) => p.uid === be.id);
    const done = Object.keys((me || { answers: {} }).answers).length;
    const s = D.status(d);
    const rows = hashes ? D.board(d, hashes, pl) : [];
    let cta;
    if (run) return runHTML(d);
    if (s === 'soon') cta = `<div class="verdict todo"><span class="em">⏳</span><div><b>Ainda não abriu</b><br><small>Abre em ${D.countdown(d.opensAt - Date.now())} (${fmtDT(d.opensAt)}).</small></div></div>`;
    else if (s === 'closed') cta = `<div class="verdict todo"><span class="em">🔒</span><div><b>Encerrada em ${fmtDT(d.closesAt)}</b><br><small>O ranking final está abaixo.</small></div></div>`;
    else if (done >= d.questions.length) cta = `<div class="verdict ok"><span class="em">✅</span><div><b>Você já respondeu tudo</b><br><small>Acompanhe o ranking até ${fmtDT(d.closesAt)}.</small></div></div>`;
    else cta = `<div class="card flat row between wrap gap" style="border-color:var(--accent2)"><div><b>${done ? `Faltam ${d.questions.length - done} de ${d.questions.length} questões` : `${d.questions.length} questões · ${d.tsec}s cada`}</b><br><small class="muted">Fecha em ${D.countdown(d.closesAt - Date.now())}. Respostas são definitivas.</small></div><button class="btn primary lg" data-act="du-run">${done ? '▶ Continuar' : '▶ Responder agora'}</button></div>`;
    return `${cta}<div class="card mt"><h3>🏆 Ranking desta disputa <span class="sub">${pl.length} participante(s)</span></h3>${rows.length ? boardHTML(d, rows) : '<p class="muted">Ainda não há respostas.</p>'}
      <small class="muted">Vence quem acerta mais; a rapidez nas respostas desempata.</small></div>`;
  };

  const runHTML = (d) => {
    const q = d.questions[run.i];
    const right = run.fb ? [0, 1, 2, 3].find((c) => hashes[run.i][c] === q.h) : -1;
    const ok = run.fb && run.pick === right;
    return `<div class="exam"><div class="row between gap" style="margin-bottom:10px"><div class="segs" style="flex:1;margin:0">${d.questions.map((_, i) => `<i class="${i === run.i ? 'cur' : run.res[i] === true ? 'ok' : run.res[i] === false ? 'no' : ''}"></i>`).join('')}</div><span class="timer" id="du-time">${d.tsec}s</span></div>
      <div class="du-bar"><i id="du-bar"></i></div>
      <div class="card q-card"><div class="q-stem">${esc(q.s)}</div>${tiles(q, { lock: run.fb, reveal: run.fb, right, pick: run.pick })}
      ${run.fb ? `<div class="explain"><b>${run.pick === -1 ? '⏱ Tempo esgotado' : ok ? '✅ Você acertou' : '❌ Você errou'}</b>
        ${!ok && run.pick >= 0 ? `<div class="mt-s"><b>Por que a letra ${Q.LETTERS[run.pick]} não é a correta:</b> ${esc(q.w[run.pick] || 'Não corresponde ao que o material afirma.')}</div>` : ''}
        <div class="mt-s"><b>Por que a letra ${Q.LETTERS[right]} é a correta:</b> ${esc(q.e || 'Conforme o material.')}</div>
        <div class="row end mt"><button class="btn primary" data-act="du-next">${run.i >= d.questions.length - 1 ? 'Ver ranking' : 'Próxima →'}</button></div></div>` : ''}</div></div>`;
  };

  const stageLive = (d) => {
    const st = d.state, pl = playersOf(d.code), isHost = d.host === be.id;
    const T = d.tsec;
    const rowsAll = hashes ? D.board(d, hashes, pl, st.phase === 'lobby' ? -1 : st.q) : [];
    const joined = joinedMe(d);
    if (st.phase === 'lobby')
      return `<div class="card du-lobby"><div class="eyebrow">Sala aberta</div><div class="du-code">${d.code}</div><p class="muted">Compartilhe o código. Quem entrar aparece abaixo.</p>
        <div class="du-chips">${pl.map((p) => `<span class="chip ${p.uid === be.id ? 'on' : ''}">${esc(p.nick)}</span>`).join('') || '<span class="muted">Ninguém entrou ainda…</span>'}</div>
        <div class="row gap wrap mt" style="justify-content:center">${joined ? '' : '<button class="btn primary lg" data-act="du-joinlive">⚡ Entrar na sala</button>'}${isHost ? `<button class="btn primary lg" data-act="du-start" ${pl.length ? '' : 'disabled'}>▶ Iniciar (${d.questions.length} questões)</button>` : joined ? '<span class="muted">Aguardando o anfitrião iniciar…</span>' : ''}</div></div>`;
    if (st.phase === 'done')
      return `<div class="card"><h2 style="text-align:center">🏁 Resultado final</h2>${podium(rowsAll)}${boardHTML(d, rowsAll)}${isHost ? '' : ''}</div>`;
    const q = d.questions[st.q];
    const mine = liveAns[st.q + ':' + st.qStart] || (pl.find((p) => p.uid === be.id) || { answers: {} }).answers[st.q];
    const right = st.phase === 'reveal' ? [0, 1, 2, 3].find((c) => hashes && hashes[st.q][c] === q.h) : -1;
    const head = `<div class="row between gap" style="margin-bottom:10px"><span class="chip">Questão ${st.q + 1} de ${d.questions.length}</span><span class="timer" id="du-time">${T}s</span></div><div class="du-bar"><i id="du-bar"></i></div>`;
    if (st.phase === 'question') {
      const answeredN = pl.filter((p) => p.answers[st.q]).length;
      return `<div class="exam">${head}<div class="card q-card"><div class="q-stem">${esc(q.s)}</div>${tiles(q, { lock: !!mine || !joined, pick: mine ? mine.c : null })}
        <div class="row between wrap gap mt-s"><small class="muted">${mine ? '✔ Resposta enviada. Aguarde o fim do tempo…' : joined ? 'Escolha uma alternativa (teclas A–D).' : 'Entre na sala para responder.'}</small><small class="muted">${answeredN}/${pl.length} responderam</small></div>
        ${isHost ? '<div class="row end mt-s"><button class="btn sm" data-act="du-reveal">Revelar agora</button></div>' : ''}</div></div>`;
    }
    // reveal
    const ok = mine && mine.c === right;
    const myRow = rowsAll.find((r) => r.uid === be.id);
    const myPts = mine ? D.points(ok, mine.ms, T) : 0;
    const last = st.q >= d.questions.length - 1;
    return `<div class="exam">${head}<div class="card q-card"><div class="q-stem">${esc(q.s)}</div>${tiles(q, { lock: true, reveal: true, right, pick: mine ? mine.c : null })}
      <div class="explain"><b>${!mine ? '⏱ Você não respondeu' : ok ? `✅ Correto! +${myPts} pontos` : '❌ Não foi dessa vez'}</b>
        ${mine && !ok ? `<div class="mt-s"><b>Por que a letra ${Q.LETTERS[mine.c]} não é a correta:</b> ${esc(q.w[mine.c] || 'Não corresponde ao que o material afirma.')}</div>` : ''}
        <div class="mt-s"><b>Por que a letra ${Q.LETTERS[right]} é a correta:</b> ${esc(q.e || 'Conforme o material.')}</div></div>
      <h3 class="mt">Classificação</h3>${boardHTML(d, rowsAll, { top: 5 })}${myRow && myRow.pos > 5 ? `<small class="muted">Você está em ${myRow.pos}º lugar.</small>` : ''}
      ${isHost ? `<div class="row end mt"><button class="btn primary lg" data-act="du-nextlive">${last ? '🏁 Ver pódio' : 'Próxima ▶'}</button></div>` : '<p class="muted mt-s">Aguardando o anfitrião…</p>'}</div></div>`;
  };

  /* ====================== pintura ====================== */
  const paintHome = () => {
    const b = Q.$('#du-body');
    if (!b) return;
    b.innerHTML = tab === 'agenda' ? agendaHTML() : tab === 'criar' ? createHTML() : joinHTML();
    Q.Store.hydrateImages(b);
    Q.applyTips && Q.applyTips(b);
  };
  const paintDetail = () => {
    const d = duels[cur];
    const st = Q.$('#du-stage');
    if (!d || !st) return;
    ensureHashes(d);
    const sb = Q.$('#du-status'); if (sb) sb.innerHTML = statusBadge(d);
    if (d.kind === 'live' && d.state.phase !== 'lobby') { const k = d.state.q + ':' + d.state.qStart; if (k !== liveKey) { liveKey = k; t0 = Date.now(); } }
    st.innerHTML = !hashes ? '<p class="muted">Carregando…</p>' : d.kind === 'casa' ? stageCasa(d) : stageLive(d);
    Q.applyTips && Q.applyTips(st);
    liveTick();
  };
  const repaint = (force) => {
    if (!Q.$('#du-root')) return;
    if (cur) {
      const d = duels[cur];
      if (d && !Q.$('#du-stage')) Q.$('#du-root').innerHTML = detailShell(d);
      if (d) { hostLogic(d); paintDetail(); }
      else Q.$('#du-root').innerHTML = '<div class="card empty"><div class="big">🔎</div><h3>Disputa não encontrada</h3><p class="muted">Confira o código. Ela pode ter sido excluída.</p><a class="btn" href="#/disputas">Voltar</a></div>';
    } else if (force === true || tab === 'agenda') paintHome();
  };

  /* ====================== ao vivo: relógio e anfitrião ====================== */
  const liveTick = () => {
    const d = duels[cur];
    const bar = Q.$('#du-bar'), tm = Q.$('#du-time');
    if (!d || !bar) return;
    const T = d.tsec * 1000;
    let el;
    if (d.kind === 'live') {
      if (d.state.phase === 'reveal') el = T;
      else {
        const k = d.state.q + ':' + d.state.qStart;
        if (k !== liveKey) { liveKey = k; t0 = Date.now(); }
        el = Date.now() - t0;
      }
    } else el = run && !run.fb ? Date.now() - run.t0 : T;
    const left = Math.max(0, T - el);
    bar.style.width = (left / T) * 100 + '%';
    bar.classList.toggle('low', left < 5000);
    if (tm) tm.textContent = Math.ceil(left / 1000) + 's';
    if (run && !run.fb && d.kind === 'casa' && left <= 0) answerRun(-1);
  };

  const hostLogic = (d) => {
    if (d.kind !== 'live' || d.host !== be.id || d.state.phase !== 'question') return;
    const k = d.code + ':' + d.state.q + ':' + d.state.qStart;
    const pl = playersOf(d.code);
    const everyone = pl.length > 0 && pl.every((p) => p.answers[d.state.q]);
    if (hostKey !== k) {
      hostKey = k;
      const wait = Math.max(0, d.state.qStart + d.tsec * 1000 + 800 - Date.now());
      setTimeout(() => { const c = duels[d.code]; if (c && c.state.phase === 'question' && c.state.q === d.state.q && c.state.qStart === d.state.qStart) be.patchState(d.code, { phase: 'reveal', q: d.state.q, qStart: d.state.qStart }); }, wait);
    }
    if (everyone) setTimeout(() => { const c = duels[d.code]; if (c && c.state.phase === 'question' && c.state.q === d.state.q) be.patchState(d.code, { phase: 'reveal', q: d.state.q, qStart: d.state.qStart }); }, 900);
  };

  /* ====================== respostas ====================== */
  const sendLive = async (c) => {
    const d = duels[cur];
    if (!d || d.state.phase !== 'question' || liveAns[liveKey] || !joinedMe(d)) return;
    const ms = Date.now() - t0;
    if (ms > d.tsec * 1000 + 300) return;
    liveAns[liveKey] = { c, ms };
    await be.answer(cur, nick(), d.state.q, { c, ms });
    paintDetail();
  };
  const answerRun = async (c) => {
    const d = duels[cur];
    if (!run || run.fb) return;
    const T = d.tsec * 1000;
    const ms = c === -1 ? T + 1 : Math.min(Date.now() - run.t0, T);
    run.pick = c; run.fb = true;
    const right = [0, 1, 2, 3].find((x) => hashes[run.i][x] === d.questions[run.i].h);
    run.res[run.i] = c === right;
    await be.answer(cur, nick(), run.i, { c, ms });
    paintDetail();
  };

  /* ====================== view ====================== */
  Q.Views.duel = {
    title: 'Disputas',
    render(params) {
      cur = params && params[0] ? params[0].toUpperCase() : null;
      run = null; liveAns = {}; liveKey = ''; hashes = null; hashesCode = null; hostKey = '';
      return '<div id="du-root">' + (cur ? '<p class="muted">Conectando…</p>' : homeHTML()) + '</div>';
    },
    async mount() {
      clearInterval(tickId); clearInterval(agendaId);
      if (!demoMode || !be) { stopSubs(); be = await dbBackend(); }
      if (!Q.$('#du-root')) return;
      if (!be) {
        Q.$('#du-root').innerHTML = `<div class="page-h"><div><div class="eyebrow">Disputas</div><h1>Estudar com prazer, subir no ranking</h1></div></div>
          <div class="card"><b>As disputas entre pessoas precisam do link online compartilhado.</b><p class="muted">Abra o Localquest pelo link compartilhado, entre com sua conta e peça acesso de colaborador para criar e responder. Enquanto isso, veja como funciona:</p><button class="btn primary" data-act="du-demo">🎮 Demonstração ao vivo com bots</button></div>`;
        return;
      }
      startSubs();
      tickId = setInterval(() => { liveTick(); }, 250);
      agendaId = setInterval(() => { if (!cur && tab === 'agenda') paintHome(); }, 30000);
      keyH = (e) => {
        if (document.querySelector('.modal-back') || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
        const i = 'abcd'.indexOf(e.key.toLowerCase());
        if (i < 0 || e.key.length !== 1) return;
        const d = duels[cur];
        if (!d) return;
        if (d.kind === 'live') sendLive(i); else answerRun(i);
      };
      document.addEventListener('keydown', keyH);
      repaint(true);
    },
    unmount() {
      clearInterval(tickId); clearInterval(agendaId); stopSubs();
      if (keyH) document.removeEventListener('keydown', keyH); keyH = null;
      if (demoMode) { demoMode = false; be = null; duels = {}; docs = []; }
    },
    act: {
      'du-tab': (el) => { tab = el.dataset.k; Q.App.refresh(); },
      'du-nick': () => { const v = Q.$('#du-nick').value.trim(); if (v.length < 2) return Q.toast('Escolha um nome com pelo menos 2 letras.', 'warn'); S().settings.nick = v; Q.Store.save(); Q.App.refresh(); },
      'du-copy': async (el) => Q.toast((await Q.copy(el.dataset.code)) ? 'Código copiado: ' + el.dataset.code : 'Anote o código: ' + el.dataset.code, 'good'),
      'du-del': async (el) => { if (await Q.confirm('Excluir esta disputa para todos?', 'Excluir')) { await Q.Views.duel._del(el.dataset.code); } },
      'dc-kind': (el) => {
        const live = el.dataset.k === 'live';
        Q.$('#dc-k-casa').classList.toggle('on', !live); Q.$('#dc-k-live').classList.toggle('on', live);
        Q.$('#dc-casa').hidden = live; Q.$('#dc-live').hidden = !live;
      },
      'dc-create': async () => {
        if (!nick()) return Q.toast('Escolha seu nome no topo da página primeiro.', 'warn');
        const title = Q.$('#dc-title').value.trim();
        const mats = Q.$$('.dc-mat:checked').map((x) => x.value);
        const live = Q.$('#dc-k-live').classList.contains('on');
        if (title.length < 3) return Q.toast('Dê um título à disputa.', 'warn');
        if (!mats.length) return Q.toast('Escolha ao menos um material.', 'warn');
        const opens = Date.parse(Q.$('#dc-open').value), closes = Date.parse(Q.$('#dc-close').value);
        if (!live && !(closes > opens)) return Q.toast('A data de fechamento precisa ser depois da abertura.', 'warn');
        const n = Q.clamp(+Q.$('#dc-n').value || 10, 3, 40), tsec = Q.clamp(+Q.$('#dc-t').value || 30, 10, 120);
        const d = await D.build({ title, kind: live ? 'live' : 'casa', materialIds: mats, n, tsec, group: Q.$('#dc-group').value, host: be.id, hostNick: nick(), opensAt: live ? 0 : opens, closesAt: live ? 0 : closes, startsAt: live ? Date.parse(Q.$('#dc-start').value) || 0 : 0 });
        if (d.questions.length < 3) return Q.toast('Poucas questões disponíveis nesses materiais.', 'warn');
        await be.saveDuel(d);
        await be.join(d.code, nick());
        tab = 'agenda';
        Q.toast(`Disputa criada! Código: ${d.code}`, 'good', 8000);
        Q.go('#/disputas/' + d.code);
      },
      'du-join': async () => {
        const c = Q.$('#dj-code').value.trim().toUpperCase();
        if (!nick()) return Q.toast('Escolha seu nome no topo da página primeiro.', 'warn');
        if (!duels[c]) return Q.toast('Código não encontrado.', 'bad');
        tab = 'agenda';
        Q.go('#/disputas/' + c);
      },
      'du-demo': async () => {
        const mats = S().materials.filter((m) => Q.Store.questionsOf(m.id).length);
        if (!mats.length) return Q.toast('Carregue o exemplo ou envie um material para a demonstração.', 'warn');
        if (!nick()) { S().settings.nick = 'Você'; }
        stopSubs(); demoMode = true; be = localBackend(); duels = {}; docs = [];
        const d = await D.build({ title: 'Demonstração ao vivo', kind: 'live', materialIds: mats.map((m) => m.id), n: Math.min(6, 99), tsec: 15, group: 'DEMO', host: be.id, hostNick: nick() });
        await be.saveDuel(d); await be.join(d.code, nick());
        startSubs();
        Q.go('#/disputas/' + d.code);
      },
      'du-joinlive': async () => { if (!nick()) return Q.toast('Escolha seu nome primeiro (aba Agenda).', 'warn'); await be.join(cur, nick()); },
      'du-start': () => be.patchState(cur, { phase: 'question', q: 0, qStart: Date.now() }),
      'du-reveal': () => { const d = duels[cur]; be.patchState(cur, { phase: 'reveal', q: d.state.q, qStart: d.state.qStart }); },
      'du-nextlive': () => { const d = duels[cur]; const last = d.state.q >= d.questions.length - 1; be.patchState(cur, last ? { phase: 'done', q: d.state.q, qStart: d.state.qStart } : { phase: 'question', q: d.state.q + 1, qStart: Date.now() }); },
      'du-pick': (el) => { const d = duels[cur]; if (!d) return; d.kind === 'live' ? sendLive(+el.dataset.c) : answerRun(+el.dataset.c); },
      'du-run': () => {
        const d = duels[cur];
        if (!nick()) return Q.toast('Escolha seu nome primeiro (aba Agenda).', 'warn');
        const me = playersOf(cur).find((p) => p.uid === be.id);
        const answered = me ? me.answers : {};
        let i = 0; while (answered[i]) i++;
        be.join(cur, nick());
        run = { i, pick: null, fb: false, t0: Date.now(), res: {} };
        Object.keys(answered).forEach((k) => (run.res[k] = hashes && D.isCorrect(d, hashes, +k, answered[k].c)));
        paintDetail();
      },
      'du-next': () => {
        const d = duels[cur];
        if (run.i >= d.questions.length - 1) { run = null; Q.toast('Respostas enviadas! Veja sua posição no ranking.', 'good'); if (Q.Rank) Q.Rank.autoSync(); return paintDetail(); }
        run = { i: run.i + 1, pick: null, fb: false, t0: Date.now(), res: run.res };
        paintDetail();
      },
    },
    async _del(code) {
      if (!window.claude) return;
      const db = await window.claude.use('db');
      await db.doc('duels/' + code).delete();
      Q.toast('Disputa excluída');
    },
  };
})();
