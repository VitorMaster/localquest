/* Localquest — persistência local (IndexedDB). Estado em JSON + imagens como Blob. */
(function () {
  const Q = window.Q;
  const DB_NAME = 'localquest-simulador';
  let db = null;
  const urlCache = new Map();
  const memImages = new Map(); // fallback quando o IndexedDB não está disponível

  const blank = () => ({
    v: 1,
    materials: [], // {id,title,curso,periodo,materia,createdAt,source,topics:[{id,n,title,text,images:[{id,alt,kind}],ignored}]}
    questions: [], // {id,materialId,topicIds,stem,options[4],correct,explanation,imageIds,difficulty,fixedOrder,origin}
    attempts: [], // ver engine.js
    session: null, // prova em andamento
    settings: { theme: 'dark', apiKey: '', model: 'claude-sonnet-5-5', maxRun: 2, useImages: true, aiQuality: false },
    ui: { filter: { curso: '', periodo: '', materia: '' } },
  });

  const Store = (Q.Store = { state: blank(), ready: false, persistent: true });

  const tx = (store, mode, fn) =>
    new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let out;
      const r = fn(s);
      if (r) r.onsuccess = () => (out = r.result);
      t.oncomplete = () => resolve(out);
      t.onerror = t.onabort = () => reject(t.error);
    });

  Store.init = async () => {
    try {
      db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore('kv');
          req.result.createObjectStore('images');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const saved = await tx('kv', 'readonly', (s) => s.get('state'));
      if (saved) Store.state = Object.assign(blank(), saved);
      Store.state.settings = Object.assign(blank().settings, Store.state.settings);
      Store.state.ui = Object.assign(blank().ui, Store.state.ui);
    } catch (e) {
      console.warn('IndexedDB indisponível, usando memória.', e);
      Store.persistent = false;
    }
    Store.ready = true;
    return Store.state;
  };

  let saving = null;
  Store.save = () => {
    clearTimeout(saving);
    saving = setTimeout(Store.saveNow, 250);
  };
  Store.saveNow = async () => {
    clearTimeout(saving);
    if (!db) return;
    try {
      await tx('kv', 'readwrite', (s) => s.put(JSON.parse(JSON.stringify(Store.state)), 'state'));
    } catch (e) {
      console.error(e);
      Q.toast('Não foi possível salvar (armazenamento cheio?)', 'bad');
    }
  };
  window.addEventListener('beforeunload', () => Store.saveNow());

  /* ---------- imagens ---------- */
  Store.putImage = async (id, blob) => {
    memImages.set(id, blob);
    if (db) await tx('images', 'readwrite', (s) => s.put(blob, id));
    return id;
  };
  Store.getImageBlob = async (id) => {
    if (memImages.has(id)) return memImages.get(id);
    if (!db) return null;
    const b = await tx('images', 'readonly', (s) => s.get(id));
    if (b) memImages.set(id, b);
    return b || null;
  };
  Store.imageUrl = async (id) => {
    if (urlCache.has(id)) return urlCache.get(id);
    const b = await Store.getImageBlob(id);
    if (!b) return null;
    const u = URL.createObjectURL(b);
    urlCache.set(id, u);
    return u;
  };
  /** Preenche todos os <img data-img="id"> dentro de root. */
  Store.hydrateImages = async (root = document) => {
    const imgs = Q.$$('img[data-img]', root);
    await Promise.all(
      imgs.map(async (img) => {
        const url = await Store.imageUrl(img.dataset.img);
        if (url) img.src = url;
        else img.alt = 'imagem indisponível';
      })
    );
  };
  Store.deleteImages = async (ids) => {
    for (const id of ids) {
      memImages.delete(id);
      if (urlCache.has(id)) {
        URL.revokeObjectURL(urlCache.get(id));
        urlCache.delete(id);
      }
      if (db) await tx('images', 'readwrite', (s) => s.delete(id)).catch(() => {});
    }
  };

  /* ---------- consultas ---------- */
  Store.material = (id) => Store.state.materials.find((m) => m.id === id);
  Store.question = (id) => Store.state.questions.find((q) => q.id === id);
  Store.topic = (materialId, topicId) => {
    const m = Store.material(materialId);
    return m ? m.topics.find((t) => t.id === topicId) : null;
  };
  Store.questionsOf = (materialId) => Store.state.questions.filter((q) => q.materialId === materialId);

  Store.removeMaterial = async (id) => {
    const m = Store.material(id);
    if (!m) return;
    const imgIds = new Set();
    m.topics.forEach((t) => t.images.forEach((i) => imgIds.add(i.id)));
    Store.questionsOf(id).forEach((q) => (q.imageIds || []).forEach((i) => imgIds.add(i)));
    const st = Store.state;
    st.materials = st.materials.filter((x) => x.id !== id);
    st.questions = st.questions.filter((q) => q.materialId !== id);
    st.attempts.forEach((a) => (a.answers = a.answers.filter((an) => an.materialId !== id)));
    st.attempts = st.attempts.filter((a) => a.answers.length);
    if (st.session) st.session = null;
    await Store.deleteImages([...imgIds]);
    Store.save();
  };

  /* ---------- backup ---------- */
  Store.exportAll = async () => {
    const ids = new Set();
    Store.state.materials.forEach((m) => m.topics.forEach((t) => t.images.forEach((i) => ids.add(i.id))));
    Store.state.questions.forEach((q) => (q.imageIds || []).forEach((i) => ids.add(i)));
    const images = {};
    for (const id of ids) {
      const b = await Store.getImageBlob(id);
      if (b) images[id] = await Q.blobToDataURL(b);
    }
    const state = JSON.parse(JSON.stringify(Store.state));
    state.settings.apiKey = ''; // nunca exporta a chave
    state.session = null;
    return JSON.stringify({ app: 'localquest', version: 1, exportedAt: Date.now(), state, images });
  };

  Store.importAll = async (text) => {
    const data = JSON.parse(text);
    if (!data || (data.app !== 'localquest' && data.app !== 'atlas') || !data.state) throw new Error('Arquivo de backup inválido.');
    const keepKey = Store.state.settings.apiKey;
    Store.state = Object.assign(blank(), data.state);
    Store.state.settings = Object.assign(blank().settings, data.state.settings, { apiKey: keepKey });
    for (const [id, url] of Object.entries(data.images || {})) {
      await Store.putImage(id, Q.dataURLToBlob(url));
    }
    await Store.saveNow();
  };

  Store.reset = async () => {
    Store.state = blank();
    urlCache.clear();
    memImages.clear();
    if (db) {
      await tx('images', 'readwrite', (s) => s.clear());
    }
    await Store.saveNow();
  };

  Store.blank = blank;
})();
