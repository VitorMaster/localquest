/* Localquest — ranking entre usuários e grupos de estudo.
 * Depende do banco compartilhado da página publicada (capability `db`). Fora dela, mostra só o placar pessoal.
 * Métrica: quantidade de QUESTÕES DIFERENTES acertadas (repetir a mesma prova não infla o placar). */
(function () {
  const Q = window.Q, E = Q.Engine, esc = Q.esc;
  const S = () => Q.Store.state;
  const R = (Q.Rank = {});

  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';

  /* ---------- placar local ---------- */
  R.myScores = () => {
    const aulas = {};
    S().materials.filter((m) => m.source !== 'demo').forEach((m) => { // o material de exemplo e seu histórico fictício não entram no ranking
      const ans = E.answers({}, S().attempts).filter((a) => a.materialId === m.id);
      if (!ans.length) return;
      const okQ = new Set(ans.filter((a) => a.correct).map((a) => a.qid));
      const allQ = new Set(ans.map((a) => a.qid));
      const topics = {};
      m.topics.forEach((t) => {
        const mine = ans.filter((a) => (a.topicIds || []).includes(t.id));
        if (!mine.length) return;
        const k = slug(t.title);
        const prev = topics[k] || { title: t.title, c: 0, t: 0 };
        prev.c += new Set(mine.filter((a) => a.correct).map((a) => a.qid)).size;
        prev.t += new Set(mine.map((a) => a.qid)).size;
        topics[k] = prev;
      });
      const key = slug(m.materia) + '__' + slug(m.title);
      aulas[key] = { materia: m.materia, aula: m.title, curso: m.curso, periodo: m.periodo, c: okQ.size, t: allQ.size, real: Math.round(E.summarize(ans).real * 1000) / 10, topics };
    });
    return aulas;
  };

  /* ---------- cálculo do ranking (puro) ---------- */
  /** players: [{id,nick,groups,aulas}] · scope: ''|código do grupo · by: 'geral'|'materia'|'aula'|'assunto' · key: valor escolhido */
  R.compute = (players, scope, by, key) => {
    const rows = [];
    players.forEach((p) => {
      if (scope && !(p.groups || []).includes(scope)) return;
      let c = 0, t = 0, rw = 0, n = 0;
      Object.entries(p.aulas || {}).forEach(([ak, a]) => {
        if (by === 'assunto') {
          Object.entries(a.topics || {}).forEach(([tk, tp]) => { if (tk === key) { c += tp.c; t += tp.t; } });
          return;
        }
        if (by === 'materia' && slug(a.materia) !== key) return;
        if (by === 'aula' && ak !== key) return;
        c += a.c; t += a.t; rw += (a.real || 0) * a.t; n += a.t;
      });
      if (t > 0) rows.push({ id: p.id, nick: p.nick || 'Anônimo', c, t, pct: Math.round((c / t) * 100), real: n ? Math.round(rw / n) : null });
    });
    rows.sort((a, b) => b.c - a.c || (b.real || 0) - (a.real || 0) || a.t - b.t);
    rows.forEach((r, i) => (r.pos = i > 0 && r.c === rows[i - 1].c && r.real === rows[i - 1].real && r.t === rows[i - 1].t ? rows[i - 1].pos : i + 1));
    return rows;
  };

  R.options = (players, scope, by) => {
    const m = new Map();
    players.forEach((p) => {
      if (scope && !(p.groups || []).includes(scope)) return;
      Object.entries(p.aulas || {}).forEach(([ak, a]) => {
        if (by === 'materia') m.set(slug(a.materia), a.materia);
        if (by === 'aula') m.set(ak, `${a.materia} · ${a.aula}`);
        if (by === 'assunto') Object.entries(a.topics || {}).forEach(([tk, tp]) => m.set(tk, tp.title));
      });
    });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  };

  /* ---------- conexão com o banco compartilhado ---------- */
  let db = null, uid = null, players = [], groups = {}, unsub = [], ready = false, lastSync = 0, queue = Promise.resolve();
  const view = { scope: '', by: 'geral', key: '' };

  const connect = async () => {
    if (ready) return db;
    try {
      if (!window.claude || !window.claude.use) return null;
      db = await window.claude.use('db');
      const user = await window.claude.use('user');
      if (!db || !user) return null;
      uid = await user.id();
      if (!uid) return null;
      if (!S().settings.nick) {
        const me = await user.me();
        if (me && me.name) S().settings.nick = me.name;
      }
      ready = true;
      return db;
    } catch (e) { return null; }
  };

  const myDoc = () => ({
    nick: S().settings.nick || 'Anônimo',
    groups: S().settings.groups || [],
    aulas: R.myScores(),
    updated: Date.now(),
  });
  const write = (fn) => (queue = queue.then(fn).catch((e) => { console.warn(e); Q.toast('Não foi possível salvar no ranking agora.', 'warn'); }));

  R.sync = (silent) =>
    write(async () => {
      if (!(await connect()) || !S().settings.nick) return;
      await db.doc('players/' + uid).set(myDoc());
      lastSync = Date.now();
      if (!silent) Q.toast('Placar atualizado no ranking', 'good');
    });
  R.autoSync = () => { if (S().settings.nick) R.sync(true); };

  const subscribe = () => {
    unsub.forEach((u) => u());
    unsub = [];
    const rerender = Q.debounce(() => paint(), 150);
    unsub.push(db.collection('players').onSnapshot((snap) => { players = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())); rerender(); }, () => {}));
    unsub.push(db.collection('groups').onSnapshot((snap) => { groups = {}; snap.docs.forEach((d) => (groups[d.id] = d.data())); rerender(); }, () => {}));
  };

  const code = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

  /* ---------- simulação (dados fictícios, não grava nada) ---------- */
  let demo = null;
  const AULAS = [
    ['geriatria__envelhecimento-e-avaliacao-funcional', 'Geriatria', 'Envelhecimento e avaliação funcional', ['Transição demográfica', 'Senescência × senilidade', 'Avaliação funcional: AVDs', 'Timed Up and Go (TUG)', 'Prevenção de quedas']],
    ['farmacologia__polifarmacia-e-seguranca-medicamentosa', 'Farmacologia', 'Polifarmácia e segurança medicamentosa', ['O que é polifarmácia', 'Critérios de Beers', 'Cascata de prescrição', 'Estratégias de segurança']],
  ];
  const NAMES = [['Bia', 0.82], ['Carlos', 0.7], ['Dani', 0.64], ['Eduardo', 0.55], ['Fernanda', 0.76]];
  const slugT = (s) => slug(s);
  const addRound = (p, skill, rnd, big) => {
    AULAS.forEach(([ak, mat, aula, tops]) => {
      const a = (p.aulas[ak] = p.aulas[ak] || { materia: mat, aula, curso: 'Fisioterapia', periodo: '6º período', c: 0, t: 0, real: 0, topics: {} });
      tops.forEach((tt) => {
        const n = Math.round((big ? 4 : 1) + rnd() * (big ? 3 : 2));
        const c = Array.from({ length: n }).filter(() => rnd() < skill).length;
        const tp = (a.topics[slugT(tt)] = a.topics[slugT(tt)] || { title: tt, c: 0, t: 0 });
        tp.t += n; tp.c += c; a.t += n; a.c += c;
      });
      a.real = Math.round(skill * 100 - 12 + rnd() * 10);
    });
  };
  const startDemo = () => {
    const rnd = Q.seeded(Date.now() % 100000);
    const mine = R.myScores();
    const me = { id: 'demo_me', nick: S().settings.nick || 'Visitante', groups: ['DEMO01'], aulas: Object.keys(mine).length ? mine : {} };
    if (!Object.keys(me.aulas).length) addRound(me, 0.68, rnd, true);
    const others = NAMES.map(([n, sk], i) => { const p = { id: 'demo_' + i, nick: n, groups: ['DEMO01'], aulas: {}, skill: sk }; addRound(p, sk, rnd, true); return p; });
    demo = { players: [me, ...others], groups: { DEMO01: { name: 'Turma de Geriatria 6º período (simulação)' } }, prev: {}, rnd, round: 0, me };
    view.scope = 'DEMO01'; view.by = 'geral'; view.key = '';
  };
  const demoRound = () => {
    const rows = R.compute(demo.players, 'DEMO01', view.by, view.key);
    demo.prev = Object.fromEntries(rows.map((r) => [r.id, r.pos]));
    demo.round++;
    demo.players.forEach((p) => addRound(p, p.skill || 0.68, demo.rnd, false));
  };

  /* ---------- tela ---------- */
  const paint = () => {
    const box = Q.$('#rk-body');
    if (!box) return;
    const P = demo ? demo.players : players, G = demo ? demo.groups : groups, myId = demo ? 'demo_me' : uid;
    const mine = demo ? ['DEMO01'] : S().settings.groups || [];
    if (view.scope && !mine.includes(view.scope)) view.scope = '';
    const opts = view.by === 'geral' ? [] : R.options(P, view.scope, view.by);
    if (view.by !== 'geral' && !opts.some((o) => o[0] === view.key)) view.key = opts[0] ? opts[0][0] : '';
    const rows = R.compute(P, view.scope, view.by, view.key);
    const mv = (r) => { if (!demo || !demo.round) return ''; const d = (demo.prev[r.id] || r.pos) - r.pos; return d > 0 ? `<span style="color:var(--good)">▲${d}</span>` : d < 0 ? `<span style="color:var(--bad)">▼${-d}</span>` : '<span class="muted">–</span>'; };
    const medal = (p) => (p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : p);
    const label = { geral: 'Geral (todas as questões)', materia: 'Matéria', aula: 'Aula', assunto: 'Assunto' };
    box.innerHTML = `
      <div class="row wrap gap mb">
        <div class="field" style="margin:0"><label>Quem</label><select data-change="rk-scope"><option value="">🌍 Todos os usuários (ranking geral)</option>${mine.map((g) => `<option value="${g}" ${view.scope === g ? 'selected' : ''}>👥 ${esc((G[g] || {}).name || g)}</option>`).join('')}</select></div>
        <div class="field" style="margin:0"><label>Separar por</label><select data-change="rk-by">${Object.entries(label).map(([k, l]) => `<option value="${k}" ${view.by === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        ${view.by !== 'geral' ? `<div class="field" style="margin:0;min-width:240px"><label>${label[view.by]}</label><select data-change="rk-key">${opts.length ? opts.map(([k, l]) => `<option value="${esc(k)}" ${view.key === k ? 'selected' : ''}>${esc(l)}</option>`).join('') : '<option value="">— nenhum dado ainda —</option>'}</select></div>` : ''}
      </div>
      ${demo ? '<div class="verdict todo mb"><span class="em">🎮</span><div><b>Simulação com dados fictícios</b><br><small>Rodada ' + demo.round + '. Nada disso é gravado nem aparece para outras pessoas.</small></div></div>' : ''}
      ${rows.length ? `<div style="overflow:auto"><table class="tbl"><thead><tr><th>#</th><th>Participante</th><th>Acertos</th><th>Respondidas</th><th>Aproveitamento</th><th>Domínio real</th></tr></thead><tbody>
        ${rows.map((r) => `<tr style="${r.id === myId ? 'background:color-mix(in srgb,var(--accent2) 14%,transparent);font-weight:700' : ''}"><td>${medal(r.pos)} ${mv(r)}</td><td>${esc(r.nick)}${r.id === myId ? ' <span class="badge b-info">você</span>' : ''}</td><td><b>${r.c}</b></td><td>${r.t}</td><td>${r.pct}%</td><td>${r.real == null ? '—' : r.real + '%'}</td></tr>`).join('')}</tbody></table></div>
        <small class="muted">Acertos = questões diferentes que o participante acertou. Refazer a mesma questão não soma de novo.</small>`
        : '<div class="empty"><div class="big">🏁</div><p class="muted">Ninguém pontuou neste recorte ainda. Faça uma prova e clique em “Atualizar meu placar”.</p></div>'}`;
    Q.applyTips && Q.applyTips(box);
  };

  Q.Views.rank = {
    title: 'Ranking',
    render() {
      const nick = S().settings.nick || '';
      const mine = S().settings.groups || [];
      const mineScores = R.myScores();
      const totalC = Object.values(mineScores).reduce((s, a) => s + a.c, 0);
      return `
      <div class="page-h"><div><div class="eyebrow">Ranking</div><h1>Estude em grupo e compare</h1><p>O melhor é quem acerta mais questões diferentes em cada matéria, aula ou assunto.</p></div></div>
      <div id="rk-offline" class="card mb" hidden></div>
      <div class="grid g2 mb" id="rk-setup">
        <div class="card"><h3>👤 Seu nome no ranking</h3>
          <div class="row gap"><input type="text" id="rk-nick" value="${esc(nick)}" placeholder="Como quer aparecer?" maxlength="30" style="flex:1"><button class="btn primary" data-act="rk-nick">Salvar</button></div>
          <p class="muted mt-s"><small>Seu placar local: <b>${totalC}</b> acerto(s) em ${Object.keys(mineScores).length} aula(s). <span id="rk-last"></span></small></p>
          <button class="btn" data-act="rk-sync">🔄 Atualizar meu placar</button></div>
        <div class="card"><h3>👥 Grupos de estudo</h3>
          <div id="rk-groups">${mine.length ? mine.map((g) => `<div class="row between gap mb"><span><b>${esc((groups[g] || {}).name || 'Grupo')}</b> <code class="k">${esc(g)}</code></span><span class="row gap"><button class="btn sm" data-act="rk-copy" data-g="${g}">Copiar código</button><button class="btn sm ghost" data-act="rk-leave" data-g="${g}">Sair</button></span></div>`).join('') : '<p class="muted">Você ainda não está em nenhum grupo.</p>'}</div>
          <div class="row gap mt-s"><input type="text" id="rk-code" placeholder="Código do grupo" maxlength="6" style="text-transform:uppercase"><button class="btn" data-act="rk-join">Entrar</button></div>
          <div class="row gap mt-s"><input type="text" id="rk-gname" placeholder="Nome do novo grupo" maxlength="40"><button class="btn" data-act="rk-create">Criar grupo</button></div></div>
      </div>
      <div class="card"><div class="row between wrap gap mb"><h3 style="margin:0">🏆 Classificação</h3><div class="row wrap gap" id="rk-demo-btns"><button class="btn" data-act="rk-demo">🎮 Ver simulação</button></div></div><div id="rk-body"><p class="muted">Conectando…</p></div></div>`;
    },
    async mount() {
      const paintDemoBtns = () => { const b = Q.$('#rk-demo-btns'); if (b) b.innerHTML = demo ? '<button class="btn primary" data-act="rk-round">↻ Simular nova rodada</button><button class="btn ghost" data-act="rk-demo-off">Sair da simulação</button>' : '<button class="btn" data-act="rk-demo">🎮 Ver simulação</button>'; Q.applyTips && Q.applyTips(b); };
      Q.Views.rank._btns = paintDemoBtns;
      unsub.forEach((u) => u()); unsub = [];
      const off = Q.$('#rk-offline');
      const ok = await connect();
      if (!Q.$('#rk-body')) return;
      if (demo) { paintDemoBtns(); paint(); return; }
      if (!ok) {
        off.hidden = false;
        off.innerHTML = '<b>Ranking indisponível neste modo.</b><p class="muted" style="margin:6px 0 0">O ranking entre usuários precisa do link online compartilhado (com acesso de colaborador para escrever). Seu placar pessoal acima continua funcionando.</p>';
        Q.$('#rk-body').innerHTML = '<p class="muted">Abra o Localquest pelo link compartilhado e entre com sua conta para participar.</p>';
        return;
      }
      subscribe();
      Q.$('#rk-last').textContent = lastSync ? 'Enviado às ' + Q.fmtDate(lastSync) : '';
      paint();
    },
    unmount() { unsub.forEach((u) => u()); unsub = []; demo = null; },
    act: {
      'rk-demo': () => { startDemo(); Q.Views.rank._btns(); Q.$('#rk-offline').hidden = true; paint(); },
      'rk-round': () => { demoRound(); paint(); },
      'rk-demo-off': () => { demo = null; view.scope = ''; Q.App.refresh(); },
      'rk-nick': async () => {
        const v = Q.$('#rk-nick').value.trim();
        if (v.length < 2) return Q.toast('Escolha um nome com pelo menos 2 letras.', 'warn');
        S().settings.nick = v; Q.Store.save();
        await R.sync(false);
      },
      'rk-sync': async () => { if (!S().settings.nick) return Q.toast('Defina seu nome primeiro.', 'warn'); await R.sync(false); },
      'rk-copy': async (el) => Q.toast((await Q.copy(el.dataset.g)) ? 'Código copiado: ' + el.dataset.g : 'Anote o código: ' + el.dataset.g, 'good'),
      'rk-leave': (el) => { S().settings.groups = (S().settings.groups || []).filter((g) => g !== el.dataset.g); Q.Store.save(); R.sync(true); Q.App.refresh(); },
      'rk-join': async () => {
        if (!S().settings.nick) return Q.toast('Defina seu nome primeiro.', 'warn');
        const c = Q.$('#rk-code').value.trim().toUpperCase();
        if (c.length < 4 || !(await connect())) return Q.toast('Digite o código do grupo.', 'warn');
        const snap = await db.doc('groups/' + c).get();
        if (!snap.exists) return Q.toast('Código não encontrado.', 'bad');
        const g = new Set(S().settings.groups || []); g.add(c);
        S().settings.groups = [...g]; Q.Store.save();
        await R.sync(true);
        Q.toast('Você entrou em “' + snap.data().name + '”', 'good');
        Q.App.refresh();
      },
      'rk-create': async () => {
        if (!S().settings.nick) return Q.toast('Defina seu nome primeiro.', 'warn');
        const name = Q.$('#rk-gname').value.trim();
        if (name.length < 2 || !(await connect())) return Q.toast('Dê um nome ao grupo.', 'warn');
        const c = code();
        await db.doc('groups/' + c).set({ name, createdAt: Date.now(), by: uid });
        S().settings.groups = [...(S().settings.groups || []), c]; Q.Store.save();
        await R.sync(true);
        Q.toast(`Grupo criado! Código: ${c}`, 'good', 8000);
        Q.App.refresh();
      },
    },
    change: {
      'rk-scope': (el) => { view.scope = el.value; view.key = ''; paint(); },
      'rk-by': (el) => { view.by = el.value; view.key = ''; paint(); },
      'rk-key': (el) => { view.key = el.value; paint(); },
    },
  };
})();
