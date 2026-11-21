/* Localquest — biblioteca de materiais (slides) e detalhe do material. */
(function () {
  const Q = window.Q, V = Q.V, E = Q.Engine, esc = Q.esc;
  const S = () => Q.Store.state;

  const datalists = () => {
    const u = (k, extra = []) => [...new Set([...extra, ...S().materials.map((m) => m[k])])].map((v) => `<option value="${esc(v)}">`).join('');
    return `<datalist id="dl-curso">${u('curso', Q.CURSOS || [])}</datalist><datalist id="dl-periodo">${u('periodo')}</datalist><datalist id="dl-materia">${u('materia')}</datalist>`;
  };

  function openUpload() {
    let files = [];
    let peeks = [];
    let matAuto = true;
    const f = V.filter();
    const mod = Q.modal(`
      <div class="eyebrow">Novo material</div><h2>Enviar slides da aula</h2>
      <p class="muted">Envie quantos materiais quiser. O Localquest <b>descobre a matéria sozinho</b> lendo os slides; depois uma IA lê o conteúdo e cria as questões de prova. Aceita <b>.pptx</b> e <b>.pdf</b>. A leitura dos arquivos é feita no seu navegador.</p>
      <div class="drop" id="drop"><div class="big">📑</div><b id="drop-t">Arraste os arquivos aqui ou clique para escolher</b><br><small class="muted">PPTX ou PDF — pode enviar vários de uma vez</small>
        <input type="file" id="file" accept=".pptx,.pdf" multiple hidden></div>
      <div class="mt grid g2">
        <div class="field"><label>Curso</label><input type="text" id="u-curso" list="dl-curso" autocomplete="off" placeholder="Comece a digitar: Fis…" value="${esc(f.curso || '')}"></div>
        <div class="field"><label>Período (só o número)</label><input type="text" id="u-periodo" inputmode="numeric" placeholder="Ex.: 6" value="${esc(f.periodo || '')}"></div>
        <div class="field"><label>Matéria <span class="muted" style="text-transform:none;letter-spacing:0">(preenchida automaticamente)</span></label><input type="text" id="u-materia" list="dl-materia" placeholder="Detectada pelos slides" value="${esc(f.materia || '')}"><small class="muted" id="u-hint"></small></div>
        <div class="field"><label>Título da aula</label><input type="text" id="u-title" placeholder="Ex.: Aula 3 — Avaliação funcional"></div>
      </div>${datalists()}
      <div id="u-prog" hidden class="mb"><div class="progress"><i style="width:0"></i></div><small class="muted" id="u-msg"></small></div>
      <div class="row end gap"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="u-go" disabled>Ler slides</button></div>`);
    const el = mod.el, $ = (s) => Q.$(s, el);
    const drop = $('#drop'), inp = $('#file');
    const setFile = (list) => {
      const ok = Array.from(list || []).filter(Q.Ingest.accepts);
      if (!ok.length) return Q.toast('Envie arquivos .pptx ou .pdf', 'bad');
      files = ok;
      $('#drop-t').textContent = '✅ ' + (ok.length === 1 ? ok[0].name : ok.length + ' arquivos: ' + ok.map((f) => f.name).join(', '));
      $('#u-title').disabled = ok.length > 1;
      $('#u-title').placeholder = ok.length > 1 ? 'Cada arquivo usa o próprio nome' : 'Ex.: Aula 3 — Avaliação funcional';
      if (ok.length === 1 && !$('#u-title').value) $('#u-title').value = ok[0].name.replace(/\.(pptx|pdf)$/i, '').replace(/[_-]+/g, ' ');
      if (ok.length > 1) $('#u-title').value = '';
      $('#u-go').disabled = false;
      // leitura rápida (só texto) para reconhecer a matéria e o título
      peeks = new Array(ok.length).fill(null);
      $('#u-hint').textContent = 'Lendo os slides para identificar a matéria…';
      Promise.all(ok.map((fl, i) => Q.Ingest.peek(fl).then((r) => (peeks[i] = r)).catch(() => null))).then(() => {
        if (ok.length === 1) {
          const r = peeks[0];
          if (!r) { $('#u-hint').textContent = 'Não consegui ler o texto para identificar a matéria. Digite-a.'; return; }
          const d = r.detected || {};
          if (d.materia && (!$('#u-materia').value.trim() || matAuto)) { $('#u-materia').value = d.materia; matAuto = true; }
          $('#u-hint').textContent = d.materia
            ? `Detectada ${d.source === 'capa' ? 'na capa do slide' : d.source === 'propriedades' ? 'nas propriedades do arquivo' : 'pelo conteúdo dos slides'}${d.source === 'conteúdo' && d.confidence < 0.6 ? ' (confirme: pouca certeza)' : ''}. Você pode editar.`
            : 'Não consegui identificar a matéria pelos slides. Digite-a.';
          const t = (r.title || '').trim();
          if (t && t.length <= 90 && (!$('#u-title').value || $('#u-title').value === ok[0].name.replace(/\.(pptx|pdf)$/i, '').replace(/[_-]+/g, ' '))) $('#u-title').value = t;
        } else {
          $('#u-hint').textContent = peeks.some((x) => x && x.detected && x.detected.materia)
            ? 'Matéria de cada arquivo: ' + ok.map((fl, i) => `${fl.name.replace(/\.(pptx|pdf)$/i, '')} → ${(peeks[i] && peeks[i].detected && peeks[i].detected.materia) || '?'}`).join(' · ') + '. Deixe o campo vazio para usar essas, ou digite uma matéria para todos.'
            : 'Não consegui identificar a matéria. Digite-a.';
        }
      });
    };
    $('#u-materia').addEventListener('input', () => (matAuto = false));
    drop.addEventListener('click', () => inp.click());
    inp.addEventListener('change', () => setFile(inp.files));
    ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => setFile(e.dataTransfer.files));
    $('#u-go').addEventListener('click', async () => {
      const meta = { title: $('#u-title').value.trim(), curso: $('#u-curso').value.trim(), periodo: Q.normPeriodo($('#u-periodo').value), materia: $('#u-materia').value.trim() };
      const detectedAll = files.map((f, i) => (peeks[i] && peeks[i].detected && peeks[i].detected.materia) || '');
      if ((files.length === 1 && !meta.title) || !meta.curso || !meta.periodo) return Q.toast('Preencha curso e período' + (files.length === 1 ? ' e o título.' : '.'), 'warn');
      if (!meta.materia && !detectedAll.every(Boolean)) return Q.toast('Não consegui identificar a matéria de todos os arquivos. Digite a matéria.', 'warn');
      $('#u-go').disabled = true;
      $('#u-prog').hidden = false;
      const made = [];
      try {
        for (let k = 0; k < files.length; k++) {
          const f = files[k];
          const parsed = await Q.Ingest.parse(f, (p, msg) => {
            $('#u-prog i').style.width = Math.round(((k + p) / files.length) * 100) + '%';
            $('#u-msg').textContent = `Arquivo ${k + 1} de ${files.length}: ${msg}`;
          });
          const pk = peeks[k];
          const title = files.length === 1 ? meta.title : (pk && pk.title && pk.title.length <= 90 ? pk.title : f.name.replace(/\.(pptx|pdf)$/i, '').replace(/[_-]+/g, ' '));
          const m = Q.Ingest.createMaterial(Object.assign({}, meta, { title, materia: meta.materia || detectedAll[k] }), parsed);
          if (Q.Enamed) Q.Enamed.sync();
          made.push(m);
        }
        mod.close();
        Q.toast(made.length === 1 ? `Material adicionado — matéria: ${made[0].materia}. Agora escolha como criar as questões.` : `${made.length} materiais adicionados. Toque em “Criar questões” em cada um.`, 'good', 6000);
        Q.go(made.length === 1 ? '#/biblioteca/' + made[0].id : '#/biblioteca');
        if (made.length === 1) setTimeout(() => V.openCreate(made[0]), 400);
      } catch (e) {
        console.error(e);
        Q.toast((files[made.length] ? files[made.length].name + ': ' : '') + (e.message || 'Falha ao ler o arquivo'), 'bad', 7000);
        if (made.length) Q.App.refreshQuiet();
        $('#u-go').disabled = false;
      }
    });
  }
  V.openUpload = openUpload;

  /* ---------- lista ---------- */
  Q.Views.library = {
    title: 'Biblioteca',
    render(params) {
      if (params && params[0]) return this.detail(params[0]);
      const mats = E.materials(V.filter());
      const head = `<div class="page-h"><div><div class="eyebrow">Biblioteca</div><h1>Seus materiais</h1><p>Os slides das aulas são a única fonte das questões.</p></div>
        <div class="row wrap gap"><button class="btn primary" data-act="sim-all">▶ Simular todos</button>${S().materials.some((m) => m.source === 'demo') ? '<button class="btn danger" data-act="del-demo">🗑 Remover exemplos</button>' : ''}<button class="btn" data-act="new">📤 Adicionar slides</button></div></div>`;
      if (!S().materials.length) return head + `<div class="card empty"><div class="big">📚</div><h3>Nenhum material ainda</h3><p class="muted">Envie um PPTX ou PDF para começar.</p><button class="btn primary" data-act="new">Enviar slides</button> <button class="btn" data-act="demo">Ver exemplo</button></div>`;
      if (!mats.length) return head + '<div class="card empty"><p class="muted">Nenhum material corresponde ao filtro atual.</p></div>';
      return head + `<div class="grid g-auto">${mats.map((m) => {
        const cov = E.coverage(m);
        const imgs = m.topics.flatMap((t) => t.images).slice(0, 6);
        return `<div class="card mat-card">
          <div><h3><a href="#/biblioteca/${m.id}">${esc(m.title)}</a></h3><div class="row wrap gap" style="margin-top:8px">${V.matChips(m)}</div></div>
          ${imgs.length ? `<div class="thumbs">${imgs.map((i) => V.img(i.id, 'thumb')).join('')}</div>` : ''}
          <div class="stat-row"><div class="stat"><b>${cov.total}</b><small>temas (slides)</small></div><div class="stat"><b>${cov.questions}</b><small>questões</small></div><div class="stat"><b>${Math.round(cov.usage * 100)}%</b><small>cobertos</small></div></div>
          <div class="row gap wrap"><a class="btn sm" href="#/biblioteca/${m.id}">Abrir</a><button class="btn sm" data-act="mk-q" data-id="${m.id}">✨ Criar questões</button>${Q.isCreator() ? `<a class="btn sm ghost" href="#/banco/${m.id}">Banco</a>` : ''}<button class="btn sm primary" data-act="sim" data-id="${m.id}">▶ Simular</button><button class="btn sm danger" data-act="del-mat" data-id="${m.id}">🗑 Excluir</button></div></div>`;
      }).join('')}</div>`;
    },
    mount() {
      if (sessionStorage.getItem('localquest-open-upload')) {
        sessionStorage.removeItem('localquest-open-upload');
        openUpload();
      }
    },
    act: {
      new: () => openUpload(),
      demo: async () => { await Q.Demo.load({ history: true }); Q.toast('Exemplo carregado', 'good'); Q.App.refresh(); },
      sim: (el) => Q.Exam.quick([el.dataset.id]),
      'del-demo': async () => {
        const demo = S().materials.filter((m) => m.source === 'demo');
        if (await Q.confirm(`Remover ${demo.length} material(is) de exemplo, suas questões e o histórico fictício?`, 'Remover')) {
          for (const m of demo) await Q.Store.removeMaterial(m.id);
          Q.toast('Exemplos removidos', 'good');
          Q.App.refresh();
        }
      },
      'sim-all': () => Q.Exam.quick(E.materials(V.filter()).map((m) => m.id)),
      ...detailActs(),
    },

    /* ---------- detalhe ---------- */
    detail(id) {
      const m = Q.Store.material(id);
      if (!m) return '<div class="card empty"><h3>Material não encontrado</h3><a class="btn" href="#/biblioteca">Voltar</a></div>';
      const cov = E.coverage(m);
      return `
      <div class="page-h"><div><div class="eyebrow"><a href="#/biblioteca">← Biblioteca</a></div><h1>${esc(m.title)}</h1><div class="row wrap gap" style="margin-top:8px">${V.matChips(m)}<span class="chip">${m.source === 'pdf' ? 'PDF' : m.source === 'pptx' ? 'PPTX' : 'Exemplo'}</span></div></div>
        <div class="row wrap gap"><button class="btn" data-act="mk-q" data-id="${m.id}">✨ Criar questões (${cov.questions})</button>${Q.isCreator() ? `<a class="btn ghost" href="#/banco/${m.id}">📝 Banco</a>` : ''}<button class="btn primary" data-act="sim" data-id="${m.id}">▶ Simular</button> <button class="btn ghost" data-act="edit-mat" data-id="${m.id}">Editar</button><button class="btn danger" data-act="del-mat" data-id="${m.id}">Excluir</button></div></div>
      <div class="card mb">${V.coverageBlock(cov)}${V.mapLegend()}</div>
      <div class="card"><h3>Slides <span class="sub">${cov.total} ativos · desative os que não devem ser cobrados (capa, agenda, referências)</span></h3>
        ${cov.topics.map((x) => {
          const t = x.topic;
          return `<div class="topic-row ${t.ignored ? 'ign' : ''}">
            <div class="topic-n">${t.n}</div>
            <div><b>${esc(t.title)}</b> <span class="badge ${x.state === 'dominado' ? 'b-good' : x.state === 'fragil' ? 'b-bad' : x.state === 'progresso' ? 'b-warn' : 'b-mute'}">${E.STATE_LABEL[x.state]}</span> ${x.nobank ? '<span class="badge b-info">sem questão</span>' : `<span class="chip">${x.bank} questão(ões)</span>`}
              <div class="topic-text">${esc(t.text)}</div>
              ${t.images.length ? `<div class="thumbs mt-s">${t.images.map((i) => `<button style="border:0;background:none;padding:0" data-act="zoom-img" data-img="${i.id}" data-cap="${esc(i.alt)}">${V.img(i.id, 'thumb')}</button>`).join('')}</div>` : ''}</div>
            <div class="row gap wrap"><button class="btn sm ghost" data-act="open-topic" data-m="${m.id}" data-t="${t.id}">Ver</button><button class="btn sm ghost" data-act="ren-topic" data-m="${m.id}" data-t="${t.id}">Renomear</button><button class="btn sm" data-act="tog-ign" data-m="${m.id}" data-t="${t.id}">${t.ignored ? 'Ativar' : 'Ignorar'}</button></div></div>`;
        }).join('')}</div>`;
    },
  };

  function detailActs() {
    return {
      'tog-ign': (el) => { const t = Q.Store.topic(el.dataset.m, el.dataset.t); t.ignored = !t.ignored; Q.Store.save(); Q.App.refresh(); },
      'ren-topic': (el) => {
        const t = Q.Store.topic(el.dataset.m, el.dataset.t);
        const mod = Q.modal(`<h3>Renomear slide ${t.n}</h3><div class="field"><input type="text" id="rn" value="${esc(t.title)}"></div><div class="row end gap"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="ok">Salvar</button></div>`, { cls: 'small' });
        Q.$('#ok', mod.el).onclick = () => { t.title = Q.$('#rn', mod.el).value.trim() || t.title; Q.Store.save(); mod.close(); Q.App.refresh(); };
      },
      'edit-mat': (el) => {
        const m = Q.Store.material(el.dataset.id);
        const mod = Q.modal(`<h3>Editar material</h3>
          <div class="field"><label>Título</label><input type="text" id="e-t" value="${esc(m.title)}"></div>
          <div class="field"><label>Curso</label><input type="text" id="e-c" autocomplete="off" list="dl-curso" value="${esc(m.curso)}"></div>
          <div class="field"><label>Período</label><input type="text" id="e-p" inputmode="numeric" value="${esc(m.periodo)}" placeholder="Só o número, ex.: 6"></div>
          <div class="field"><label>Matéria</label><input type="text" id="e-m" list="dl-materia" value="${esc(m.materia)}"></div>${datalists()}
          <div class="row end gap"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="ok">Salvar</button></div>`, { cls: 'small' });
        Q.$('#ok', mod.el).onclick = () => {
          const g = (i) => Q.$(i, mod.el).value.trim();
          if (!g('#e-t') || !g('#e-c') || !g('#e-p') || !g('#e-m')) return Q.toast('Preencha todos os campos', 'warn');
          Object.assign(m, { title: g('#e-t'), curso: g('#e-c'), periodo: Q.normPeriodo(g('#e-p')), materia: g('#e-m') });
          Q.Store.save(); mod.close(); Q.App.refresh();
        };
      },
      'del-mat': async (el) => {
        const m = Q.Store.material(el.dataset.id);
        if (await Q.confirm(`Excluir “${m.title}”, suas questões e o histórico de respostas dele? Essa ação não pode ser desfeita.`, 'Excluir')) {
          await Q.Store.removeMaterial(m.id);
          Q.toast('Material excluído');
          Q.go('#/biblioteca');
        }
      },
    };
  }
})();
