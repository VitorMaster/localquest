/* Localquest — simulado: configuração, execução e resultado/panorama. */
(function () {
  const Q = window.Q, V = Q.V, E = Q.Engine, G = Q.Guard, C = Q.Charts, esc = Q.esc;
  const S = () => Q.Store.state;
  const cfg = { materialIds: null, n: 0, strategy: 'misto', timer: 0, excluded: new Set(), open: new Set() };

  const effective = (ids) => E.pool(ids, [...cfg.excluded], Q.Enamed.enabled());

  Q.Exam = {
    /** Um toque: simula TODAS as questões dos materiais (as questões foram criadas quando o material foi inserido). */
    quick(materialIds, extra = {}) {
      const ids = materialIds.filter((id) => Q.Store.material(id));
      if (!ids.length) return Q.toast('Envie ao menos um material na Biblioteca.', 'warn');
      this.start(Object.assign({ materialIds: ids, n: 99999, strategy: 'misto', mode: 'estudo', useImages: S().settings.useImages !== false, enamed: Q.Enamed.enabled(), filter: Object.assign({}, V.filter()) }, extra));
    },
    start(opts) {
      if (!opts.materialIds.length) return Q.toast('Selecione ao menos um material.', 'warn');
      const ses = E.buildSession(Object.assign({ mode: 'estudo' }, opts));
      if (!ses.items.length) return Q.toast('Não há questões disponíveis para esse escopo.', 'warn');
      S().session = ses;
      Q.Store.saveNow();
      Q.go('#/prova');
    },
  };

  /* ====================== CONFIGURAÇÃO ====================== */
  const STRATS = [
    ['misto', '⚖️', 'Misto', 'Equilibra temas inéditos e pontos fracos (recomendado).'],
    ['cobertura', '🧭', 'Cobertura', 'Prioriza slides ainda não cobrados para exaurir o conteúdo.'],
    ['fraquezas', '🩹', 'Pontos fracos', 'Foca no que você errou ou acertou com dúvida.'],
    ['aleatorio', '🎲', 'Aleatório', 'Sorteio simples do banco.'],
  ];

  Q.Views.exam = {
    title: 'Simulado',
    render() {
      const mats = E.materials(V.filter());
      const shown = mats.length ? mats : S().materials;
      const preset = S().ui.examPreset;
      if (preset) { cfg.materialIds = preset.materialIds.filter((id) => Q.Store.material(id)); delete S().ui.examPreset; }
      if (!cfg.materialIds) cfg.materialIds = shown.map((m) => m.id);
      cfg.materialIds = cfg.materialIds.filter((id) => Q.Store.material(id));
      const useImg = S().settings.useImages !== false;
      const fullPool = effective(cfg.materialIds);
      const imgQs = fullPool.filter((q) => (q.imageIds || []).length).length;
      const pool = useImg ? fullPool.length : fullPool.length - imgQs;
      const n = Math.min(cfg.n === 0 ? pool : cfg.n, pool);
      const sesBanner = S().session ? `<div class="card mb row between wrap gap" style="border-color:var(--accent2)"><div><b>Você tem uma prova em andamento</b><br><small class="muted">${S().session.items.filter((i) => i.a).length} de ${S().session.items.length} respondidas.</small></div><a class="btn primary" href="#/prova">▶ Continuar</a></div>` : '';
      if (!S().materials.length) return '<div class="page-h"><div><div class="eyebrow">Simulado</div><h1>Montar prova</h1></div></div><div class="card empty"><div class="big">📚</div><h3>Nenhum material ainda</h3><p class="muted">Envie os slides e as questões são criadas automaticamente.</p><a class="btn primary" href="#/biblioteca">Enviar slides</a></div>';
      const en = Q.Enamed.enabled();
      const enQs = S().questions.filter((q) => q.origin === 'enamed' && cfg.materialIds.includes(q.materialId)).length;
      const matCard = (m) => {
        const cov = E.coverage(m);
        const on = cfg.materialIds.includes(m.id);
        const act = Q.Engine.activeTopics(m);
        const exc = act.filter((t) => cfg.excluded.has(t.id)).length;
        const open = cfg.open.has(m.id);
        return `<div class="opt-card mt-s" style="flex-direction:column;gap:10px;cursor:default">
          <div class="row gap" style="align-items:center"><input type="checkbox" data-change="cfg-mat" value="${m.id}" ${on ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--accent2)" aria-label="Selecionar ${esc(m.title)}">
            <span style="flex:1"><b>${esc(m.title)}</b><small>${esc(m.materia)} · ${esc(m.periodo)} · ${esc(m.curso)}</small></span>
            <span class="chip">${act.length - exc}/${act.length} temas</span>
            <button class="btn sm ghost" data-act="cfg-open" data-id="${m.id}" aria-expanded="${open}">${open ? '▲ Ocultar temas' : '▼ Escolher temas'}</button></div>
          ${open ? `<div style="padding:4px 0 2px 32px;display:grid;gap:4px">
            <div class="row gap"><button class="btn sm" data-act="topics-all" data-id="${m.id}">Todos os temas</button><button class="btn sm ghost" data-act="topics-none" data-id="${m.id}">Nenhum</button></div>
            ${act.map((t) => `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-change="cfg-topic" value="${t.id}" ${cfg.excluded.has(t.id) ? '' : 'checked'}><span><b>${t.n}.</b> ${esc(t.title)} <small class="muted">· ${Q.Store.questionsOf(m.id).filter((q) => (q.topicIds || []).includes(t.id) && q.origin !== 'enamed').length} questões</small></span></label>`).join('')}</div>` : ''}</div>`;
      };
      return `${sesBanner}
      <div class="page-h"><div><div class="eyebrow">Simulado</div><h1>Montar prova</h1><p>Use o filtro acima para restringir curso, período e matéria.</p></div></div>
      <div class="split">
        <div class="grid" style="align-content:start">
          <div class="card"><div class="row between wrap gap"><h3 style="margin:0">1 · Materiais e temas <span class="sub">${cfg.materialIds.length} de ${shown.length} material(is)</span></h3>
              <div class="row gap"><button class="btn sm" data-act="mat-all">✔ Selecionar todos</button><button class="btn sm ghost" data-act="mat-none">Limpar</button></div></div>
            <p class="muted mt-s" style="margin-bottom:0"><small>Marque os materiais e, se quiser, abra “Escolher temas” para tirar slides específicos da prova.${cfg.excluded.size ? ` ${cfg.excluded.size} tema(s) fora.` : ''}</small></p>
            ${shown.map(matCard).join('')}</div>
          <div class="card"><div class="row between wrap gap"><div><h3 style="margin:0">🖼️ Usar imagens nas questões</h3><small class="muted">${useImg ? `Ligado: ${imgQs} questão(ões) levam figura, no máximo ~1 a cada 4 na prova.` : `Desligado: ${imgQs} questão(ões) que dependem de figura ficam de fora.`}</small></div>${V.imgSwitch()}</div></div>
          ${en ? `<div class="card"><div class="row between wrap gap"><div><h3 style="margin:0">🎓 Questões ENAMED</h3><small class="muted">${enQs ? `${enQs} questão(ões) do ENAMED vinculadas aos seus temas entram na prova (até ~1 a cada 4).` : 'Nenhuma questão ENAMED vinculada ainda. Importe o caderno e o gabarito oficiais em Ajustes → Versão avançada.'}</small></div>${V.enamedSwitch()}</div></div>` : ''}
          <div class="card"><h3>2 · Quantidade</h3><div class="seg">${[0, 5, 10, 15, 20, 30, 50].map((v) => `<button data-act="cfg-n" data-v="${v}" class="${cfg.n === v ? 'on' : ''}">${v === 0 ? 'Todas' : v}</button>`).join('')}</div>
            <p class="muted mt-s">${pool ? `${n} de ${pool} questões disponíveis.` : 'Nenhuma questão no escopo.'}</p></div>
          <div class="card"><h3>3 · Estratégia</h3><div class="grid g2">${STRATS.map(([k, em, t, d]) => `<button class="opt-card ${cfg.strategy === k ? 'on' : ''}" data-act="cfg-strat" data-v="${k}"><span class="em">${em}</span><span><b>${t}</b><small class="muted">${d}</small></span></button>`).join('')}</div>
            <div class="mt-s"><span class="lbl">Tempo</span> <div class="seg" style="margin-left:8px">${[[0, 'Sem limite'], [1.5, '1,5 min/questão'], [1, '1 min/questão']].map(([v, l]) => `<button data-act="cfg-timer" data-v="${v}" class="${cfg.timer === v ? 'on' : ''}">${l}</button>`).join('')}</div></div></div>
        </div>
        <div class="grid" style="align-content:start;position:sticky;top:80px">
          <div class="card"><h3>🛡️ Escudo anti-chute ativo</h3>
            <div class="insight"><span class="em">🔀</span><div><b>Gabarito balanceado</b><small class="muted">Letras certas distribuídas por igual; no máximo ${S().settings.maxRun || 2} iguais seguidas; sem escadas nem alternâncias.</small></div></div>
            <div class="insight"><span class="em">📏</span><div><b>Sem “a maior é a certa”</b><small class="muted">O teto de questões em que a correta é a mais longa fica no nível do acaso.</small></div></div>
            <div class="insight"><span class="em">🎚️</span><div><b>Segurança em cada resposta</b><small class="muted">Chutes e respostas rápidas demais não contam como domínio.</small></div></div></div>
          <button class="btn primary lg" data-act="start" ${pool ? '' : 'disabled'}>▶ Simular ${pool ? n + ' questões' : ''}</button>
        </div>
      </div>`;
    },
    act: {
      'mat-all': () => { cfg.materialIds = (E.materials(V.filter()).length ? E.materials(V.filter()) : S().materials).map((m) => m.id); cfg.excluded.clear(); Q.App.refresh(); },
      'mat-none': () => { cfg.materialIds = []; Q.App.refresh(); },
      'cfg-open': (el) => { cfg.open.has(el.dataset.id) ? cfg.open.delete(el.dataset.id) : cfg.open.add(el.dataset.id); Q.App.refresh(); },
      'topics-all': (el) => { E.activeTopics(Q.Store.material(el.dataset.id)).forEach((t) => cfg.excluded.delete(t.id)); Q.App.refresh(); },
      'topics-none': (el) => { E.activeTopics(Q.Store.material(el.dataset.id)).forEach((t) => cfg.excluded.add(t.id)); Q.App.refresh(); },
      'cfg-n': (el) => { cfg.n = +el.dataset.v; Q.App.refresh(); },
      'cfg-strat': (el) => { cfg.strategy = el.dataset.v; Q.App.refresh(); },
      'cfg-timer': (el) => { cfg.timer = +el.dataset.v; Q.App.refresh(); },
      start: async () => {
        if (S().session && !(await Q.confirm('Há uma prova em andamento. Iniciar outra descarta a atual. Continuar?', 'Descartar e iniciar'))) return;
        const useImg = S().settings.useImages !== false;
        const fp = effective(cfg.materialIds);
        const pool = useImg ? fp.length : fp.filter((q) => !(q.imageIds || []).length).length;
        const n = Math.min(cfg.n === 0 ? pool : cfg.n, pool);
        Q.Exam.start({ useImages: useImg, enamed: Q.Enamed.enabled(), excludeTopicIds: [...cfg.excluded], materialIds: cfg.materialIds, n, strategy: cfg.strategy, timerMin: cfg.timer ? Math.ceil(n * cfg.timer) : 0, filter: Object.assign({}, V.filter()) });
      },
    },
    change: {
      'cfg-mat': (el) => {
        const s = new Set(cfg.materialIds);
        el.checked ? s.add(el.value) : s.delete(el.value);
        cfg.materialIds = [...s];
        Q.App.refresh();
      },
      'cfg-topic': (el) => { el.checked ? cfg.excluded.delete(el.value) : cfg.excluded.add(el.value); Q.App.refresh(); },
    },
  };

  /* ====================== EXECUÇÃO ====================== */
  let tick = null, keyH = null;
  const stop = () => { clearInterval(tick); tick = null; if (keyH) document.removeEventListener('keydown', keyH); keyH = null; };

  function finishExam(auto) {
    stop();
    const ses = S().session;
    if (!ses) return Q.go('#/inicio');
    const at = E.finish(ses);
    S().session = null;
    if (!at.answers.length) { Q.Store.save(); Q.toast('Nenhuma resposta registrada — prova descartada.'); return Q.go('#/simulado'); }
    S().attempts.push(at);
    Q.Store.saveNow();
    if (Q.Rank) Q.Rank.autoSync();
    if (auto) Q.toast('Tempo esgotado — prova encerrada.', 'warn');
    Q.go('#/resultado/' + at.id);
  }

  function pick(pos) {
    const ses = S().session, it = ses.items[ses.idx];
    if (it.a) return;
    it.pending = pos;
    Q.App.refresh();
  }
  function confirmConf(conf) {
    const ses = S().session, it = ses.items[ses.idx];
    if (it.a || it.pending == null) return;
    it.a = { chosenPos: it.pending, conf, ms: Date.now() - (it.t0 || Date.now()) };
    delete it.pending;
    Q.Store.save();
    const warn = E.liveWarning(ses);
    if (warn) Q.toast(warn, 'warn', 6000);
    Q.App.refresh();
  }
  function next() {
    const ses = S().session;
    if (ses.idx >= ses.items.length - 1) return finishExam();
    ses.idx++;
    Q.Store.save();
    Q.App.refresh();
    window.scrollTo({ top: 0 });
  }

  Q.Views.run = {
    title: 'Prova',
    render() {
      const ses = S().session;
      if (!ses) return '<div class="card empty"><div class="big">🕊️</div><h3>Nenhuma prova em andamento</h3><a class="btn primary" href="#/simulado">Montar prova</a></div>';
      const it = ses.items[ses.idx];
      const q = Q.Store.question(it.qid);
      if (!q) { ses.items.splice(ses.idx, 1); if (!ses.items.length) { S().session = null; return this.render(); } ses.idx = Math.min(ses.idx, ses.items.length - 1); return this.render(); }
      if (!it.t0 && !it.a) it.t0 = Date.now();
      const study = true; // feedback com justificativa logo após marcar
      const segs = ses.items.map((x, i) => `<i class="${i === ses.idx ? 'cur' : x.a ? (Q.Store.question(x.qid) && x.order[x.a.chosenPos] === Q.Store.question(x.qid).correct ? 'ok' : 'no') : ''}"></i>`).join('');
      const opts = it.order.map((o, p) => {
        let cls = '';
        if (it.a) cls = o === q.correct ? 'right' : p === it.a.chosenPos ? 'wrong' : '';
        else if (it.pending === p) cls = 'sel';
        return `<button class="opt ${cls}" data-act="pick" data-pos="${p}" ${it.a ? 'disabled' : ''}><span class="lt">${Q.LETTERS[p]}</span><span>${esc(q.options[o])}</span></button>`;
      }).join('');
      const correct = it.a && it.order[it.a.chosenPos] === q.correct;
      const chosenOrig = it.a ? it.order[it.a.chosenPos] : -1;
      const why = it.a && !correct ? E.whyNot(q, chosenOrig) : '';
      const refs = (q.topicIds || []).map((tid) => { const t = Q.Store.topic(q.materialId, tid); return t ? `<button class="chip" data-act="open-topic" data-m="${q.materialId}" data-t="${t.id}">📎 Slide ${t.n} — ${esc(t.title)}</button>` : ''; }).join(' ');
      return `<div class="exam">
        <div class="row between gap" style="margin-bottom:10px;min-height:32px"><div class="segs" style="flex:1;margin:0" aria-label="Progresso">${segs}</div>
          <div class="row gap">${ses.timerMin ? '<span class="timer" id="timer">--:--</span>' : ''}<button class="btn sm ghost" data-act="quit">Encerrar</button></div></div>
        <div class="card q-card">
          ${(ses.useImages === false ? [] : (q.imageIds || [])).map((id) => `<img class="q-fig" data-img="${id}" data-act="zoom-img" alt="Figura da questão">`).join('')}
          <div class="q-stem">${esc(q.stem)}</div>
          <div class="opts">${opts}</div>
          ${it.pending != null && !it.a ? `<div class="conf"><b>Quão seguro você está da letra ${Q.LETTERS[it.pending]}?</b>
            <div class="row" style="margin-top:12px"><button class="btn" data-act="conf" data-c="sure">✅ Certeza<small>tecla 1</small></button><button class="btn" data-act="conf" data-c="doubt">🤔 Dúvida<small>tecla 2</small></button><button class="btn" data-act="conf" data-c="guess">🎲 Chute<small>tecla 3</small></button></div></div>` : ''}
          ${it.a ? `<div class="explain"><b>${correct ? '✅ Você acertou' : '❌ Você errou'}</b>
            ${correct ? `<div class="mt-s"><b>Por que está certo:</b> ${esc(q.explanation || 'Conforme o material.')}</div>`
              : `<div class="mt-s"><b>Por que a letra ${Q.LETTERS[it.a.chosenPos]} não é a correta:</b> ${esc(why)}</div><div class="mt-s"><b>Por que a letra ${Q.LETTERS[it.order.indexOf(q.correct)]} é a correta:</b> ${esc(q.explanation || 'Conforme o material.')}</div>`}
            <div class="row wrap gap mt-s">${refs}</div>
            <div class="row end mt"><button class="btn primary" data-act="next">${ses.idx >= ses.items.length - 1 ? 'Ver resultado' : 'Próxima →'} <span class="kbd">Enter</span></button></div></div>` : ''}
        </div>
      </div>`;
    },
    mount() {
      const ses = S().session;
      if (!ses) return;
      stop();
      const upd = () => {
        const t = Q.$('#timer');
        if (!t) return;
        const left = ses.startedAt + ses.timerMin * 60000 - Date.now();
        if (left <= 0) return finishExam(true);
        t.textContent = String(Math.floor(left / 60000)).padStart(2, '0') + ':' + String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
        t.classList.toggle('low', left < 60000);
      };
      if (ses.timerMin) { upd(); tick = setInterval(upd, 1000); }
      keyH = (e) => {
        if (document.querySelector('.modal-back') || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
        const s = S().session;
        if (!s) return;
        const it = s.items[s.idx];
        const k = e.key.toLowerCase();
        if (!it.a && 'abcd'.includes(k) && k.length === 1) pick('abcd'.indexOf(k));
        else if (!it.a && it.pending != null && '123'.includes(k) && k.length === 1) confirmConf(['sure', 'doubt', 'guess'][+k - 1]);
        else if (it.a && e.key === 'Enter') next();
      };
      document.addEventListener('keydown', keyH);
    },
    unmount: stop,
    act: {
      pick: (el) => pick(+el.dataset.pos),
      conf: (el) => confirmConf(el.dataset.c),
      next,
      quit: async () => {
        const ses = S().session;
        const answered = ses.items.filter((i) => i.a).length;
        if (await Q.confirm(answered ? `Encerrar agora? ${answered} resposta(s) serão contabilizadas.` : 'Descartar esta prova sem respostas?', answered ? 'Encerrar' : 'Descartar')) finishExam();
      },
    },
  };

  /* ====================== RESULTADO ====================== */
  const strip = (at) => {
    const sus = at.answers.map((a) => a.suspect);
    return `<div class="key-strip" title="Letras que você marcou (verde = acerto, vermelho = erro, contorno amarelo = resposta suspeita)">${at.answers.map((a, i) => `<span class="${a.correct ? 'ok' : 'no'} ${sus[i] ? 'sus' : ''}">${Q.LETTERS[a.chosenPos]}</span>`).join('')}</div>`;
  };
  const keyStrip = (at) => `<div class="key-strip">${at.answers.map((a) => `<span>${Q.LETTERS[a.pos]}</span>`).join('')}</div>`;
  let revFilter = 'all';

  Q.Views.result = {
    title: 'Resultado',
    render(params) {
      const at = S().attempts.find((a) => a.id === (params && params[0]));
      if (!at) return '<div class="card empty"><h3>Resultado não encontrado</h3><a class="btn" href="#/desempenho">Ver desempenho</a></div>';
      const sm = at.summary, ins = E.insights(at);
      const matIds = [...new Set(at.answers.map((a) => a.materialId))];
      const covs = matIds.map((id) => Q.Store.material(id)).filter(Boolean).map((m) => E.coverage(m));
      const touched = new Set(at.answers.flatMap((a) => a.topicIds));
      const stat = Q.Guard.analyzeKey(at.answers.map((a) => a.pos));
      const calib = E.calibration(at.answers);
      const grade = Math.round(sm.real * 100);
      const verdictTxt = grade >= 85 ? 'Excelente!' : grade >= 70 ? 'Muito bom!' : grade >= 50 ? 'Bom caminho' : 'Vamos reforçar';
      const rows = at.answers.map((a, i) => ({ a, i, q: Q.Store.question(a.qid) })).filter((r) => r.q).filter((r) => revFilter === 'all' || (revFilter === 'wrong' && !r.a.correct) || (revFilter === 'sus' && (r.a.suspect || r.a.conf === 'guess')));
      const totalTouchedAll = covs.reduce((s, c) => s + c.touched, 0), totalAll = covs.reduce((s, c) => s + c.total, 0);
      return `
      <div class="page-h"><div><div class="eyebrow">Resultado · ${Q.fmtDate(at.at)}</div><h1>${verdictTxt}</h1><p>${at.mode === 'estudo' ? 'Modo estudo' : 'Modo prova'} · ${Q.fmtDur(at.durationMs)} · estratégia ${({ misto: 'mista', cobertura: 'de cobertura', fraquezas: 'de pontos fracos', aleatorio: 'aleatória' })[at.strategy] || at.strategy}</p></div>
        <div class="row wrap gap"><button class="btn" data-act="again">↻ Nova prova</button><button class="btn primary" data-act="r-drill" data-s="fraquezas" data-id="${at.id}">🩹 Treinar pontos frágeis</button></div></div>

      <div class="card"><div class="score-hero">
        <div class="rings">
          <div class="ring-wrap">${C.ring(sm.raw, { label: 'acerto bruto', size: 120, c1: 'var(--accent)', c2: 'var(--accent2)' })}<small>${sm.correct} de ${sm.n} corretas</small></div>
          <div class="ring-wrap">${C.ring(sm.real, { label: 'domínio real', size: 150, stroke: 14 })}<small>só conta acerto consciente</small></div>
          <div class="ring-wrap">${C.ring(sm.integrity, { label: 'integridade', size: 120, c1: 'var(--good)', c2: 'var(--accent2)' })}<small>${sm.fast + sm.patt ? sm.fast + ' rápida(s) · ' + sm.patt + ' em padrão' : 'sem sinais de chute'}</small></div>
        </div>
        <div>
          <div class="stat-row"><div class="stat"><b>${sm.n}/${at.requested}</b><small>questões respondidas / escolhidas</small></div><div class="stat"><b>${sm.luck}</b><small>acertos sem mérito (sorte)</small></div><div class="stat"><b>${sm.overconf}</b><small>erros com “certeza”</small></div><div class="stat"><b>${Q.fmtDur(sm.ms)}</b><small>tempo médio por questão</small></div></div>
          <div class="mt-s"><span class="lbl">Suas respostas</span>${strip(at)}</div>
          <div class="mt-s"><span class="lbl">Gabarito sorteado</span> <small class="muted">(maior sequência de letras iguais: ${stat.maxRun} · escadas: ${stat.stairs} · alternâncias: ${stat.alts})</small>${keyStrip(at)}</div>
        </div></div></div>

      <div class="card mt"><h3>🗺️ Panorama do conteúdo <span class="sub">quanto do material você já cobriu</span></h3>
        <div class="verdict ${covs.every((c) => c.exhausted) ? 'ok' : 'todo'}" style="margin:0 0 6px"><span class="em">${covs.every((c) => c.exhausted) ? '✅' : '📊'}</span><div><b>${sm.n} questões nesta prova · ${touched.size} tema(s) tocado(s) · cobertura acumulada ${Q.pct(totalTouchedAll, totalAll)}% (${totalTouchedAll}/${totalAll})</b><br><small class="muted">O contorno ciano no mapa marca os slides cobrados <i>nesta</i> prova; a cor mostra seu domínio acumulado.</small></div></div>
        ${covs.map((c) => V.coverageBlock(c, { cur: touched, thisAttempt: { q: at.answers.filter((a) => a.materialId === c.material.id).length, t: new Set(at.answers.filter((a) => a.materialId === c.material.id).flatMap((a) => a.topicIds)).size } })).join('')}
        <div class="mt">${V.mapLegend()}</div></div>

      <div class="grid g2 mt">
        <div class="card"><h3>🏅 O que você conquistou</h3>${ins.wins.length ? ins.wins.map((w) => `<div class="insight"><span class="em">${w.icon}</span><div><b>${esc(w.title)}</b><small class="muted">${esc(w.text)}</small></div></div>`).join('') : '<p class="muted">Continue praticando — suas conquistas aparecem aqui.</p>'}</div>
        <div class="card"><h3>🔧 Pontos de melhoria</h3>${ins.tips.map((t) => `<div class="insight"><span class="em">${t.icon}</span><div><b>${esc(t.title)}</b><small class="muted">${esc(t.text)}</small>${t.action ? `<div class="mt-s">${t.action.href ? `<a class="btn sm" href="${t.action.href}">${t.action.label}</a>` : `<button class="btn sm" data-act="r-drill" data-s="${t.action.act === 'drill-new' ? 'cobertura' : 'fraquezas'}" data-id="${at.id}">${t.action.label}</button>`}</div>` : ''}</div></div>`).join('')}</div>
      </div>

      <div class="card mt"><h3>🎚️ Calibragem <span class="sub">o que você acha que sabe × o que acertou</span></h3>
        ${calib.map((c) => C.bar(`${E.CONF_LABEL[c.conf]} (${c.n})`, c.acc, { text: c.n ? Math.round(c.acc * 100) + '% de acerto' : '—', color: c.conf === 'guess' ? 'var(--warn)' : undefined })).join('')}
        <small class="muted">Ideal: “certeza” com acerto alto e “chute” com acerto próximo de 25%.</small></div>

      <div class="card mt"><div class="row between wrap gap"><h3>🔍 Revisão questão a questão</h3>
        <div class="seg">${[['all', 'Todas'], ['wrong', 'Erradas'], ['sus', 'Chutes/suspeitas']].map(([k, l]) => `<button data-act="rev-f" data-f="${k}" class="${revFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        ${rows.length ? rows.map(({ a, i, q }) => review(a, i, q)).join('') : '<p class="muted">Nada neste filtro.</p>'}</div>`;
    },
    act: {
      again: () => Q.go('#/simulado'),
      'rev-f': (el) => { revFilter = el.dataset.f; Q.App.refresh(); },
      'r-drill': (el) => {
        const at = S().attempts.find((a) => a.id === el.dataset.id);
        const ids = [...new Set(at.answers.map((a) => a.materialId))].filter((id) => Q.Store.material(id));
        Q.Exam.start({ materialIds: ids, n: 10, strategy: el.dataset.s, mode: 'estudo', filter: at.scope.filter || {} });
      },
    },
  };

  function review(a, i, q) {
    const tags = [];
    tags.push(`<span class="badge ${a.correct ? 'b-good' : 'b-bad'}">${a.correct ? 'Acerto' : 'Erro'}</span>`);
    tags.push(`<span class="chip">${a.conf === 'sure' ? '✅ certeza' : a.conf === 'doubt' ? '🤔 dúvida' : '🎲 chute'}</span>`);
    tags.push(`<span class="chip">⏱ ${Q.fmtDur(a.ms)}</span>`);
    if (a.fast) tags.push('<span class="badge b-warn">rápida demais</span>');
    if (a.patt) tags.push('<span class="badge b-warn">padrão de marcação</span>');
    if (a.correct && (a.conf === 'guess' || a.suspect)) tags.push('<span class="badge b-warn">acerto sem mérito</span>');
    if (!a.correct && a.conf === 'sure') tags.push('<span class="badge b-bad">erro com certeza</span>');
    const topics = (q.topicIds || []).map((tid) => Q.Store.topic(q.materialId, tid)).filter(Boolean);
    return `<div class="rev"><div class="hd"><b>Q${i + 1}</b>${tags.join('')}${topics.map((t) => `<button class="chip" data-act="open-topic" data-m="${q.materialId}" data-t="${t.id}">📎 slide ${t.n}</button>`).join('')}</div>
      <div style="font-weight:600">${esc(q.stem)}</div>
      ${(q.imageIds || []).map((id) => `<img data-img="${id}" alt="Figura">`).join('')}
      <div class="opts mt-s">${a.order.map((o, p) => `<div class="opt ${o === q.correct ? 'right' : p === a.chosenPos ? 'wrong' : ''}" style="padding:9px 12px"><span class="lt" style="width:30px;height:30px;font-size:.85rem">${Q.LETTERS[p]}</span><span>${esc(q.options[o])}${p === a.chosenPos ? ' <small>(sua resposta)</small>' : ''}</span></div>`).join('')}</div>
      ${!a.correct ? `<div class="explain"><b>Por que a sua (${Q.LETTERS[a.chosenPos]}) não é a correta:</b> ${esc(E.whyNot(q, a.chosenOrig))}</div>` : ''}
      ${q.explanation ? `<div class="explain"><b>Por que a correta é a correta:</b> ${esc(q.explanation)}</div>` : ''}</div>`;
  }
})();
