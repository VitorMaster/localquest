/* Localquest — service worker: guarda o app no aparelho para funcionar sem internet (ex.: sala presencial). */
const CACHE = 'localquest-v2';
const ASSETS = ["./", "index.html", "css/app.css", "manifest.json", "icon-192.png", "icon-512.png", "vendor/pdf.worker.min.js", "vendor/jszip.min.js", "vendor/pdf.min.js", "vendor/qrcode.js", "vendor/jsQR.js", "js/util.js", "js/cursos.js", "js/medbank.js", "js/store.js", "js/guard.js", "js/engine.js", "js/charts.js", "js/ingest.js", "js/ai.js", "js/demo.js", "js/autogen.js", "js/views-common.js", "js/views-home.js", "js/views-library.js", "js/views-bank.js", "js/views-create.js", "js/views-exam.js", "js/views-perf.js", "js/enamed.js", "js/duel-core.js", "js/p2p.js", "js/views-room.js", "js/views-rank.js", "js/views-duel.js", "js/tips.js", "js/app.js"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(ASSETS.map((a) => c.add(a).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// cache primeiro; em paralelo, atualiza a cópia guardada (a versão nova vale na próxima abertura)
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(r, { ignoreSearch: true });
    const net = fetch(r).then((res) => { if (res && res.ok) c.put(r, res.clone()); return res; }).catch(() => null);
    return hit || (await net) || (r.mode === 'navigate' ? c.match('index.html') : Response.error());
  }));
});
