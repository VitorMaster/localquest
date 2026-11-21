/* Localquest — tela inicial (painel). */
(function () {
  const Q = window.Q, V = Q.V, E = Q.Engine, C = Q.Charts, esc = Q.esc;
  const S = () => Q.Store.state;

  /** Evolução por prova (filtrada). */
  V.attemptSeries = (f) => {
    const ids = new Set(E.materials(f).map((m) => m.id));
    return S().attempts
      .slice()
      .sort((a, b) => a.at - b.at)
      .map((at) => {
        const ans = at.answers.filter((a) => ids.has(a.materialId));
        return ans.length ? { at, sm: E.summarize(ans) } : null;
      })
      .filter(Boolean);
  };

  V.emptyState = () => `
    <div class="hero">
      <div class="eyebrow">Bem-vindo ao Localquest</div>
      <h1>Provas feitas <span class="grad-text">dos seus slides</span>, sem espaço para chute.</h1>
      <p class="muted" style="max-width:56ch;margin:10px 0 22px">Envie os slides das aulas (PPTX ou PDF), crie ou importe questões e o Localquest mede o que você realmente domina, mostra quanto do conteúdo já foi cobrado e diz se você exauriu o material.</p>
      <div class="row wrap gap">
        <a class="btn primary lg" href="#/biblioteca" data-act="go-upload">📤 Enviar meus slides</a>
        <button class="btn lg" data-act="load-demo">✨ Explorar com exemplo</button>
      </div>
    </div>
    <div class="grid g3 mt">
      <div class="card"><h3>🖼️ Imagens dentro das questões</h3><p class="muted">Figuras relevantes dos slides entram na própria questão, para raciocinar como na prova.</p></div>
      <div class="card"><h3>🛡️ Escudo anti-chute</h3><p class="muted">Gabarito balanceado, sem sequências de letras iguais, sem “a maior é a certa” e com nível de segurança em cada resposta.</p></div>
      <div class="card"><h3>🗺️ Mapa de cobertura</h3><p class="muted">Cada slide vira um tema no mapa. Veja o que já cobrou, o que domina e o que falta para exaurir o conteúdo.</p></div>
    </div>`;

  Q.Views.home = {
    title: 'Início',
    render() {
      const st = S();
      if (!st.materials.length) return V.emptyState();
      const f = V.filter();
      const mats = E.materials(f);
      const answers = E.answers(f);
      const sm = E.summarize(answers);
      const covs = E.coverageAll(f);
      const tot = covs.reduce((s, c) => s + c.total, 0), touched = covs.reduce((s, c) => s + c.touched, 0), mastered = covs.reduce((s, c) => s + c.mastered, 0);
      const exhausted = covs.filter((c) => c.exhausted).length;
      const series = V.attemptSeries(f);
      const hasData = sm.n > 0;

      // radar / barras por matéria
      const byMat = E.groupBy(answers, (a) => (Q.Store.material(a.materialId) || {}).materia || '—');
      const radar = byMat.length >= 3 ? C.radar(byMat.map((g) => ({ label: g.key, value: g.real })), { size: 340 }) : byMat.map((g) => C.bar(g.key, g.real, { sub: `${g.n} respostas · acerto bruto ${Math.round(g.raw * 100)}%` })).join('');

      // pontos fracos
      const weak = [];
      covs.forEach((c) => c.topics.filter((x) => !x.topic.ignored && x.tries > 0 && x.state === 'fragil').forEach((x) => weak.push({ c, x })));
      weak.sort((a, b) => a.x.mastery - b.x.mastery);
      const nobank = covs.reduce((s, c) => s + c.topics.filter((x) => x.nobank).length, 0);
      const qTotal = covs.reduce((s, c) => s + c.questions, 0);

      return `
      <div class="hero">
        <div class="row between wrap gap-lg">
          <div>
            <div class="eyebrow">${hasData ? 'Seu panorama' : 'Pronto para começar'}</div>
            <h1>${hasData ? `Domínio real de <span class="grad-text">${Math.round(sm.real * 100)}%</span>` : 'Faça seu primeiro <span class="grad-text">simulado</span>'}</h1>
            <p class="muted" style="max-width:48ch;margin:8px 0 20px">${hasData
              ? `${sm.n} respostas em ${series.length} prova(s). O domínio real desconta chutes e acertos por sorte — é o número que importa.`
              : (qTotal ? `Você tem ${mats.length} material(is) e ${qTotal} questões prontas. Um toque em “Simular tudo” já monta a prova com todas elas.` : `Seus slides já foram lidos, mas ainda não há questões. Toque em “Criar questões” para a IA elaborá-las a partir do conteúdo.`)}</p>
            <div class="row wrap gap">
              ${qTotal ? '<button class="btn primary lg" data-act="quick-start">⚡ Simular tudo</button>' : '<button class="btn primary lg" data-act="mk-first">✨ Criar questões</button>'}
              <a class="btn lg" href="#/simulado">Configurar prova</a>
              ${st.session ? '<a class="btn lg" href="#/prova">▶ Continuar prova</a>' : ''}
            </div>
          </div>
          <div class="rings">
            <div class="ring-wrap">${C.ring(sm.real, { text: hasData ? Math.round(sm.real * 100) + '%' : '—', label: 'domínio real' })}<small>acertos com segurança, sem sinais de chute</small></div>
            <div class="ring-wrap">${C.ring(tot ? touched / tot : 0, { c1: 'var(--accent2)', c2: 'var(--good)', label: 'cobertura' })}<small>${touched} de ${tot} temas já cobrados</small></div>
          </div>
        </div>
      </div>

      ${Q.isCreator() ? `      <div class="grid g4 mt">
        <div class="card kpi"><div class="v">${hasData ? Math.round(sm.raw * 100) + '%' : '—'}</div><div class="l">Acerto bruto</div><div class="d muted">${sm.correct}/${sm.n} questões</div></div>
        <div class="card kpi"><div class="v" style="color:var(--good)">${mastered}</div><div class="l">Temas dominados</div><div class="d muted">${Q.pct(mastered, tot)}% do conteúdo</div></div>
        <div class="card kpi"><div class="v">${hasData ? Math.round(sm.integrity * 100) + '%' : '—'}</div><div class="l">Integridade das provas</div><div class="d muted">${sm.fast + sm.patt} resposta(s) suspeitas</div></div>
        <div class="card kpi"><div class="v">${exhausted}/${covs.length}</div><div class="l">Materiais exauridos</div><div class="d muted">${qTotal} questões no banco</div></div>
      </div>` : ''}

      <div class="split mt">
        <div class="card">
          <h3>🗺️ Mapa de cobertura <span class="sub">cada quadrado é um slide</span></h3>
          ${covs.length ? covs.map((c) => V.coverageBlock(c)).join('') : '<p class="muted">Nenhum material neste filtro.</p>'}
          <div class="mt">${V.mapLegend()}</div>
        </div>
        <div class="grid" style="align-content:start">
          <div class="card">
            <h3>🎯 Desempenho por matéria</h3>
            ${hasData ? radar : '<p class="muted">Faça uma prova para ver seu desempenho por matéria.</p>'}
          </div>
          <div class="card">
            <h3>🧭 Próximos passos</h3>
            ${nextSteps({ weak, nobank, covs, hasData })}
          </div>
        </div>
      </div>

      ${series.length > 1 ? `<div class="card mt"><h3>📈 Evolução <span class="sub">por prova</span></h3>
        ${C.lines([{ name: 'Domínio real', color: 'var(--accent2)', values: series.map((s) => s.sm.real), area: true }, { name: 'Acerto bruto', color: 'var(--accent)', values: series.map((s) => s.sm.raw) }], series.map((s) => Q.fmtDate(s.at.at, false)))}
        <div class="legend"><span><i style="background:var(--accent2)"></i>Domínio real</span><span><i style="background:var(--accent)"></i>Acerto bruto</span></div></div>` : ''}
      `;
    },
    act: {
      'mk-first': () => { const m = E.materials(V.filter()).find((x) => !Q.Store.questionsOf(x.id).length) || E.materials(V.filter())[0]; if (m) V.openCreate(m); },
      'quick-start': () => {
        Q.Exam.quick(E.materials(V.filter()).map((m) => m.id));
      },
      'load-demo': async () => {
        await Q.Demo.load({ history: true });
        Q.toast('Exemplo carregado (histórico fictício de demonstração)', 'good');
        Q.App.refresh();
      },
      'go-upload': () => {
        sessionStorage.setItem('localquest-open-upload', '1');
      },
      'drill-weak': () => drill('fraquezas'),
      'drill-new': () => drill('cobertura'),
    },
  };

  function drill(strategy) {
    const ids = E.materials(V.filter()).filter((m) => Q.Store.questionsOf(m.id).length).map((m) => m.id);
    Q.Exam.start({ materialIds: ids, n: 10, strategy, mode: 'estudo', filter: Object.assign({}, V.filter()) });
  }
  V.drill = drill;

  function nextSteps({ weak, nobank, covs, hasData }) {
    const items = [];
    if (weak.length) items.push(['🩹', `Reforçar ${weak.length} tema(s) frágil(is)`, weak.slice(0, 3).map((w) => `slide ${w.x.topic.n} (${esc(w.x.topic.title)})`).join(' · '), '<button class="btn sm" data-act="drill-weak">Treinar agora</button>']);
    const left = covs.reduce((s, c) => s + (c.total - c.touched), 0);
    if (left) items.push(['🧭', `${left} tema(s) ainda não cobrado(s)`, 'Um simulado focado em cobertura explora o que você ainda não viu.', '<button class="btn sm" data-act="drill-new">Explorar</button>']);
    if (nobank) items.push(['📝', `${nobank} slide(s) sem questões`, 'Sem questões o conteúdo não pode ser exaurido.', '<a class="btn sm" href="#/banco">Criar questões</a>']);
    if (!items.length) items.push(['🌟', hasData ? 'Tudo em dia' : 'Comece pelo simulado inteligente', hasData ? 'Revise de forma espaçada para consolidar a memória.' : 'Ele equilibra cobertura e pontos fracos automaticamente.', '']);
    return items.map((i) => `<div class="insight"><span class="em">${i[0]}</span><div><b>${i[1]}</b><small class="muted">${i[2]}</small><div class="mt-s">${i[3]}</div></div></div>`).join('');
  }
})();
