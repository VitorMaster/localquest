/* Localquest — Sala presencial: disputa ao vivo entre aparelhos na mesma rede (ponto de acesso do celular), sem servidor.
 * O anfitrião é a "fonte da verdade"; cada participante conversa só com ele (WebRTC). Reaproveita toda a tela de disputa ao vivo. */
(function () {
  const Q = window.Q, P = Q.P2P, D = Q.Duel, esc = Q.esc;
  const S = () => Q.Store.state;
  const R = (Q.Room = {});
  let host = null, guest = null;

  const clone = (x) => JSON.parse(JSON.stringify(x));
  const myUid = () => { try { let u = sessionStorage.getItem('lq_room_uid'); if (!u) sessionStorage.setItem('lq_room_uid', (u = Q.uid('g'))); return u; } catch (_) { return Q.uid('g'); } };

  /* ====================== backends ====================== */
  const makeHostBackend = (h) => {
    const st = { duels: {}, docs: {}, subs: { d: [], p: [], g: [] } };
    const emit = () => { st.subs.d.concat(st.subs.p, st.subs.g).forEach((f) => f()); };
    let t = null;
    const push = () => { emit(); clearTimeout(t); t = setTimeout(() => h.broadcast({ t: 'snap', duels: st.duels, docs: Object.values(st.docs) }), 40); };
    const doc = (uid) => (st.docs[uid] = st.docs[uid] || { uid, d: {} });
    const entry = (uid, code, nick) => { const e = (doc(uid).d[code] = doc(uid).d[code] || { nick: nick || 'Anônimo', answers: {}, joinedAt: Date.now() }); if (nick) e.nick = nick; return e; };
    h.onMessage = (pid, m) => {
      if (m.t === 'join') entry(m.uid, m.code, m.nick);
      else if (m.t === 'answer') {
        const d = st.duels[m.code];
        const e = entry(m.uid, m.code, m.nick);
        if (d && !e.answers[m.i]) e.answers[m.i] = m.a; // primeira resposta vale
      }
      push();
    };
    h.onOpen = (pid) => h.send(pid, { t: 'snap', duels: st.duels, docs: Object.values(st.docs) });
    h.onPeersChange = () => emit();
    const sub = (k, f) => { st.subs[k].push(f); setTimeout(f, 0); return () => (st.subs[k] = st.subs[k].filter((x) => x !== f)); };
    const be = {
      id: 'room_host', room: { role: 'host', host: h },
      watchDuels: (cb) => sub('d', () => cb(Object.values(st.duels).map(clone))),
      watchPlayers: (cb) => sub('p', () => cb(Object.values(st.docs).map(clone))),
      watchGroups: (cb) => sub('g', () => cb({ SALA: { name: 'Sala presencial' } })),
      saveDuel: async (d) => { st.duels[d.code] = clone(d); push(); },
      patchState: async (code, state) => { st.duels[code].state = state; push(); },
      join: async (code, nick) => { entry(be.id, code, nick); push(); },
      answer: async (code, nick, i, a) => { const e = entry(be.id, code, nick); if (!e.answers[i]) e.answers[i] = a; push(); },
      close: () => { h.close(); host = null; },
    };
    return be;
  };

  const makeGuestBackend = (g, uid) => {
    const st = { duels: {}, docs: [], subs: { d: [], p: [], g: [] }, joined: false, lost: false };
    const emit = () => st.subs.d.concat(st.subs.p, st.subs.g).forEach((f) => f());
    const sub = (k, f) => { st.subs[k].push(f); setTimeout(f, 0); return () => (st.subs[k] = st.subs[k].filter((x) => x !== f)); };
    const be = {
      id: uid, room: { role: 'guest', guest: g, state: st },
      watchDuels: (cb) => sub('d', () => cb(Object.values(st.duels).map(clone))),
      watchPlayers: (cb) => sub('p', () => cb(clone(st.docs))),
      watchGroups: (cb) => sub('g', () => cb({ SALA: { name: 'Sala presencial' } })),
      saveDuel: async () => {}, patchState: async () => {},
      join: async (code, nick) => { g.send({ t: 'join', uid, nick, code }); },
      answer: async (code, nick, i, a) => { g.send({ t: 'answer', uid, nick, code, i, a }); },
      close: () => g.close(),
    };
    g.onMessage = (m) => {
      if (m.t !== 'snap') return;
      st.duels = m.duels || {}; st.docs = m.docs || [];
      emit();
      if (R.onSnap) R.onSnap(st);
    };
    g.onClose = () => { st.lost = true; Q.toast('A conexão com o anfitrião foi perdida. Verifique o Wi-Fi e entre de novo na sala.', 'bad', 9000); emit(); };
    return be;
  };

  /* ====================== tela (aba "Sala presencial") ====================== */
  R.html = () => {
    const mats = S().materials.filter((m) => Q.Store.questionsOf(m.id).length);
    const ok = P.supported();
    return `
      ${window.self !== window.top ? '<div class="verdict todo mb"><span class="em">🚧</span><div><b>Você está numa página incorporada (como o link do claude.ai).</b><br><small>Aqui o navegador bloqueia a conexão direta entre aparelhos e a câmera. Use a versão hospedada em https ou a instalada no celular (veja o guia abaixo).</small></div></div>' : ''}
      ${ok ? '' : '<div class="verdict todo mb"><span class="em">⚠️</span><div><b>Este navegador não permite conexão direta entre aparelhos.</b><br><small>Use o Chrome, Edge ou Safari atualizado, abrindo o Localquest fora do link do claude.ai (veja o guia abaixo).</small></div></div>'}
      <div class="card mb"><h3>📡 Como montar a sala usando o ponto de acesso do celular</h3>
        <ol class="steps">
          <li><b>Antes da aula (com internet): abra o Localquest em cada celular uma vez</b><p class="muted">Ele fica guardado no aparelho e depois funciona sem internet. No navegador, use “Adicionar à tela inicial” / “Instalar app”.</p></li>
          <li><b>Anfitrião: ligue o ponto de acesso</b><p class="muted">Android: Configurações → Conexões → Ponto de acesso e tethering. iPhone: Ajustes → Acesso Pessoal (ou Compartilhar Internet). Anote o nome e a senha do Wi-Fi.</p></li>
          <li><b>Todos conectam ao Wi-Fi do celular do anfitrião</b><p class="muted">Não é preciso ter internet nesse Wi-Fi. Deixe o Bluetooth e os dados móveis como estiverem.</p></li>
          <li><b>Anfitrião abre a sala e convida cada colega por QR</b><p class="muted">Para cada colega: ele toca em “Entrar em uma sala” e escaneia seu QR; o QR dele aparece e você escaneia de volta. Leva uns 10 segundos por pessoa e só se faz uma vez.</p></li>
        </ol>
        <small class="muted">Se o QR não ler, use a opção de copiar/colar o código (por exemplo, por mensagem). Se a conexão falhar, desligue e ligue o Wi-Fi do colega e repita.</small></div>
      <div class="grid g2">
        <div class="card"><h3>📡 Sou o anfitrião</h3>
          ${mats.length ? `<div class="field"><label>Título</label><input type="text" id="rm-title" value="Revisão presencial" maxlength="60"></div>
          <div class="grid g2"><div class="field"><label>Questões</label><input type="number" id="rm-n" value="10" min="3" max="40"></div><div class="field"><label>Segundos por questão</label><input type="number" id="rm-t" value="20" min="10" max="120"></div></div>
          <div class="field"><label>Materiais</label>${mats.map((m) => `<label style="display:flex;gap:8px;align-items:center;margin-bottom:4px;text-transform:none;letter-spacing:0;font-size:.9rem;color:var(--text);font-weight:500"><input type="checkbox" class="rm-mat" value="${m.id}" checked><span>${esc(m.title)} <small class="muted">· ${esc(m.materia)}</small></span></label>`).join('')}</div>
          <button class="btn primary lg" data-act="rm-open" ${ok ? '' : 'disabled'}>📡 Abrir sala</button>` : '<p class="muted">Envie um material na Biblioteca para criar as questões da sala.</p>'}</div>
        <div class="card"><h3>🙋 Sou participante</h3><p class="muted">O anfitrião já abriu a sala? Toque abaixo e escaneie o QR que aparece no celular dele.</p>
          <button class="btn primary lg" data-act="rm-join" ${ok ? '' : 'disabled'}>🙋 Entrar em uma sala</button>
          <div class="divider"></div><p class="muted"><small>Quer só ver como é, sem ninguém por perto?</small></p><button class="btn" data-act="du-demo">🎮 Demonstração ao vivo com bots</button></div>
      </div>`;
  };

  /* ---------- anfitrião: abrir sala e convidar ---------- */
  const needNick = () => { if (!S().settings.nick) { Q.toast('Escolha seu nome no topo da página primeiro.', 'warn'); return true; } return false; };

  const openRoom = async () => {
    if (needNick()) return;
    const mats = Q.$$('.rm-mat:checked').map((x) => x.value);
    if (!mats.length) return Q.toast('Escolha ao menos um material.', 'warn');
    const n = Q.clamp(+Q.$('#rm-n').value || 10, 3, 40), tsec = Q.clamp(+Q.$('#rm-t').value || 20, 10, 120);
    if (host) host.close();
    host = new P.Host();
    const be = makeHostBackend(host);
    const d = await D.build({ title: Q.$('#rm-title').value.trim() || 'Sala presencial', kind: 'live', materialIds: mats, n, tsec, group: 'SALA', host: be.id, hostNick: S().settings.nick });
    if (d.questions.length < 3) { host.close(); host = null; return Q.toast('Poucas questões disponíveis nesses materiais.', 'warn'); }
    Q.Views.duel._useBackend(be);
    await be.saveDuel(d);
    await be.join(d.code, S().settings.nick);
    Q.go('#/disputas/' + d.code);
    setTimeout(() => R.invite(), 400);
  };

  R.invite = async () => {
    if (!host) return;
    const m = Q.modal(`<div class="eyebrow">Convidar participante</div><h2>1. O colega escaneia este QR</h2>
      <p class="muted">No celular dele: <b>Disputas → Sala presencial → Entrar em uma sala</b>.</p>
      <div id="iv-qr" style="text-align:center;min-height:120px"><p class="muted">Gerando convite…</p></div>
      <div class="row gap wrap mb" style="justify-content:center"><button class="btn sm" id="iv-copy" disabled>📋 Copiar código</button></div>
      <h2 class="mt">2. Escaneie o QR que aparece no celular dele</h2>
      <div id="iv-cam" hidden><video id="iv-video" muted playsinline style="width:100%;max-height:260px;border-radius:14px;background:#000"></video></div>
      <div class="row gap wrap"><button class="btn primary" id="iv-scan">📷 Escanear</button></div>
      <details class="mt-s"><summary class="muted" style="cursor:pointer">Prefiro colar o código</summary><div class="field mt-s"><textarea id="iv-answer" rows="3" placeholder="Cole aqui o código de resposta (começa com LQ1.)"></textarea></div><button class="btn" id="iv-ok">Conectar</button></details>
      <p id="iv-msg" class="muted mt-s"></p>`, { cls: 'small', sticky: true, onClose: () => { if (scanner) scanner.stop(); if (pending) host && host.cancel(pending); } });
    const el = m.el, $ = (s) => Q.$(s, el);
    let scanner = null, pending = null, done = false;
    const say = (t) => ($('#iv-msg').textContent = t);
    const connect = async (code) => {
      if (done || !pending) return;
      try {
        say('Conectando…');
        await host.accept(pending, code.trim());
        setTimeout(() => { if (!done) say('Ainda conectando… se não concluir em alguns segundos, feche e gere um novo convite.'); }, 8000);
      } catch (e) { say(e.message || 'Não consegui usar esse código.'); }
    };
    host.onOpen = ((prev) => (pid) => { prev && prev(pid); if (pid === pending) { done = true; Q.toast('Colega conectado ✔', 'good'); m.close(); setTimeout(() => host && host.connected() < 30 && Q.$('[data-act="rm-invite"]') && Q.toast('Toque em “Adicionar participante” para o próximo.', 'info'), 600); } })(host.onOpen);
    try {
      const inv = await host.invite();
      pending = inv.id;
      const cv = document.createElement('canvas');
      $('#iv-qr').innerHTML = ''; $('#iv-qr').appendChild(cv);
      P.qr(inv.code, cv, 300);
      $('#iv-copy').disabled = false;
      $('#iv-copy').onclick = async () => Q.toast((await Q.copy(inv.code)) ? 'Código copiado' : 'Não consegui copiar', 'good');
    } catch (e) { $('#iv-qr').innerHTML = `<p class="muted">Falha ao gerar o convite: ${esc(e.message)}</p>`; }
    $('#iv-scan').onclick = async () => {
      try {
        $('#iv-cam').hidden = false;
        scanner = await P.scan($('#iv-video'), (code) => { $('#iv-cam').hidden = true; connect(code); });
      } catch (e) { $('#iv-cam').hidden = true; say(e.message || 'Não consegui abrir a câmera. Use a opção de colar o código.'); }
    };
    $('#iv-ok').onclick = () => connect($('#iv-answer').value);
  };

  /* ---------- participante: entrar ---------- */
  R.join = () => {
    if (needNick()) return;
    if (guest) guest.close();
    guest = new P.Guest();
    const uid = myUid();
    const be = makeGuestBackend(guest, uid);
    let navigated = false;
    R.onSnap = (st) => {
      const d = Object.values(st.duels)[0];
      if (!d || navigated) return;
      navigated = true;
      Q.Views.duel._useBackend(be);
      be.join(d.code, S().settings.nick);
      Q.go('#/disputas/' + d.code);
      m && m.close();
    };
    const m = Q.modal(`<div class="eyebrow">Entrar na sala</div><h2>1. Escaneie o QR do anfitrião</h2>
      <div id="jn-cam" hidden><video id="jn-video" muted playsinline style="width:100%;max-height:260px;border-radius:14px;background:#000"></video></div>
      <div class="row gap wrap"><button class="btn primary" id="jn-scan">📷 Escanear QR da sala</button></div>
      <details class="mt-s"><summary class="muted" style="cursor:pointer">Prefiro colar o código</summary><div class="field mt-s"><textarea id="jn-offer" rows="3" placeholder="Cole aqui o código do anfitrião (começa com LQ1.)"></textarea></div><button class="btn" id="jn-ok">Continuar</button></details>
      <div id="jn-step2" hidden><h2 class="mt">2. Mostre este QR ao anfitrião</h2><div id="jn-qr" style="text-align:center"></div>
        <div class="row gap wrap mb" style="justify-content:center"><button class="btn sm" id="jn-copy">📋 Copiar código</button></div><p class="muted">Aguardando o anfitrião escanear… a sala abre sozinha quando conectar.</p></div>
      <p id="jn-msg" class="muted mt-s"></p>`, { cls: 'small', sticky: true, onClose: () => { if (scanner) scanner.stop(); if (!navigated && guest) { guest.close(); guest = null; } R.onSnap = null; } });
    const el = m.el, $ = (s) => Q.$(s, el);
    let scanner = null;
    const say = (t) => ($('#jn-msg').textContent = t);
    const go = async (offer) => {
      try {
        say('Preparando a conexão…');
        const answer = await guest.join(offer.trim());
        $('#jn-step2').hidden = false;
        const cv = document.createElement('canvas'); $('#jn-qr').innerHTML = ''; $('#jn-qr').appendChild(cv);
        P.qr(answer, cv, 300);
        $('#jn-copy').onclick = async () => Q.toast((await Q.copy(answer)) ? 'Código copiado' : 'Não consegui copiar', 'good');
        say('');
      } catch (e) { say(e.message || 'Não consegui usar esse código.'); }
    };
    $('#jn-scan').onclick = async () => {
      try { $('#jn-cam').hidden = false; scanner = await P.scan($('#jn-video'), (code) => { $('#jn-cam').hidden = true; go(code); }); }
      catch (e) { $('#jn-cam').hidden = true; say(e.message || 'Não consegui abrir a câmera. Use a opção de colar o código.'); }
    };
    $('#jn-ok').onclick = () => go($('#jn-offer').value);
  };

  R.act = {
    'rm-open': openRoom,
    'rm-join': R.join,
    'rm-invite': () => R.invite(),
  };
})();
