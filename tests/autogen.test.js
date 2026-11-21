/* Teste do gerador automático: node tests/autogen.test.js */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console, setTimeout, clearTimeout, Blob, URL, Math, Date, JSON };
ctx.window = ctx; ctx.document = {}; ctx.addEventListener = () => {};
vm.createContext(ctx);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f + '.js'), 'utf8'), ctx, { filename: f });
load('util'); load('guard');
const Q = ctx.Q;
const st = { materials: [], questions: [], attempts: [] };
Q.Store = { state: st, putImage: async () => {}, save() {}, material: (id) => st.materials.find((m) => m.id === id), questionsOf: (id) => st.questions.filter((q) => q.materialId === id) };
load('demo'); load('autogen');
let fail = 0; const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) fail++; };
let total = 0, withImg = 0, longest = 0, bad = 0, shown = [];
for (const key of ['M1', 'M2']) {
  const d = Q.Demo.defs[key];
  const m = { id: key, title: d.title, topics: d.slides.map((s, i) => ({ id: key + i, n: i + 1, title: s.t, text: s.x, ignored: !!s.ign, images: s.img ? [{ id: 'img' + i, kind: 'fig' }] : [] })) };
  st.materials.push(m);
  const n = Q.Autogen.fill(m);
  const qs = st.questions.filter((q) => q.materialId === key);
  total += n;
  qs.forEach((q) => {
    if (q.imageIds.length) withImg++;
    if (q.options[q.correct].length === Math.max(...q.options.map((o) => o.length))) longest++;
    if (Q.Guard.lint(q).some((i) => i.level === 'bad')) bad++;
  });
  const cov = m.topics.filter((t) => !t.ignored && !qs.some((q) => q.topicIds.includes(t.id))).length;
  console.log(key, '→', n, 'questões; slides sem questão:', cov);
  ok(cov === 0, key + ': todos os slides ativos têm questão');
  shown.push(...Q.shuffle(qs).slice(0, 4));
}
ok(total >= 30, 'gerou ' + total + ' questões');
ok(bad === 0, 'nenhuma com pista grave');
ok(longest / total <= 0.35, 'certa é a mais longa em ' + Math.round(100 * longest / total) + '% (acaso ≈ 25%)');
console.log('com imagem:', withImg, '/', total);
shown.forEach((q) => console.log('\n' + q.stem + '\n' + q.options.map((o, i) => (i === q.correct ? ' ✔ ' : '   ') + 'ABCD'[i] + ') ' + o).join('\n')));
process.exit(fail ? 1 : 0);
