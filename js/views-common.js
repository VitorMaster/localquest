/* Localquest — peças de interface compartilhadas entre as telas. */
(function () {
  const Q = window.Q;
  const E = Q.Engine;
  const V = (Q.V = {});
  Q.Views = {};
  const esc = Q.esc;
  const S = () => Q.Store.state;

  /** Perfil Criador (programador): mostra banco de questões e ferramentas avançadas. */
  Q.isCreator = () => S().settings.profile === 'criador';

  /** Perfil Criador (programador): mostra banco de questões e ferramentas avançadas. */
  Q.isCreator = () => S().settings.profile === 'criador';

  Q.go = (hash) => {
    if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
    else location.hash = hash;
  };

  /* ---------- filtro global (curso › período › matéria) ---------- */
  V.filter = () => S().ui.filter;
  V.sanitizeFilter = () => {
    const f = V.filter();
    ['curso', 'periodo', 'materia'].forEach((k) => {
      if (f[k] && !E.distinct(k, f).includes(f[k])) f[k] = '';
    });
  };
  V.filtersBar = (opts = {}) => {
    V.sanitizeFilter();
    const f = V.filter();
    const sel = (k, label) => {
      const vals = E.distinct(k, f);
      return `<select data-change="filter" data-key="${k}" aria-label="${label}"><option value="">${label}: todos</option>${vals
        .map((v) => `<option ${f[k] === v ? 'selected' : ''}>${esc(v)}</option>`)
        .join('')}</select>`;
    };
    const any = f.curso || f.periodo || f.materia;
    return `<div class="filters">${sel('curso', 'Curso')}${sel('periodo', 'Período')}${sel('materia', 'Matéria')}${
      any ? '<button class="btn sm ghost" data-act="clear-filter">Limpar</button>' : ''
    }</div>`;
  };

  V.matChips = (m) =>
    `<span class="chip">🎓 ${esc(m.curso)}</span><span class="chip">📅 ${esc(m.periodo)}</span><span class="chip">📘 ${esc(m.materia)}</span>`;

  /* ---------- criação de questões (quantidade + nível) ---------- */
  V.createPanelHTML = (idp, n = 20) => `
    <div class="field"><label>Quantas questões criar? <span class="muted" style="text-transform:none;letter-spacing:0">(até 50)</span></label><input type="number" id="${idp}-n" min="1" max="50" value="${n}"></div>
    <div class="field"><label>Nível das perguntas e respostas</label>
      <div class="seg" id="${idp}-lv">${[['misto', 'Misto'], ['1', 'Fácil'], ['2', 'Médio'], ['3', 'Difícil']].map(([k, l], i) => `<button type="button" data-act="lv-pick" data-lv="${k}" class="${i === 0 ? 'on' : ''}">${l}</button>`).join('')}</div>
      <small class="muted"><b>Fácil:</b> perguntas diretas e alternativas bem diferentes. <b>Médio:</b> mistura. <b>Difícil:</b> alternativas muito parecidas, exigem comparar com atenção. <b>Misto:</b> um pouco de cada.</small></div>`;
  V.readCreate = (root, idp) => {
    const lv = (Q.$(`#${idp}-lv .on`, root) || {}).dataset;
    const k = lv ? lv.lv : 'misto';
    return { n: Q.clamp(Math.round(+Q.$(`#${idp}-n`, root).value || 20), 1, 50), levels: k === 'misto' ? [1, 2, 3] : [+k] };
  };
  /** Mensagem padrão depois de criar questões. */
  V.createToast = (r) => {
    if (r.created >= r.requested) Q.toast(`${r.created} questões criadas, sem repetição.`, 'good');
    else if (r.created) Q.toast(`Criei ${r.created} de ${r.requested}: o material só comporta isso sem repetir perguntas. Para mais, adicione mais conteúdo.`, 'warn', 8000);
    else Q.toast('Não consegui criar questões novas com o texto deste material.', 'warn', 7000);
  };
  V.openCreate = (m) => {
    if (!m) return;
    const cap = Q.Autogen.capacity(m);
    const have = Q.Store.questionsOf(m.id).length;
    const mod = Q.modal(`<div class="eyebrow">${esc(m.title)}</div><h2>Criar questões</h2>
      <p class="muted">As perguntas são feitas só com o que está nos seus slides. Hoje este material tem <b>${have}</b> questão(ões) e comporta mais <b>~${cap.total}</b> diferentes.</p>
      ${V.createPanelHTML('mk', Math.min(20, Math.max(1, cap.total)))}
      ${have ? '<label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px"><input type="checkbox" id="mk-rep" style="margin-top:4px"><span>Substituir as questões criadas automaticamente que você ainda não respondeu<br><small class="muted">As que já entraram no seu histórico e as que você escreveu ficam.</small></span></label>' : ''}
      <div class="row end gap"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="mk-go">✨ Criar questões</button></div>`, { cls: 'small' });
    Q.$('#mk-go', mod.el).onclick = () => {
      const c = V.readCreate(mod.el, 'mk');
      const r = Q.Autogen.create(m, { n: c.n, levels: c.levels, replaceAuto: !!(Q.$('#mk-rep', mod.el) || {}).checked });
      V.createToast(r);
      mod.close();
      Q.App.refresh();
    };
  };

  /* ---------- criação de questões (quantidade + nível) ---------- */
  V.createPanelHTML = (idp, n = 20) => `
    <div class="field"><label>Quantas questões criar? <span class="muted" style="text-transform:none;letter-spacing:0">(até 50)</span></label><input type="number" id="${idp}-n" min="1" max="50" value="${n}"></div>
    <div class="field"><label>Nível das perguntas e respostas</label>
      <div class="seg" id="${idp}-lv">${[['misto', 'Misto'], ['1', 'Fácil'], ['2', 'Médio'], ['3', 'Difícil']].map(([k, l], i) => `<button type="button" data-act="lv-pick" data-lv="${k}" class="${i === 0 ? 'on' : ''}">${l}</button>`).join('')}</div>
      <small class="muted"><b>Fácil:</b> perguntas diretas e alternativas bem diferentes. <b>Médio:</b> mistura. <b>Difícil:</b> alternativas muito parecidas, exigem comparar com atenção. <b>Misto:</b> um pouco de cada.</small></div>`;
  V.readCreate = (root, idp) => {
    const lv = (Q.$(`#${idp}-lv .on`, root) || {}).dataset;
    const k = lv ? lv.lv : 'misto';
    return { n: Q.clamp(Math.round(+Q.$(`#${idp}-n`, root).value || 20), 1, 50), levels: k === 'misto' ? [1, 2, 3] : [+k] };
  };
  /** Mensagem padrão depois de criar questões. */
  V.createToast = (r) => {
    if (r.created >= r.requested) Q.toast(`${r.created} questões criadas, sem repetição.`, 'good');
    else if (r.created) Q.toast(`Criei ${r.created} de ${r.requested}: o material só comporta isso sem repetir perguntas. Para mais, adicione mais conteúdo.`, 'warn', 8000);
    else Q.toast('Não consegui criar questões novas com o texto deste material.', 'warn', 7000);
  };
  V.openCreate = (m) => {
    if (!m) return;
    const cap = Q.Autogen.capacity(m);
    const have = Q.Store.questionsOf(m.id).length;
    const mod = Q.modal(`<div class="eyebrow">${esc(m.title)}</div><h2>Criar questões</h2>
      <p class="muted">As perguntas são feitas só com o que está nos seus slides. Hoje este material tem <b>${have}</b> questão(ões) e comporta mais <b>~${cap.total}</b> diferentes.</p>
      ${V.createPanelHTML('mk', Math.min(20, Math.max(1, cap.total)))}
      ${have ? '<label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px"><input type="checkbox" id="mk-rep" style="margin-top:4px"><span>Substituir as questões criadas automaticamente que você ainda não respondeu<br><small class="muted">As que já entraram no seu histórico e as que você escreveu ficam.</small></span></label>' : ''}
      <div class="row end gap"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="mk-go">✨ Criar questões</button></div>`, { cls: 'small' });
    Q.$('#mk-go', mod.el).onclick = () => {
      const c = V.readCreate(mod.el, 'mk');
      const r = Q.Autogen.create(m, { n: c.n, levels: c.levels, replaceAuto: !!(Q.$('#mk-rep', mod.el) || {}).checked });
      V.createToast(r);
      mod.close();
      Q.App.refresh();
    };
  };

  /* ---------- imagens ---------- */
  V.enamedSwitch = () => {
    const on = S().settings.enamed === true;
    const net = navigator.onLine !== false;
    return `<button class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-act="toggle-enamed" title="ENAMED online"><i></i><span>ENAMED: ${on ? 'ligado' : 'desligado'} <b class="net ${net ? 'up' : 'down'}" title="${net ? 'Conectado à internet' : 'Sem internet'}">●</b></span></button>`;
  };
  V.imgSwitch = () => {
    const on = S().settings.useImages !== false;
    return `<button class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-act="toggle-images" title="Usar imagens nas questões"><i></i><span>${on ? 'Imagens: ligadas' : 'Imagens: desligadas'}</span></button>`;
  };
  V.img = (id, cls = '', extra = '') => `<img data-img="${id}" class="${cls}" alt="" ${extra}>`;
  V.zoom = (id, caption = '') => {
    const m = Q.modal(`<img class="zoom" data-img="${id}" alt="">${caption ? `<p class="muted" style="text-align:center;margin-top:12px">${esc(caption)}</p>` : ''}`, { cls: 'wide' });
    Q.Store.hydrateImages(m.el);
  };

  /* ---------- mapa de cobertura ---------- */
  V.mapLegend = () =>
    `<div class="legend"><span><i style="background:var(--good)"></i>Dominado</span><span><i style="background:var(--warn)"></i>Em progresso</span><span><i style="background:var(--bad)"></i>Frágil</span><span><i style="background:var(--track)"></i>Não explorado</span><span><i style="background:repeating-linear-gradient(45deg,transparent 0 3px,rgba(127,127,127,.6) 3px 5px);box-shadow:inset 0 0 0 1px var(--line)"></i>Sem questão no banco</span></div>`;

  V.tileMap = (cov, o = {}) =>
    `<div class="map">${cov.topics
      .map((x) => {
        const tip = `Slide ${x.topic.n} — ${x.topic.title}\n${E.STATE_LABEL[x.state]}${x.tries ? ' · ' + x.tries + ' resposta(s) · domínio ' + Math.round(x.mastery * 100) + '%' : ''}${x.nobank ? ' · sem questão no banco' : ''}`;
        return `<button class="tile s-${x.state} ${x.nobank ? 'nobank' : ''} ${o.cur && o.cur.has(x.topic.id) ? 'cur' : ''}" data-act="open-topic" data-m="${cov.material.id}" data-t="${x.topic.id}" title="${esc(tip)}" aria-label="${esc(tip)}">${x.topic.n}</button>`;
      })
      .join('')}</div>`;

  /** Bloco de panorama de um material: mapa + números + veredito de exaustão. */
  V.coverageBlock = (cov, o = {}) => {
    const m = cov.material;
    const cur = o.cur; // Set de topicIds tocados nesta prova (opcional)
    const nob = cov.topics.filter((x) => x.nobank);
    let verdict;
    if (cov.exhausted) {
      verdict = `<div class="verdict ok"><span class="em">✅</span><div><b>Conteúdo exaurido</b><br><small>Todos os ${cov.total} temas foram cobrados e todas as ${cov.questions} questões do banco já foram respondidas pelo menos uma vez.</small></div></div>`;
    } else {
      const items = [];
      if (cov.total - cov.touched > 0) items.push(`<b>${cov.total - cov.touched}</b> tema(s) ainda não cobrado(s)`);
      if (cov.unseen > 0) items.push(`<b>${cov.unseen}</b> questão(ões) do banco inéditas`);
      if (nob.length) items.push(`<b>${nob.length}</b> slide(s) sem nenhuma questão (${nob.slice(0, 5).map((x) => x.topic.n).join(', ')}${nob.length > 5 ? '…' : ''})`);
      if (!cov.questions) items.length = 0, items.push('O banco ainda não tem questões para este material');
      verdict = `<div class="verdict todo"><span class="em">🧭</span><div><b>Conteúdo ainda não exaurido</b><br><small>Faltam: ${items.join(' · ')}.</small></div></div>`;
    }
    return `<div class="mat-block">
      <div class="mat-title"><div><a href="#/biblioteca/${m.id}"><b>${esc(m.title)}</b></a><div class="row wrap gap" style="margin-top:6px">${V.matChips(m)}</div></div>
        <div class="row gap"><b style="font-size:1.4rem">${Math.round(cov.usage * 100)}%</b><small class="muted">dos temas<br>já cobrados</small></div></div>
      ${V.tileMap(cov, { cur })}
      <div class="stat-row">
        <div class="stat"><b>${cov.touched}/${cov.total}</b><small>temas cobrados</small></div>
        <div class="stat"><b style="color:var(--good)">${cov.mastered}</b><small>dominados</small></div>
        <div class="stat"><b style="color:var(--bad)">${cov.weak}</b><small>frágeis</small></div>
        <div class="stat"><b>${cov.seen}/${cov.questions}</b><small>questões do banco usadas</small></div>
        ${o.thisAttempt ? `<div class="stat"><b>${o.thisAttempt.q}</b><small>questões nesta prova · ${o.thisAttempt.t} temas</small></div>` : ''}
      </div>${verdict}</div>`;
  };

  /* ---------- visualizador de slide ---------- */
  V.openTopic = (materialId, topicId) => {
    const m = Q.Store.material(materialId);
    const t = m && m.topics.find((x) => x.id === topicId);
    if (!t) return;
    const cov = E.coverage(m);
    const info = cov.topics.find((x) => x.topic.id === t.id);
    const qs = Q.Store.questionsOf(m.id).filter((q) => (q.topicIds || []).includes(t.id));
    const mod = Q.modal(`
      <div class="eyebrow">${esc(m.title)} · slide ${t.n}</div>
      <h2>${esc(t.title)}</h2>
      <div class="row wrap gap" style="margin-bottom:12px">
        <span class="badge ${info.state === 'dominado' ? 'b-good' : info.state === 'fragil' ? 'b-bad' : info.state === 'progresso' ? 'b-warn' : 'b-mute'}">${E.STATE_LABEL[info.state]}</span>
        <span class="chip">${qs.length} questão(ões) no banco</span>${info.tries ? `<span class="chip">${info.tries} resposta(s) · domínio ${Math.round(info.mastery * 100)}%</span>` : ''}
      </div>
      <div class="pre" style="color:var(--muted)">${esc(t.text) || '<i>Slide sem texto.</i>'}</div>
      ${t.images.length ? `<div class="mt" style="display:grid;gap:10px">${t.images.map((i) => V.img(i.id, 'zoom')).join('')}</div>` : ''}
      ${Q.Enamed.enabled() ? `<div class="verdict todo mt"><span class="em">🎓</span><div><b>ENAMED (online)</b><br><small>Procure questões oficiais deste tema nas provas anteriores do INEP.</small>
        <div class="row wrap gap mt-s"><a class="btn sm" target="_blank" rel="noopener" href="${Q.Enamed.temaUrl(t.title)}">🔎 Questões ENAMED sobre este tema</a><a class="btn sm" target="_blank" rel="noopener" href="${Q.Enamed.provasUrl()}">📄 Provas e gabaritos (INEP)</a></div></div></div>` : ''}
      <div class="row end gap mt"><a class="btn" href="#/banco/${m.id}" data-close>Ver banco</a><button class="btn ghost" data-close>Fechar</button></div>`, { cls: 'wide' });
    Q.Store.hydrateImages(mod.el);
  };

  /* ---------- delegação de eventos comuns ---------- */
  V.common = {
    'lv-pick': (el) => { Q.$$('button', el.parentElement).forEach((b) => b.classList.toggle('on', b === el)); },
    'mk-q': (el) => V.openCreate(Q.Store.material(el.dataset.id)),
    'lv-pick': (el) => { Q.$$('button', el.parentElement).forEach((b) => b.classList.toggle('on', b === el)); },
    'mk-q': (el) => V.openCreate(Q.Store.material(el.dataset.id)),
    'toggle-enamed': () => {
      const st = S().settings;
      st.enamed = !st.enamed;
      if (st.enamed && navigator.onLine === false) Q.toast('Você está sem internet: os links do ENAMED só abrem quando houver conexão.', 'warn', 6000);
      if (st.enamed) { const n = Q.Enamed.sync(); if (n) Q.toast(n + ' questão(ões) do ENAMED vinculada(s) aos seus temas.', 'good'); }
      Q.Store.save();
      Q.App.refresh();
    },
    'toggle-images': () => {
      S().settings.useImages = S().settings.useImages === false;
      Q.Store.save();
      Q.App.refresh();
    },
    'open-topic': (el) => V.openTopic(el.dataset.m, el.dataset.t),
    'zoom-img': (el) => V.zoom(el.dataset.img, el.dataset.cap),
    'clear-filter': () => {
      Object.assign(V.filter(), { curso: '', periodo: '', materia: '' });
      Q.Store.save();
      Q.App.refresh();
    },
  };
  V.commonChange = {
    filter: (el) => {
      V.filter()[el.dataset.key] = el.value;
      V.sanitizeFilter();
      Q.Store.save();
      Q.App.refresh();
    },
  };
})();
