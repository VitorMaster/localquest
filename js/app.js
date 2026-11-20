/* Atlas — roteador, navegação e inicialização. */
(function () {
  const Q = window.Q, V = Q.V;
  const S = () => Q.Store.state;

  const NAV = [
    ['inicio', '🏠', 'Início'],
    ['biblioteca', '📚', 'Biblioteca'],
    ['banco', '📝', 'Questões'],
    ['simulado', '⚡', 'Simulado'],
    ['desempenho', '📊', 'Desempenho'],
    ['ajustes', '⚙️', 'Ajustes'],
  ];
  const ROUTES = { inicio: 'home', biblioteca: 'library', banco: 'bank', simulado: 'exam', prova: 'run', resultado: 'result', desempenho: 'perf', ajustes: 'settings' };
  const NO_FILTER = new Set(['prova', 'resultado', 'ajustes', 'banco']);

  const App = (Q.App = { cur: null, view: null });

  App.applyTheme = () => {
    document.documentElement.setAttribute('data-theme', S().settings.theme === 'light' ? 'light' : 'dark');
  };

  function parse() {
    const h = location.hash.replace(/^#\/?/, '') || 'inicio';
    const [name, ...params] = h.split('/');
    return { name: ROUTES[name] ? name : 'inicio', params };
  }

  function renderChrome(name) {
    const active = name === 'prova' || name === 'resultado' ? (name === 'prova' ? 'simulado' : 'desempenho') : name;
    Q.$('#nav').innerHTML = `<div class="brand"><i>▲</i><div>Atlas<small class="muted">simulador de provas</small></div></div>
      ${NAV.map(([k, ic, l]) => `<a class="nl ${active === k ? 'on' : ''}" href="#/${k}"><span class="ic">${ic}</span><span class="lb">${l}</span></a>`).join('')}
      <div class="sp"></div><div class="nav-foot">Questões só dos seus slides.<br>Dados salvos neste navegador.</div>`;
    const bar = Q.$('#topbar');
    if (name === 'prova') { bar.innerHTML = ''; bar.style.display = 'none'; return; }
    bar.style.display = '';
    bar.innerHTML = NO_FILTER.has(name) ? '<div class="grow"></div>' : `${V.filtersBar()}<div class="grow"></div>`;
    bar.innerHTML += `<button class="btn sm ghost" data-act="toggle-theme" title="Alternar tema" aria-label="Alternar tema">${S().settings.theme === 'light' ? '🌙' : '☀️'}</button>`;
  }

  App.render = (keepScroll) => {
    const { name, params } = parse();
    const key = ROUTES[name];
    const view = Q.Views[key];
    if (App.view && App.view !== view && App.view.unmount) App.view.unmount();
    // atalho: /prova sem sessão → simulado
    App.cur = name;
    App.view = view;
    const y = window.scrollY;
    renderChrome(name);
    const root = Q.$('#view');
    root.innerHTML = view.render(params);
    Q.Store.hydrateImages(root);
    if (view.mount) view.mount(root, params);
    document.title = `${view.title || 'Atlas'} · Atlas`;
    if (keepScroll) window.scrollTo(0, y);
    else window.scrollTo(0, 0);
  };
  App.refresh = () => App.render(true);
  App.refreshQuiet = () => {
    // re-renderiza por baixo de um modal aberto, sem mexer no scroll
    App.render(true);
  };

  /* ---- delegação de eventos ---- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const name = el.dataset.act;
    if (name === 'toggle-theme') {
      S().settings.theme = S().settings.theme === 'light' ? 'dark' : 'light';
      Q.Store.save(); App.applyTheme(); App.refresh();
      return;
    }
    const h = (App.view && App.view.act && App.view.act[name]) || V.common[name];
    if (h) h(el, e);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (!el) return;
    const name = el.dataset.change;
    const h = (App.view && App.view.change && App.view.change[name]) || V.commonChange[name];
    if (h) h(el, e);
  });
  window.addEventListener('hashchange', () => App.render(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { const m = Q.$$('.modal-back').pop(); if (m) m.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }
  });

  /* ---- boot ---- */
  (async function boot() {
    await Q.Store.init();
    App.applyTheme();
    if (!location.hash) location.hash = '#/inicio';
    App.render(false);
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      // sem service worker por ora (app 100% estático); reservado para modo offline
    }
  })();
})();
