/* Localquest — desempenho (por matéria, período, curso) e ajustes. */
(function () {
  const Q = window.Q, V = Q.V, E = Q.Engine, C = Q.Charts, esc = Q.esc;
  const S = () => Q.Store.state;
  let dim = 'materia';
  const DIMS = [['materia', 'Matéria'], ['periodo', 'Período'], ['curso', 'Curso'], ['title', 'Material']];
  const matOf = (a) => Q.Store.material(a.materialId) || {};

  Q.Views.perf = {
    title: 'Desempenho',
    render() {
      const f = V.filter();
      const answers = E.answers(f);
      const sm = E.summarize(answers);
      const head = `<div class="page-h"><div><div class="eyebrow">Desempenho</div><h1>Seu desempenho</h1><p>Ajuste curso, período e matéria no filtro acima. Tudo abaixo é recalculado.</p></div>
        <button class="btn" data-act="print">🖨️ Imprimir / PDF</button></div>`;
      if (!answers.length) return head + '<div class="card empty"><div class="big">📊</div><h3>Sem respostas neste filtro</h3><p class="muted">Faça uma prova para gerar seus indicadores.</p><a class="btn primary" href="#/simulado">Montar prova</a></div>';
      const series = V.attemptSeries(f);
      const groups = E.groupBy(answers, (a) => matOf(a)[dim] || '—').sort((a, b) => b.real - a.real);
      const calib = E.calibration(answers);
      const covs = E.coverageAll(f);
      const topics = covs.flatMap((c) => c.topics.filter((x) => !x.topic.ignored && x.tries > 0).map((x) => Object.assign({ c }, x)));
      const weakest = topics.slice().sort((a, b) => a.mastery - b.mastery).slice(0, 6);
      const strongest = topics.slice().sort((a, b) => b.mastery - a.mastery).filter((x) => x.mastery >= 0.8).slice(0, 5);

      // matriz período × matéria
      const per = [...new Set(answers.map((a) => matOf(a).periodo))].sort((a, b) => String(a).localeCompare(b, 'pt-BR', { numeric: true }));
      const mat = [...new Set(answers.map((a) => matOf(a).materia))].sort();
      const cell = (p, m) => {
        const xs = answers.filter((a) => matOf(a).periodo === p && matOf(a).materia === m);
        if (!xs.length) return '<td class="faint" style="text-align:center">—</td>';
        const s = E.summarize(xs);
        return `<td style="text-align:center;background:color-mix(in srgb, ${Q.scoreColor(s.real)} 30%, transparent);font-weight:700" title="${s.n} respostas · acerto bruto ${Math.round(s.raw * 100)}%">${Math.round(s.real * 100)}%</td>`;
      };

      return head + `
      <div class="grid g4">
        <div class="card kpi"><div class="v">${sm.n}</div><div class="l">Respostas</div><div class="d muted">${series.length} prova(s)</div></div>
        <div class="card kpi"><div class="v">${Math.round(sm.real * 100)}%</div><div class="l">Domínio real</div><div class="d muted">acerto bruto ${Math.round(sm.raw * 100)}%</div></div>
        <div class="card kpi"><div class="v">${Math.round(sm.integrity * 100)}%</div><div class="l">Integridade</div><div class="d muted">${sm.fast} rápidas · ${sm.patt} em padrão</div></div>
        <div class="card kpi"><div class="v">${Q.fmtDur(sm.ms)}</div><div class="l">Tempo médio / questão</div><div class="d muted">${sm.guesses} chutes assumidos</div></div>
      </div>

      ${series.length > 1 ? `<div class="card mt"><h3>📈 Evolução por prova</h3>${C.lines([{ name: 'Domínio real', color: 'var(--accent2)', values: series.map((s) => s.sm.real), area: true }, { name: 'Acerto bruto', color: 'var(--accent)', values: series.map((s) => s.sm.raw) }, { name: 'Integridade', color: 'var(--good)', values: series.map((s) => s.sm.integrity) }], series.map((s) => Q.fmtDate(s.at.at, false)))}
        <div class="legend"><span><i style="background:var(--accent2)"></i>Domínio real</span><span><i style="background:var(--accent)"></i>Acerto bruto</span><span><i style="background:var(--good)"></i>Integridade</span></div></div>` : ''}

      <div class="split mt">
        <div class="card"><div class="row between wrap gap"><h3>🎯 Por ${DIMS.find((d) => d[0] === dim)[1].toLowerCase()}</h3><div class="seg">${DIMS.map(([k, l]) => `<button data-act="dim" data-k="${k}" class="${dim === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
          ${groups.map((g) => C.bar(g.key, g.real, { sub: `${g.n} respostas · acerto bruto ${Math.round(g.raw * 100)}% · ${g.guesses} chute(s) · ${g.overconf} erro(s) com certeza` })).join('')}
          ${per.length > 1 && mat.length > 1 ? `<div class="divider"></div><h3>🧮 Matriz período × matéria <span class="sub">domínio real</span></h3><div style="overflow:auto"><table class="tbl"><thead><tr><th></th>${mat.map((m) => `<th>${esc(m)}</th>`).join('')}</tr></thead><tbody>${per.map((p) => `<tr><td><b>${esc(p)}</b></td>${mat.map((m) => cell(p, m)).join('')}</tr>`).join('')}</tbody></table></div>` : ''}</div>
        <div class="grid" style="align-content:start">
          <div class="card"><h3>🎚️ Calibragem</h3>${calib.map((c) => C.bar(`${E.CONF_LABEL[c.conf]} (${c.n})`, c.acc, { text: c.n ? Math.round(c.acc * 100) + '%' : '—', color: c.conf === 'guess' ? 'var(--warn)' : undefined })).join('')}<small class="muted">Quanto você acerta em cada nível de segurança declarado.</small></div>
          <div class="card"><h3>🩹 Temas mais frágeis</h3>${weakest.length ? weakest.map((x) => `<div class="insight" style="grid-template-columns:1fr auto"><div><button class="chip" data-act="open-topic" data-m="${x.c.material.id}" data-t="${x.topic.id}">slide ${x.topic.n}</button> <b>${esc(x.topic.title)}</b><small class="muted">${esc(x.c.material.title)}</small></div><b style="color:${Q.scoreColor(x.mastery)}">${Math.round(x.mastery * 100)}%</b></div>`).join('') : '<p class="muted">Sem dados.</p>'}</div>
          ${strongest.length ? `<div class="card"><h3>💪 Pontos fortes</h3>${strongest.map((x) => `<div class="insight" style="grid-template-columns:1fr auto"><div><b>${esc(x.topic.title)}</b><small class="muted">${esc(x.c.material.materia)} · slide ${x.topic.n}</small></div><b style="color:var(--good)">${Math.round(x.mastery * 100)}%</b></div>`).join('')}</div>` : ''}
        </div>
      </div>

      <div class="card mt"><h3>🗺️ Cobertura dos materiais</h3><div style="overflow:auto"><table class="tbl"><thead><tr><th>Material</th><th>Temas cobrados</th><th>Dominados</th><th>Questões usadas</th><th>Situação</th></tr></thead><tbody>
        ${covs.map((c) => `<tr><td><a href="#/biblioteca/${c.material.id}"><b>${esc(c.material.title)}</b></a><br><small class="muted">${esc(c.material.materia)} · ${esc(c.material.periodo)}</small></td><td>${c.touched}/${c.total} (${Math.round(c.usage * 100)}%)</td><td>${c.mastered}/${c.total}</td><td>${c.seen}/${c.questions}</td><td>${c.exhausted ? '<span class="badge b-good">exaurido</span>' : '<span class="badge b-warn">em andamento</span>'}</td></tr>`).join('')}</tbody></table></div></div>

      <div class="card mt"><h3>🕘 Histórico de provas</h3><div style="overflow:auto"><table class="tbl"><thead><tr><th>Data</th><th>Questões</th><th>Acerto bruto</th><th>Domínio real</th><th>Integridade</th><th>Modo</th></tr></thead><tbody>
        ${series.slice().reverse().map((s) => `<tr class="click" data-act="open-attempt" data-id="${s.at.id}"><td>${Q.fmtDate(s.at.at)}</td><td>${s.sm.n}</td><td>${Math.round(s.sm.raw * 100)}%</td><td><b style="color:${Q.scoreColor(s.sm.real)}">${Math.round(s.sm.real * 100)}%</b></td><td>${Math.round(s.sm.integrity * 100)}%</td><td>${s.at.mode === 'estudo' ? 'Estudo' : 'Prova'}</td></tr>`).join('')}</tbody></table></div></div>`;
    },
    act: {
      dim: (el) => { dim = el.dataset.k; Q.App.refresh(); },
      print: () => window.print(),
      'open-attempt': (el) => Q.go('#/resultado/' + el.dataset.id),
    },
  };

  /* ---------- ajustes ---------- */
  let advMat = null;
  const advanced = (st) => {
    const mats = S().materials;
    if (!advMat || !Q.Store.material(advMat)) advMat = mats[0] ? mats[0].id : null;
    const m = advMat ? Q.Store.material(advMat) : null;
    const nq = m ? Q.Store.questionsOf(m.id).length : 0;
    const en = S().enamed || [];
    const enLinked = S().questions.filter((q) => q.origin === 'enamed').length;
    return `<div class="card mt" id="adv"><div class="eyebrow">Versão avançada</div><h2>Mais controle sobre as questões</h2>
      <p class="muted">Para quem quer ir além das questões automáticas. Escolha o material e siga os passos; cada um funciona sozinho.</p>
      ${mats.length ? `<div class="field" style="max-width:460px"><label>Material</label><select data-change="adv-mat">${mats.map((x) => `<option value="${x.id}" ${x.id === advMat ? 'selected' : ''}>${esc(x.materia)} · ${esc(x.title)}</option>`).join('')}</select><small class="muted">${nq} questão(ões) neste material.</small></div>` : '<p class="muted"><b>Envie um material na Biblioteca para habilitar estes passos.</b></p>'}
      <ol class="steps">
        <li><b>Gerar o prompt</b><p class="muted">Copia um texto com as regras (4 alternativas, sem pistas, justificativas extraídas do slide, imagem só quando essencial) e o conteúdo dos slides. Cole em qualquer IA.</p>
          <button class="btn" data-act="adv-prompt" ${m ? '' : 'disabled'}>🧾 Prompt para IA</button></li>
        <li><b>Importar a resposta (JSON)</b><p class="muted">Cole a resposta inteira da IA. Repetidas são ignoradas e todas passam pelo escudo anti-chute.</p>
          <button class="btn" data-act="adv-import" ${m ? '' : 'disabled'}>📥 Importar JSON</button>
          <details class="mt-s"><summary class="muted" style="cursor:pointer">Ver o formato esperado</summary><pre class="pre" style="font-size:.8rem;overflow:auto">[
  {
    "slides": [3],
    "enunciado": "…",
    "alternativas": ["…", "…", "…", "…"],
    "correta": "B",
    "explicacao": "por que a B está certa (trecho do slide)",
    "justificativas": { "A": "por que A está errada", "C": "…", "D": "…" },
    "usa_imagem_do_slide": null,
    "dificuldade": 2
  }
]</pre></details></li>
        <li><b>Qualidade da IA pela API <span class="muted">(opcional, é cobrada à parte)</span></b><p class="muted">Com uma chave da API da Anthropic o app gera tudo sozinho e troca as questões automáticas ainda não respondidas. A chave fica só neste navegador.</p>
          <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px"><input type="checkbox" id="aiq" ${st.aiQuality ? 'checked' : ''} style="margin-top:4px"><span>Usar a IA automaticamente ao enviar materiais novos</span></label>
          <div class="grid g2"><div class="field"><label>Chave de API</label><input type="password" id="apikey" value="${esc(st.apiKey)}" placeholder="sk-ant-…" autocomplete="off"></div>
          <div class="field"><label>Modelo</label><input type="text" id="model" value="${esc(st.model)}"></div></div>
          <div class="row wrap gap"><button class="btn" data-act="save-ai">💾 Salvar configuração</button><button class="btn primary" data-act="adv-ai" ${m ? '' : 'disabled'}>✨ Refazer este material com IA</button></div></li>
        <li><b>Completar com questões automáticas</b><p class="muted">Cria questões para os slides deste material que ainda não têm nenhuma.</p>
          <button class="btn" data-act="adv-auto" ${m ? '' : 'disabled'}>⚙️ Gerar automaticamente</button></li>
        <li><b>Base ENAMED local</b><p class="muted">Com o botão <b>ENAMED</b> (topo da página) ligado, as questões importadas aqui são vinculadas aos temas das suas aulas. Baixe o <b>caderno</b> e o <b>gabarito</b> oficiais no portal do INEP e importe os dois arquivos (PDF ou TXT). O processamento é local; nada é enviado. Questões que dependem de figura são ignoradas.</p>
          <div class="row wrap gap mb"><a class="btn sm" target="_blank" rel="noopener" href="${Q.Enamed.OFFICIAL_URL}">🌐 Página oficial (gov.br)</a><a class="btn sm" target="_blank" rel="noopener" href="${Q.Enamed.provasUrl()}">📄 Buscar provas e gabaritos do INEP</a></div>
          <div class="grid g3"><div class="field"><label>Caderno de prova</label><input type="file" id="en-cad" accept=".pdf,.txt"></div><div class="field"><label>Gabarito</label><input type="file" id="en-gab" accept=".pdf,.txt"></div><div class="field"><label>Identificação</label><input type="text" id="en-label" value="ENAMED ${new Date().getFullYear() - 1}"></div></div>
          <div class="row wrap gap"><button class="btn" data-act="en-import">📥 Importar ENAMED</button>${en.length ? '<button class="btn danger" data-act="en-clear">Remover base ENAMED</button>' : ''}</div>
          <small class="muted">${en.length ? `${en.length} questão(ões) importada(s) · ${enLinked} vinculada(s) aos seus temas.` : 'Nenhuma questão importada.'}</small></li>
      </ol></div>`;
  };

  Q.Views.settings = {
    title: 'Ajustes',
    render() {
      const st = S().settings;
      return `
      <div class="page-h"><div><div class="eyebrow">Ajustes</div><h1>Preferências</h1></div></div>
      <div class="grid g2">
        <div class="card"><h3>🎨 Aparência</h3><div class="seg"><button data-act="theme" data-v="dark" class="${st.theme === 'dark' ? 'on' : ''}">🌙 Escuro</button><button data-act="theme" data-v="light" class="${st.theme === 'light' ? 'on' : ''}">☀️ Claro</button></div></div>
        <div class="card"><h3>🛡️ Anti-chute</h3><p class="muted">Máximo de letras certas iguais seguidas no gabarito.</p><div class="seg">${[1, 2, 3].map((n) => `<button data-act="maxrun" data-v="${n}" class="${(st.maxRun || 2) === n ? 'on' : ''}">${n}</button>`).join('')}</div><p class="muted mt-s"><small>Padrão 2: AA é permitido, AAA não. Escadas (A-B-C) e alternâncias (A-B-A-B) sempre são evitadas.</small></p></div>
        <div class="card"><h3>💾 Dados</h3><p class="muted">Seus dados ficam só neste navegador. Faça backup para trocar de computador (a chave de API não é exportada).</p>
          <div class="row wrap gap"><button class="btn" data-act="export">⬇️ Exportar backup</button><button class="btn" data-act="import">⬆️ Restaurar backup</button><input type="file" id="bk" accept=".json" hidden></div>
          <div class="divider"></div><div class="row wrap gap"><button class="btn" data-act="demo">✨ Carregar exemplo</button><button class="btn danger" data-act="reset">Apagar tudo</button></div>
          <p class="muted mt-s"><small>${Q.Store.persistent ? 'Armazenamento local ativo (IndexedDB).' : '⚠️ Armazenamento local indisponível: os dados serão perdidos ao fechar a página.'}</small></p></div>
      </div>
      ${advanced(st)}
      <div class="card mt"><h3>ℹ️ Como o Localquest pontua</h3>
        <p class="muted"><b>Acerto bruto</b> = % de questões corretas. <b>Domínio real</b> = cada acerto vale 100% se marcado com “certeza”, 60% com “dúvida” e 0% se for “chute”; respostas rápidas demais para a leitura ou em padrão de marcação valem metade. Erros valem 0. <b>Integridade</b> = % de respostas sem sinais de comportamento de chute. Um tema é <b>dominado</b> com domínio ≥ 80% (peso maior para as respostas mais recentes), <b>em progresso</b> de 50% a 80% e <b>frágil</b> abaixo de 50%. Um material é <b>exaurido</b> quando todos os temas ativos têm questões e foram cobrados e todas as questões do banco já foram respondidas.</p></div>`;
    },
    act: {
      theme: (el) => { S().settings.theme = el.dataset.v; Q.Store.save(); Q.App.applyTheme(); Q.App.refresh(); },
      maxrun: (el) => { S().settings.maxRun = +el.dataset.v; Q.Store.save(); Q.App.refresh(); },
      'adv-prompt': () => V.openPrompt(Q.Store.material(advMat)),
      'adv-import': () => V.openImport(Q.Store.material(advMat)),
      'adv-ai': () => { S().settings.apiKey = (Q.$('#apikey') || {}).value ? Q.$('#apikey').value.trim() : S().settings.apiKey; V.openAi(Q.Store.material(advMat)); },
      'adv-auto': () => { const n = Q.Autogen.fill(Q.Store.material(advMat)); Q.toast(n ? `${n} questões criadas` : 'Todos os slides já têm questões', n ? 'good' : 'info'); Q.App.refresh(); },
      'en-clear': async () => { if (await Q.confirm('Remover todas as questões do ENAMED importadas?', 'Remover')) { S().enamed = []; S().questions = S().questions.filter((q) => q.origin !== 'enamed'); Q.Store.save(); Q.App.refresh(); } },
      'en-import': async () => {
        const cad = Q.$('#en-cad').files[0], gab = Q.$('#en-gab').files[0];
        if (!cad || !gab) return Q.toast('Escolha o caderno e o gabarito.', 'warn');
        try {
          const r = await Q.Enamed.importFiles(cad, gab, Q.$('#en-label').value.trim() || 'ENAMED');
          Q.toast(`${r.found} questões lidas · ${r.added} importadas · ${r.linked} vinculadas aos seus temas${r.noKey ? ` · ${r.noKey} sem gabarito` : ''}${r.fig ? ` · ${r.fig} com figura ignoradas` : ''}`, r.added ? 'good' : 'warn', 9000);
          Q.App.refresh();
        } catch (e) { Q.toast('Não consegui ler os arquivos: ' + e.message, 'bad', 7000); }
      },
      'save-ai': () => { S().settings.apiKey = Q.$('#apikey').value.trim(); S().settings.aiQuality = Q.$('#aiq').checked; S().settings.model = Q.$('#model').value.trim() || 'claude-sonnet-5-5'; Q.Store.save(); Q.toast('Configuração salva', 'good'); },
      export: async () => { Q.download(`localquest-backup-${new Date().toISOString().slice(0, 10)}.json`, await Q.Store.exportAll()); },
      import: () => Q.$('#bk').click(),
      demo: async () => { await Q.Demo.load({ history: true }); Q.toast('Exemplo carregado', 'good'); Q.App.refresh(); },
      reset: async () => { if (await Q.confirm('Apagar TODOS os materiais, questões e histórico deste navegador?', 'Apagar tudo')) { await Q.Store.reset(); Q.toast('Tudo apagado'); Q.go('#/inicio'); Q.App.refresh(); } },
    },
    change: { 'adv-mat': (el) => { advMat = el.value; Q.App.refresh(); } },
    mount() {
      const bk = Q.$('#bk');
      if (bk) bk.onchange = async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try { await Q.Store.importAll(await Q.readFileText(f)); Q.toast('Backup restaurado', 'good'); Q.App.applyTheme(); Q.go('#/inicio'); Q.App.refresh(); } catch (err) { Q.toast(err.message, 'bad'); }
      };
    },
  };
})();
