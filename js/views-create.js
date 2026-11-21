/* Localquest — "Criar questões": a IA lê os slides e elabora questões de prova (quantidade até 50, nível fácil/médio/difícil). */
(function () {
  const Q = window.Q, V = Q.V, Ai = Q.Ai, esc = Q.esc;
  const S = () => Q.Store.state;

  const removeAuto = (m) => {
    const used = new Set(S().attempts.flatMap((a) => a.answers.map((x) => x.qid)));
    S().questions = S().questions.filter((q) => !(q.materialId === m.id && q.origin === 'auto' && !used.has(q.id)));
  };

  const METHOD = {
    sample: ['✨', 'IA automática (Claude)', 'Usa a sua conta do Claude: lê os slides, entende o assunto e elabora as questões sozinha.'],
    api: ['✨', 'IA pela chave da API', 'Usa a chave cadastrada em Ajustes (cobrada à parte pela Anthropic). Também elabora tudo sozinha.'],
    chat: ['📋', 'Meu chat de IA (grátis)', 'Você copia o pedido, cola no Claude, ChatGPT ou Gemini e traz a resposta de volta. Funciona em qualquer lugar.'],
    basic: ['⚙️', 'Básico, sem IA', 'Só reorganiza frases dos slides em perguntas literais. Serve para revisão rápida; não elabora casos nem raciocínio.'],
  };

  V.openCreate = async (m) => {
    if (!m) return;
    const have = Q.Store.questionsOf(m.id).length;
    const topics = Q.Engine.activeTopics(m).filter((t) => (t.text || '').trim().length >= 15).length;
    let providers = { sample: false, api: false };
    let method = 'chat';
    let ctl = null;
    const mod = Q.modal(`<div class="eyebrow">${esc(m.title)}${m.materia ? ' · ' + esc(m.materia) : ''}</div><h2>Criar questões</h2>
      <p class="muted">A IA lê os <b>${topics}</b> slide(s) com conteúdo, entende do que se trata e elabora questões que poderiam cair na prova — usando <b>só o que está nos slides</b>.</p>
      <div id="mk-body">
        ${V.createPanelHTML('mk', 20)}
        <div class="field"><label>Como criar</label><div id="mk-methods" class="grid" style="gap:8px"></div></div>
        ${have ? '<label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px"><input type="checkbox" id="mk-rep" style="margin-top:4px"><span>Substituir as questões do modo básico que você ainda não respondeu<br><small class="muted">As de IA, as que você escreveu e as já respondidas ficam.</small></span></label>' : ''}
        <div id="mk-prog" hidden class="mb"><div class="progress"><i style="width:0"></i></div><small class="muted" id="mk-msg"></small></div>
        <p id="mk-err" class="muted" style="color:var(--bad)" hidden></p>
        <div class="row end gap"><button class="btn ghost" data-close id="mk-cancel">Cancelar</button><button class="btn primary" id="mk-go">✨ Criar questões</button></div>
      </div>`, { cls: 'wide', sticky: true, onClose: () => { if (ctl) ctl.abort(); } });
    const el = mod.el, $ = (s) => Q.$(s, el);

    const draw = () => {
      const avail = ['sample', 'api'].filter((k) => providers[k]).concat(['chat', 'basic']);
      $('#mk-methods').innerHTML = avail.map((k) => `<button type="button" class="opt-card ${method === k ? 'on' : ''}" data-m="${k}" style="align-items:flex-start"><span class="em">${METHOD[k][0]}</span><span><b>${METHOD[k][1]}</b>${k === 'basic' ? ' <span class="badge b-mute">limitado</span>' : ''}<small class="muted">${METHOD[k][2]}</small></span></button>`).join('');
      Q.$$('#mk-methods button', el).forEach((b) => (b.onclick = () => { method = b.dataset.m; draw(); }));
      $('#mk-go').textContent = method === 'chat' ? '📋 Continuar' : '✨ Criar questões';
    };
    draw();
    Ai.providers().then((p) => { providers = p; method = p.sample ? 'sample' : p.api ? 'api' : 'chat'; if (Q.$('#mk-methods', el)) draw(); });

    const fail = (msg) => { const e = $('#mk-err'); e.hidden = false; e.textContent = msg; };

    $('#mk-go').onclick = async () => {
      const c = V.readCreate(el, 'mk');
      $('#mk-err').hidden = true;
      const rep = !!($('#mk-rep') || {}).checked;
      if (method === 'basic') {
        if (rep) removeAuto(m);
        const r = Q.Autogen.create(m, { n: c.n, levels: c.levels });
        V.createToast(r); mod.close(); Q.App.refresh();
        return;
      }
      if (method === 'chat') return wizard(m, c, mod, rep);
      // IA automática
      ctl = new AbortController();
      $('#mk-prog').hidden = false; $('#mk-go').disabled = true;
      $('#mk-cancel').textContent = 'Parar';
      try {
        const r = await Ai.generateExam(m, { n: c.n, levels: c.levels, provider: method, signal: ctl.signal, onProgress: (p, msg) => { $('#mk-prog i').style.width = Math.round(p * 100) + '%'; $('#mk-msg').textContent = msg; } });
        if (rep && r.created) removeAuto(m);
        Q.Store.save();
        ctl = null;
        if (r.created >= c.n) Q.toast(`${r.created} questões de prova criadas pela IA.`, 'good', 6000);
        else if (r.created) Q.toast(`A IA criou ${r.created} de ${c.n}: o conteúdo dos slides não sustentou mais questões sem repetir.`, 'warn', 9000);
        else Q.toast('A IA não devolveu questões aproveitáveis. Tente de novo ou use “Meu chat de IA”.', 'warn', 8000);
        mod.close(); Q.App.refresh();
      } catch (e) {
        ctl = null;
        $('#mk-go').disabled = false; $('#mk-cancel').textContent = 'Cancelar';
        const got = Q.Store.questionsOf(m.id).length - have;
        if (e && e.code === 'cancelled') { fail(got ? `Parado. ${got} questão(ões) já criada(s) foram mantidas.` : 'Parado.'); if (got) Q.App.refreshQuiet(); }
        else { fail(Ai.errorText(e) + (got ? ` (${got} questão(ões) já criada(s) foram mantidas.)` : '')); if (got) Q.App.refreshQuiet(); }
      }
    };
  };

  /* ---------- caminho "meu chat de IA": pedido em partes + colar a resposta ---------- */
  function wizard(m, c, mod, rep) {
    const parts = Ai.chatParts(m, c.n, c.levels);
    let k = 0, done = 0;
    const body = Q.$('#mk-body', mod.el);
    const show = () => {
      const p = parts[k];
      body.innerHTML = `<h3 style="margin-top:0">Parte ${p.i} de ${p.k} <span class="sub">${p.n} questões</span></h3>
        <ol class="steps">
          <li><b>Copie o pedido</b><p class="muted">Ele já leva as regras e o conteúdo dos slides.</p>
            <div class="row wrap gap"><button class="btn primary" id="w-copy">📋 Copiar pedido</button><a class="btn" href="https://claude.ai/new" target="_blank" rel="noopener">Abrir o Claude</a></div>
            <details class="mt-s"><summary class="muted" style="cursor:pointer">Ver o pedido</summary><textarea id="w-prompt" rows="8" readonly style="font-family:ui-monospace,monospace;font-size:.78rem"></textarea></details></li>
          <li><b>Cole no seu chat de IA</b><p class="muted">Claude, ChatGPT ou Gemini. Se o chat aceitar, anexe também o arquivo dos slides.</p></li>
          <li><b>Traga a resposta de volta</b><p class="muted">Copie a resposta inteira (ela começa com “[”) e cole aqui.</p>
            <textarea id="w-resp" rows="6" placeholder="Cole aqui a resposta da IA"></textarea>
            <div class="row end gap mt-s"><button class="btn primary" id="w-ok">Importar parte ${p.i}</button></div></li>
        </ol>
        <p id="w-msg" class="muted"></p>
        <div class="row between gap"><small class="muted">${done} questão(ões) criada(s) até agora</small><div class="row gap">${k < parts.length - 1 ? '<button class="btn ghost" id="w-skip">Pular esta parte</button>' : ''}<button class="btn ghost" id="w-end">Concluir</button></div></div>`;
      const prompt = Ai.chatPrompt(m, p);
      Q.$('#w-prompt', body).value = prompt;
      Q.$('#w-copy', body).onclick = async () => Q.toast((await Q.copy(Ai.chatPrompt(m, p))) ? 'Pedido copiado! Cole no seu chat de IA.' : 'Não consegui copiar; abra “Ver o pedido” e copie à mão.', 'good');
      Q.$('#w-ok', body).onclick = () => {
        try {
          if (rep && done === 0) removeAuto(m);
          const r = Ai.importQuestions(m, Q.$('#w-resp', body).value, 'ai', { max: p.n });
          done += r.added.length;
          const extra = r.rejected.length ? ` ${r.rejected.length} descartada(s): ${r.rejected.slice(0, 3).map((x) => x.why).join('; ')}.` : '';
          if (!r.added.length) { Q.$('#w-msg', body).textContent = 'Nenhuma questão aproveitável nessa resposta.' + extra; return; }
          Q.toast(`${r.added.length} questões importadas.${extra}`, 'good', 6000);
          if (k < parts.length - 1) { k++; show(); } else finish();
        } catch (e) { Q.$('#w-msg', body).textContent = e.message; }
      };
      const skip = Q.$('#w-skip', body); if (skip) skip.onclick = () => { k++; show(); };
      Q.$('#w-end', body).onclick = finish;
      Q.applyTips && Q.applyTips(body);
    };
    const finish = () => { mod.close(); if (done) Q.toast(`${done} questões criadas no total.`, 'good'); Q.App.refresh(); };
    show();
  }

  V.openAi = V.openCreate; // o passo "IA pela API" do perfil Criador usa o mesmo criador
})();
