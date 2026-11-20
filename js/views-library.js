/* Atlas — biblioteca de materiais (slides) e detalhe do material. */
(function () {
  const Q = window.Q, V = Q.V, E = Q.Engine, esc = Q.esc;
  const S = () => Q.Store.state;

  const datalists = () => {
    const u = (k) => [...new Set(S().materials.map((m) => m[k]))].map((v) => `<option value="${esc(v)}">`).join('');
    return `<datalist id="dl-curso">${u('curso')}</datalist><datalist id="dl-periodo">${u('periodo')}</datalist><datalist id="dl-materia">${u('materia')}</datalist>`;
  };

  function openUpload() {
    let file = null;
    const f = V.filter();
    const mod = Q.modal(`
      <div class="eyebrow">Novo material</div><h2>Enviar slides da aula</h2>
      <p class="muted">Aceita <b>.pptx</b> (texto + imagens de cada slide) e <b>.pdf</b> (texto + imagem da página). Tudo é processado no seu navegador — nada sai do seu computador.</p>
      <div class="drop" id="drop"><div class="big">📑</div><b id="drop-t">Arraste o arquivo aqui ou clique para escolher</b><br><small class="muted">PPTX ou PDF</small>
        <input type="file" id="file" accept=".pptx,.pdf" hidden></div>
      <div class="mt grid g2">
        <div class="field"><label>Curso</label><input type="text" id="u-curso" list="dl-curso" placeholder="Ex.: Fisioterapia" value="${esc(f.curso || '')}"></div>
        <div class="field"><label>Período</label><input type="text" id="u-periodo" list="dl-periodo" placeholder="Ex.: 6º período" value="${esc(f.periodo || '')}"></div>
        <div class="field"><label>Matéria</label><input type="text" id="u-materia" list="dl-materia" placeholder="Ex.: Geriatria" value="${esc(f.materia || '')}"></div>
        <div class="field"><label>Título da aula</label><input type="text" id="u-title" placeholder="Ex.: Aula 3 — Avaliação funcional"></div>
      </div>${datalists()}
      <div id="u-prog" hidden class="mb"><div class="progress"><i style="width:0"></i></div><small class="muted" id="u-msg"></small></div>
      <div class="row end gap"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="u-go" disabled>Ler slides</button></div>`);
    const el = mod.el, $ = (s) => Q.$(s, el);
    const drop = $('#drop'), inp = $('#file');
    const setFile = (fl) => {
      if (!fl) return;
      if (!Q.Ingest.accepts(fl)) return Q.toast('Envie um arquivo .pptx ou .pdf', 'bad');
      file = fl;
      $('#drop-t').textContent = '✅ ' + fl.name;
      if (!$('#u-title').value) $('#u-title').value = fl.name.replace(/\.(pptx|pdf)$/i, '').replace(/[_-]+/g, ' ');
      $('#u-go').disabled = false;
    };
    drop.addEventListener('click', () => inp.click());
    inp.addEventListener('change', () => setFile(inp.files[0]));
    ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => setFile(e.dataTransfer.files[0]));
    $('#u-go').addEventListener('click', async () => {
      const meta = { title: $('#u-title').value.trim(), curso: $('#u-curso').value.trim(), periodo: $('#u-periodo').value.trim(), materia: $('#u-materia').value.trim() };
      if (!meta.title || !meta.curso || !meta.periodo || !meta.materia) return Q.toast('Preencha curso, período, matéria e título.', 'warn');
      $('#u-go').disabled = true;
      $('#u-prog').hidden = false;
      try {
        const parsed = await Q.Ingest.parse(file, (p, msg) => {
          $('#u-prog i').style.width = Math.round(p * 100) + '%';
          $('#u-msg').textContent = msg;
        });
        const m = Q.Ingest.createMaterial(meta, parsed);
        mod.close();
        const imgs = parsed.topics.reduce((s, t) => s + t.images.length, 0);
        Q.toast(`${parsed.topics.length} slides lidos, ${imgs} imagem(ns) extraída(s)${parsed.skipped ? ` (${parsed.skipped} em formato não suportado foram ignoradas)` : ''}`, 'good', 6000);
        Q.go('#/biblioteca/' + m.id);
      } catch (e) {
        console.error(e);
        Q.toast(e.message || 'Falha ao ler o arquivo', 'bad', 6000);
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
        <button class="btn primary" data-act="new">📤 Adicionar slides</button></div>`;
      if (!S().materials.length) return head + `<div class="card empty"><div class="big">📚</div><h3>Nenhum material ainda</h3><p class="muted">Envie um PPTX ou PDF para começar.</p><button class="btn primary" data-act="new">Enviar slides</button> <button class="btn" data-act="demo">Ver exemplo</button></div>`;
      if (!mats.length) return head + '<div class="card empty"><p class="muted">Nenhum material corresponde ao filtro atual.</p></div>';
      return head + `<div class="grid g-auto">${mats.map((m) => {
        const cov = E.coverage(m);
        const imgs = m.topics.flatMap((t) => t.images).slice(0, 6);
        return `<div class="card mat-card">
          <div><h3><a href="#/biblioteca/${m.id}">${esc(m.title)}</a></h3><div class="row wrap gap" style="margin-top:8px">${V.matChips(m)}</div></div>
          ${imgs.length ? `<div class="thumbs">${imgs.map((i) => V.img(i.id, 'thumb')).join('')}</div>` : ''}
          <div class="stat-row"><div class="stat"><b>${cov.total}</b><small>temas (slides)</small></div><div class="stat"><b>${cov.questions}</b><small>questões</small></div><div class="stat"><b>${Math.round(cov.usage * 100)}%</b><small>cobertos</small></div></div>
          <div class="row gap wrap"><a class="btn sm" href="#/biblioteca/${m.id}">Abrir</a><a class="btn sm" href="#/banco/${m.id}">Questões</a><button class="btn sm" data-act="sim" data-id="${m.id}">Simular</button></div></div>`;
      }).join('')}</div>`;
    },
    mount() {
      if (sessionStorage.getItem('atlas-open-upload')) {
        sessionStorage.removeItem('atlas-open-upload');
        openUpload();
      }
    },
    act: {
      new: () => openUpload(),
      demo: async () => { await Q.Demo.load({ history: true }); Q.toast('Exemplo carregado', 'good'); Q.App.refresh(); },
      sim: (el) => { S().ui.examPreset = { materialIds: [el.dataset.id] }; Q.go('#/simulado'); },
      ...detailActs(),
    },

    /* ---------- detalhe ---------- */
    detail(id) {
      const m = Q.Store.material(id);
      if (!m) return '<div class="card empty"><h3>Material não encontrado</h3><a class="btn" href="#/biblioteca">Voltar</a></div>';
      const cov = E.coverage(m);
      return `
      <div class="page-h"><div><div class="eyebrow"><a href="#/biblioteca">← Biblioteca</a></div><h1>${esc(m.title)}</h1><div class="row wrap gap" style="margin-top:8px">${V.matChips(m)}<span class="chip">${m.source === 'pdf' ? 'PDF' : m.source === 'pptx' ? 'PPTX' : 'Exemplo'}</span></div></div>
        <div class="row wrap gap"><a class="btn" href="#/banco/${m.id}">📝 Banco de questões (${cov.questions})</a><button class="btn primary" data-act="sim" data-id="${m.id}">▶ Simular</button><button class="btn ghost" data-act="edit-mat" data-id="${m.id}">Editar</button><button class="btn danger" data-act="del-mat" data-id="${m.id}">Excluir</button></div></div>
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
          <div class="field"><label>Curso</label><input type="text" id="e-c" list="dl-curso" value="${esc(m.curso)}"></div>
          <div class="field"><label>Período</label><input type="text" id="e-p" list="dl-periodo" value="${esc(m.periodo)}"></div>
          <div class="field"><label>Matéria</label><input type="text" id="e-m" list="dl-materia" value="${esc(m.materia)}"></div>${datalists()}
          <div class="row end gap"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="ok">Salvar</button></div>`, { cls: 'small' });
        Q.$('#ok', mod.el).onclick = () => {
          const g = (i) => Q.$(i, mod.el).value.trim();
          if (!g('#e-t') || !g('#e-c') || !g('#e-p') || !g('#e-m')) return Q.toast('Preencha todos os campos', 'warn');
          Object.assign(m, { title: g('#e-t'), curso: g('#e-c'), periodo: g('#e-p'), materia: g('#e-m') });
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
