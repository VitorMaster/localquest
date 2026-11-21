/* Localquest — banco de questões: lista, editor com lint ao vivo, importação, prompt e geração por IA. */
(function () {
  const Q = window.Q, V = Q.V, E = Q.Engine, G = Q.Guard, esc = Q.esc;
  const S = () => Q.Store.state;
  let onlyIssues = false;

  const lintHtml = (issues) =>
    issues.length
      ? issues.map((i) => `<div class="${i.level}">${i.level === 'bad' ? '⛔' : '⚠️'} ${esc(i.msg)}</div>`).join('')
      : '<div style="color:var(--good)">✅ Sem pistas detectadas</div>';

  /* ---------- editor ---------- */
  function openEditor(materialId, qid) {
    const m = Q.Store.material(materialId);
    const ex = qid ? Q.Store.question(qid) : null;
    const extra = new Set(); // imagens avulsas enviadas aqui
    const chosenImgs = new Set(ex ? ex.imageIds || [] : []);
    const topicsHtml = m.topics.map((t) => `<label style="display:flex;gap:8px;align-items:center;padding:4px 0"><input type="checkbox" data-topic value="${t.id}" ${ex && (ex.topicIds || []).includes(t.id) ? 'checked' : ''}><span><b>${t.n}</b> ${esc(t.title)}${t.ignored ? ' <small class="muted">(ignorado)</small>' : ''}</span></label>`).join('');
    const mod = Q.modal(`
      <div class="eyebrow">${esc(m.title)}</div><h2>${ex ? 'Editar questão' : 'Nova questão'}</h2>
      <div class="field"><label>Slides de origem (obrigatório para o mapa de cobertura)</label><div style="max-height:150px;overflow:auto;padding:8px 12px;border:1px solid var(--line);border-radius:12px">${topicsHtml}</div></div>
      <div class="field"><label>Enunciado</label><textarea id="q-stem" rows="3" placeholder="Escreva a pergunta com base apenas no que está no slide">${esc(ex ? ex.stem : '')}</textarea></div>
      <div class="field"><label>Alternativas — marque a correta</label>
        ${[0, 1, 2, 3].map((i) => `<div class="opt-edit"><input type="radio" name="correct" value="${i}" ${ex && ex.correct === i ? 'checked' : ''} aria-label="Alternativa ${Q.LETTERS[i]} correta"><input type="text" class="q-opt" data-i="${i}" placeholder="Alternativa ${Q.LETTERS[i]}" value="${esc(ex ? ex.options[i] : '')}"></div>
          <div class="opt-edit" style="margin:-4px 0 10px"><span></span><input type="text" class="q-why" data-i="${i}" placeholder="Por que a ${Q.LETTERS[i]} NÃO é a correta (segundo o slide) — opcional" value="${esc(ex && ex.whyNot ? ex.whyNot[i] || '' : '')}" style="font-size:.85rem"></div>`).join('')}
        <small class="muted">A ordem é embaralhada a cada prova. Mantenha as 4 alternativas com tamanho parecido.</small></div>
      <div class="field"><label>Por que a correta é a correta (trecho do slide)</label><textarea id="q-exp" rows="2">${esc(ex ? ex.explanation : '')}</textarea></div>
      <div class="field"><label>Imagem na questão (use só se for essencial para o aprendizado)</label><div id="q-imgs" class="pick-imgs"></div>
        <div class="row gap mt-s"><button class="btn sm" id="q-up">🖼️ Anexar outra imagem</button><input type="file" id="q-file" accept="image/*" hidden><small class="muted">Marque a figura apenas quando ela for necessária para raciocinar.</small></div></div>
      <div class="grid g2"><div class="field"><label>Dificuldade</label><select id="q-diff">${[1, 2, 3].map((d) => `<option value="${d}" ${(ex ? ex.difficulty : 2) === d ? 'selected' : ''}>${['', 'Fácil (lembrar)', 'Média (compreender)', 'Difícil (aplicar)'][d]}</option>`).join('')}</select></div>
        <div class="field"><label>Ordem</label><label style="display:flex;gap:8px;align-items:center;text-transform:none;letter-spacing:0;font-size:.9rem;color:var(--text);font-weight:500"><input type="checkbox" id="q-fixed" ${ex && ex.fixedOrder ? 'checked' : ''}> Manter a ordem das alternativas<br><small class="muted">(ex.: “apenas I e II”)</small></label></div></div>
      <div class="card flat tight" id="q-lint"></div>
      <div class="row end gap mt"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="q-save">Salvar questão</button></div>`, { cls: 'wide', sticky: true });
    const el = mod.el, $ = (s) => Q.$(s, el);

    const read = () => {
      const c = el.querySelector('input[name=correct]:checked');
      return {
        stem: $('#q-stem').value.trim(), options: Q.$$('.q-opt', el).map((i) => i.value.trim()),
        correct: c ? +c.value : -1, topicIds: Q.$$('[data-topic]:checked', el).map((i) => i.value),
      };
    };
    const refreshImgs = () => {
      const tids = Q.$$('[data-topic]:checked', el).map((i) => i.value);
      const list = [];
      tids.forEach((tid) => m.topics.find((t) => t.id === tid).images.forEach((i) => list.push(i)));
      extra.forEach((id) => list.push({ id, alt: 'imagem anexada' }));
      (ex ? ex.imageIds || [] : []).forEach((id) => { if (!list.some((i) => i.id === id)) list.push({ id, alt: 'imagem da questão' }); });
      $('#q-imgs').innerHTML = list.length ? list.map((i) => `<label><input type="checkbox" value="${i.id}" ${chosenImgs.has(i.id) ? 'checked' : ''}>${V.img(i.id)}</label>`).join('') : '<small class="muted">Nenhuma imagem disponível nos slides marcados.</small>';
      Q.Store.hydrateImages($('#q-imgs'));
    };
    const refreshLint = () => {
      const r = read();
      const base = r.options.every((o) => o) && r.correct >= 0 ? G.lint(Object.assign({}, r, { fixedOrder: false })) : [{ level: 'warn', msg: 'Preencha as 4 alternativas e marque a correta para ver a análise.' }];
      $('#q-lint').innerHTML = `<div class="lbl" style="margin-bottom:6px">Escudo anti-chute</div><div class="lint">${lintHtml(base)}</div>`;
    };
    el.addEventListener('input', refreshLint);
    el.addEventListener('change', (e) => {
      if (e.target.matches('#q-imgs input')) e.target.checked ? chosenImgs.add(e.target.value) : chosenImgs.delete(e.target.value);
      if (e.target.matches('[data-topic]')) {
        const t = m.topics.find((x) => x.id === e.target.value);
        if (!e.target.checked) t.images.forEach((i) => chosenImgs.delete(i.id));
        refreshImgs();
      }
      refreshLint();
    });
    $('#q-up').onclick = () => $('#q-file').click();
    $('#q-file').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const id = await Q.Ingest.addImageFile(f);
      extra.add(id);
      chosenImgs.add(id);
      refreshImgs();
    };
    $('#q-save').onclick = () => {
      const r = read();
      if (r.stem.length < 8) return Q.toast('Escreva o enunciado.', 'warn');
      if (r.options.some((o) => !o)) return Q.toast('Preencha as 4 alternativas.', 'warn');
      if (r.correct < 0) return Q.toast('Marque a alternativa correta.', 'warn');
      const data = Object.assign(r, {
        explanation: $('#q-exp').value.trim(), whyNot: Q.$$('.q-why', el).map((i, k) => (k === r.correct ? '' : i.value.trim())), imageIds: [...chosenImgs], difficulty: +$('#q-diff').value, fixedOrder: $('#q-fixed').checked,
      });
      if (ex) Object.assign(ex, data);
      else S().questions.push(Object.assign({ id: Q.uid('q'), materialId: m.id, origin: 'manual', createdAt: Date.now() }, data));
      Q.Store.save();
      const worst = G.worstLevel(G.lint(data));
      Q.toast(worst === 'bad' ? 'Salva — mas há alertas graves de pista.' : 'Questão salva', worst === 'bad' ? 'warn' : 'good');
      mod.close();
      Q.App.refresh();
    };
    refreshImgs();
    refreshLint();
  }

  /* ---------- importar / prompt / IA ---------- */
  function openImport(m) {
    const mod = Q.modal(`
      <div class="eyebrow">${esc(m.title)}</div><h2>Importar questões (JSON)</h2>
      <p class="muted">Cole aqui a resposta da IA (formato do prompt do Localquest) ou escolha um arquivo .json. Questões repetidas são ignoradas e cada uma passa pelo escudo anti-chute.</p>
      <div class="field"><textarea id="imp" rows="10" placeholder='[ { "slides":[3], "enunciado":"…", "alternativas":["…","…","…","…"], "correta":"B", "explicacao":"…" } ]'></textarea></div>
      <div class="row gap"><button class="btn sm" id="imp-f">📂 Escolher arquivo</button><input type="file" id="imp-file" accept=".json,.txt" hidden></div>
      <div id="imp-r" class="mt-s"></div>
      <div class="row end gap mt"><button class="btn ghost" data-close>Fechar</button><button class="btn primary" id="imp-go">Importar</button></div>`, { cls: 'wide' });
    const el = mod.el;
    Q.$('#imp-f', el).onclick = () => Q.$('#imp-file', el).click();
    Q.$('#imp-file', el).onchange = async (e) => { if (e.target.files[0]) Q.$('#imp', el).value = await Q.readFileText(e.target.files[0]); };
    Q.$('#imp-go', el).onclick = () => {
      try {
        const r = Q.Ai.importQuestions(m, Q.$('#imp', el).value);
        Q.$('#imp-r', el).innerHTML = `<div class="verdict ${r.added.length ? 'ok' : 'todo'}"><span class="em">${r.added.length ? '✅' : '⚠️'}</span><div><b>${r.added.length} questão(ões) importada(s)</b><br><small>${r.flagged ? r.flagged + ' com alertas graves de pista (revise no banco). ' : ''}${r.rejected.length ? 'Rejeitadas: ' + r.rejected.map((x) => `#${x.i} (${esc(x.why)})`).join(', ') : ''}</small></div></div>`;
        Q.App.refreshQuiet();
        if (r.added.length) Q.$('#imp', el).value = '';
      } catch (e) { Q.toast(e.message, 'bad', 6000); }
    };
  }

  function openPrompt(m) {
    const mod = Q.modal(`
      <div class="eyebrow">${esc(m.title)}</div><h2>Prompt para gerar questões</h2>
      <p class="muted">Cole este prompt em qualquer IA (Claude, ChatGPT…) — se puder, anexe também o arquivo dos slides para ela ver as figuras. Depois copie a resposta e use <b>Importar JSON</b>.</p>
      <div class="row gap mb"><label class="lbl" for="pp-n">Questões por slide</label><select id="pp-n" style="width:auto">${[1, 2, 3].map((n) => `<option ${n === 2 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <textarea id="pp" rows="14" readonly style="font-family:ui-monospace,monospace;font-size:.8rem"></textarea>
      <div class="row end gap mt"><button class="btn ghost" data-close>Fechar</button><button class="btn primary" id="pp-c">📋 Copiar prompt</button></div>`, { cls: 'wide' });
    const el = mod.el, upd = () => (Q.$('#pp', el).value = Q.Ai.buildPrompt(m, { perSlide: +Q.$('#pp-n', el).value }));
    Q.$('#pp-n', el).onchange = upd;
    upd();
    Q.$('#pp-c', el).onclick = async () => Q.toast((await Q.copy(Q.$('#pp', el).value)) ? 'Prompt copiado!' : 'Não consegui copiar; selecione o texto manualmente.', 'good');
  }

  function openAi(m) {
    if (!Q.Ai.hasKey()) {
      Q.modal(`<h2>Gerar com IA</h2><p class="muted">Para gerar questões direto aqui, cadastre sua chave da API da Anthropic em <b>Ajustes</b>. A chave fica só neste navegador.</p><p class="muted">Sem chave? Use <b>Prompt para IA</b> + <b>Importar JSON</b>.</p><div class="row end gap"><button class="btn ghost" data-close>Fechar</button><a class="btn primary" href="#/ajustes" data-close>Abrir Ajustes</a></div>`, { cls: 'small' });
      return;
    }
    const mod = Q.modal(`<div class="eyebrow">${esc(m.title)}</div><h2>Gerar questões com IA</h2>
      <p class="muted">O Localquest envia o texto (e a primeira figura) dos slides ativos à API e importa o resultado já passando pelo escudo anti-chute.</p>
      <div class="field"><label>Questões por slide</label><select id="ai-n">${[1, 2, 3].map((n) => `<option ${n === 2 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:14px"><input type="checkbox" id="ai-rep" checked style="margin-top:4px"><span><b>Substituir as questões automáticas</b><br><small class="muted">As automáticas ainda não respondidas saem; as que já entraram no seu histórico e as que você escreveu ficam.</small></span></label>
      <div id="ai-p" hidden><div class="progress"><i style="width:0"></i></div><small class="muted" id="ai-m"></small></div>
      <div class="row end gap mt"><button class="btn ghost" data-close>Fechar</button><button class="btn primary" id="ai-go">✨ Gerar</button></div>`, { sticky: true });
    const el = mod.el;
    Q.$('#ai-go', el).onclick = async () => {
      Q.$('#ai-go', el).disabled = true; Q.$('#ai-p', el).hidden = false;
      try {
        const r = await Q.Ai.generate(m, { perSlide: +Q.$('#ai-n', el).value, replaceAuto: Q.$('#ai-rep', el).checked, onProgress: (p, msg) => { Q.$('#ai-p i', el).style.width = Math.round(p * 100) + '%'; Q.$('#ai-m', el).textContent = msg; } });
        Q.toast(`${r.added} questões geradas pela IA${r.removed ? `, ${r.removed} automáticas substituídas` : ''}${r.flagged ? ` (${r.flagged} com alertas)` : ''}${r.rejected ? `, ${r.rejected} rejeitadas` : ''}`, 'good', 6000);
        mod.close(); Q.App.refresh();
      } catch (e) { Q.toast(e.message, 'bad', 8000); Q.$('#ai-go', el).disabled = false; Q.App.refreshQuiet(); }
    };
  }

  V.openAi = openAi; V.openPrompt = openPrompt; V.openImport = openImport;

  /* ---------- tela ---------- */
  Q.Views.bank = {
    title: 'Banco de questões',
    curId: null,
    render(params) {
      const mats = E.materials(V.filter());
      if (!S().materials.length) return '<div class="page-h"><div><div class="eyebrow">Banco</div><h1>Banco de questões</h1></div></div><div class="card empty"><div class="big">📝</div><p class="muted">Envie um material na Biblioteca primeiro.</p><a class="btn primary" href="#/biblioteca">Ir para Biblioteca</a></div>';
      let id = params && params[0] ? params[0] : this.curId;
      if (!Q.Store.material(id)) id = (mats[0] || S().materials[0]).id;
      this.curId = id;
      const m = Q.Store.material(id);
      const qs = Q.Store.questionsOf(id);
      const rows = qs.map((q) => ({ q, issues: G.lint(q) }));
      const cov = E.coverage(m);
      const bad = rows.filter((r) => G.worstLevel(r.issues) === 'bad').length;
      const warn = rows.filter((r) => G.worstLevel(r.issues) === 'warn').length;
      const longest = qs.length ? Math.round((qs.filter((q) => q.options.every((o) => o) && q.options[q.correct].length === Math.max(...q.options.map((o) => o.length))).length / qs.length) * 100) : 0;
      const shown = onlyIssues ? rows.filter((r) => r.issues.length) : rows;
      const all = S().materials;
      return `
      <div class="page-h"><div><div class="eyebrow">Banco</div><h1>Banco de questões</h1><p>Questões vinculadas aos slides — é isso que alimenta o mapa de cobertura.</p></div>
        <div class="row wrap gap"><button class="btn primary" data-act="new-q">➕ Nova questão</button><a class="btn ghost" href="#/ajustes">⚙️ Versão avançada</a></div></div>
      <div class="card mb"><div class="row between wrap gap">
        <div class="field" style="margin:0;min-width:260px"><label>Material</label><select data-change="bank-mat">${all.map((x) => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${esc(x.materia)} · ${esc(x.title)}</option>`).join('')}</select></div>
        <div class="stat-row" style="margin:0;flex:1;min-width:300px"><div class="stat"><b>${qs.length}</b><small>questões</small></div><div class="stat"><b>${cov.inBank}/${cov.total}</b><small>slides com questão</small></div><div class="stat"><b style="color:${bad ? 'var(--bad)' : 'var(--good)'}">${bad}</b><small>com pistas graves</small></div><div class="stat"><b>${Q.pct(qs.filter((q) => (q.imageIds || []).length).length, qs.length)}%</b><small>com imagem (ideal ≤ 20%)</small></div><div class="stat"><b>${longest}%</b><small>certa é a maior (ideal ≈ 25%)</small></div></div></div>
        ${cov.topics.some((x) => x.nobank) ? `<p class="muted mt-s">📝 Slides sem questão: ${cov.topics.filter((x) => x.nobank).map((x) => `<button class="chip" data-act="open-topic" data-m="${m.id}" data-t="${x.topic.id}">${x.topic.n}</button>`).join(' ')}</p>` : ''}</div>
      <div class="card"><div class="row between wrap gap"><h3>Questões <span class="sub">${shown.length} exibida(s)${warn ? ` · ${warn} com avisos` : ''}</span></h3>
        <label style="display:flex;gap:8px;align-items:center;font-size:.88rem"><input type="checkbox" data-change="only-issues" ${onlyIssues ? 'checked' : ''}> só com alertas</label></div>
        ${shown.length ? shown.map(({ q, issues }, i) => {
          const tn = (q.topicIds || []).map((tid) => (Q.Store.topic(m.id, tid) || {}).n).filter(Boolean).sort((a, b) => a - b);
          const w = G.worstLevel(issues);
          return `<div class="q-item"><div>
            <div class="row wrap gap" style="margin-bottom:6px">${tn.length ? `<span class="chip">Slide${tn.length > 1 ? 's' : ''} ${tn.join(', ')}</span>` : '<span class="badge b-warn">sem slide</span>'}${(q.imageIds || []).length ? `<span class="chip">🖼️ ${(q.imageIds || []).length}</span>` : ''}<span class="chip">${['', 'Fácil', 'Média', 'Difícil'][q.difficulty || 2]}</span>${q.origin === 'ai' ? '<span class="chip">IA</span>' : q.origin === 'auto' ? '<span class="chip">auto</span>' : ''}<span class="badge ${w === 'ok' ? 'b-good' : w === 'warn' ? 'b-warn' : 'b-bad'}">${w === 'ok' ? 'sem pistas' : w === 'warn' ? 'avisos' : 'pistas graves'}</span></div>
            <div class="stem">${rows.indexOf(rows.find((r) => r.q === q)) + 1}. ${esc(q.stem)}</div>
            ${(q.imageIds || []).length ? `<div class="thumbs" style="margin:6px 0">${q.imageIds.map((id) => `<button style="border:0;background:none;padding:0" data-act="zoom-img" data-img="${id}">${V.img(id, 'thumb')}</button>`).join('')}</div>` : ''}
            <ul class="q-opts">${q.options.map((o, k) => `<li class="${k === q.correct ? 'ok' : ''}">${Q.LETTERS[k]}) ${esc(o)}${k === q.correct ? ' ✔' : ''}</li>`).join('')}</ul>
            ${issues.length ? `<div class="lint">${lintHtml(issues)}</div>` : ''}</div>
            <div class="row gap wrap" style="align-self:start"><button class="btn sm" data-act="edit-q" data-id="${q.id}">Editar</button><button class="btn sm danger" data-act="del-q" data-id="${q.id}">Excluir</button></div></div>`;
        }).join('') : `<div class="empty"><div class="big">🧩</div><p class="muted">${qs.length ? 'Nenhuma questão com alertas. 🎉' : 'Ainda não há questões neste material. Crie, importe um JSON ou gere com IA.'}</p></div>`}</div>`;
    },
    act: {
      'new-q': () => openEditor(Q.Views.bank.curId),
      'edit-q': (el) => openEditor(Q.Views.bank.curId, el.dataset.id),
      'del-q': async (el) => {
        if (await Q.confirm('Excluir esta questão?', 'Excluir')) {
          S().questions = S().questions.filter((q) => q.id !== el.dataset.id);
          Q.Store.save(); Q.App.refresh();
        }
      },
      autogen: () => {
        const m = Q.Store.material(Q.Views.bank.curId);
        const n = Q.Autogen.fill(m);
        Q.toast(n ? `${n} questões criadas para os slides sem questão` : 'Todos os slides já têm questões', n ? 'good' : 'info');
        Q.App.refresh();
      },
      import: () => openImport(Q.Store.material(Q.Views.bank.curId)),
      prompt: () => openPrompt(Q.Store.material(Q.Views.bank.curId)),
      ai: () => openAi(Q.Store.material(Q.Views.bank.curId)),
    },
    change: {
      'bank-mat': (el) => { Q.Views.bank.curId = el.value; history.replaceState(null, '', '#/banco/' + el.value); Q.App.refresh(); },
      'only-issues': (el) => { onlyIssues = el.checked; Q.App.refresh(); },
    },
  };
})();
