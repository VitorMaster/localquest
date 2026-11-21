/* node tests/autogen.test.js — criação de questões: quantidade, níveis e ausência de repetição */
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
const mk = (key) => { const d = Q.Demo.defs[key]; const m = { id: key, title: d.title, topics: d.slides.map((s, i) => ({ id: key + i, n: i + 1, title: s.t, text: s.x, ignored: !!s.ign, images: s.img ? [{ id: 'img' + i, kind: 'fig' }] : [] })) }; st.materials.push(m); return m; };
const A = Q.Autogen;
const m1 = mk('M1'), m2 = mk('M2');

/* quantidade */
const r = A.create(m1, { n: 10, levels: [2] });
ok(r.created === 10, 'pediu 10 → criou ' + r.created);
const r2 = A.create(m1, { n: 50, levels: [1, 2, 3] });
const total1 = st.questions.filter((q) => q.materialId === 'M1').length;
console.log('   M1: criou +' + r2.created + ' (total ' + total1 + ', pedido 50, candidatos ' + r2.available + ')');
ok(total1 >= 30, 'o material de 7 slides comporta ' + total1 + ' questões distintas');
ok(total1 <= 60 && r2.created <= 50, 'respeita o máximo de 50 por criação');

/* sem repetição */
const stems = st.questions.filter((q) => q.materialId === 'M1').map((q) => q.stem.toLowerCase());
ok(new Set(stems).size === stems.length, 'nenhum enunciado repetido (' + stems.length + ')');
const optsets = st.questions.filter((q) => q.materialId === 'M1').map((q) => q.options.slice().sort().join('|').toLowerCase());
ok(new Set(optsets).size === optsets.length, 'nenhum conjunto de alternativas repetido');
const r3 = A.create(m1, { n: 50 });
const after = st.questions.filter((q) => q.materialId === 'M1');
ok(new Set(after.map((q) => q.stem.toLowerCase())).size === after.length, 'criar de novo não duplica nada (+' + r3.created + ')');

/* qualidade */
const all = st.questions.filter((q) => q.materialId === 'M1');
ok(all.every((q) => q.options.length === 4 && new Set(q.options).size === 4), 'todas com 4 alternativas diferentes');
ok(!all.some((q) => Q.Guard.lint(q).some((i) => i.level === 'bad' && i.code !== 'slide')), 'nenhuma com pista grave');
ok(all.every((q) => q.explanation && q.whyNot.filter(Boolean).length === 3), 'todas com justificativa da correta e das 3 erradas');
const longest = all.filter((q) => q.options[q.correct].length === Math.max(...q.options.map((o) => o.length))).length / all.length;
ok(longest <= 0.4, 'certa é a mais longa em ' + Math.round(longest * 100) + '% (acaso ≈ 25%)');

/* níveis */
const m = mk('M2');
const lv = (l, n) => { st.questions = st.questions.filter((q) => q.materialId !== 'M2'); A.create(m, { n, levels: [l] }); return st.questions.filter((q) => q.materialId === 'M2'); };
const easy = lv(1, 20), hard = lv(3, 20);
ok(easy.every((q) => q.difficulty === 1) && hard.every((q) => q.difficulty === 3), 'o nível pedido é gravado em cada questão');
const sim = (a, b) => { const w = (s) => new Set(s.toLowerCase().match(/[a-zà-ú0-9]{3,}/g) || []); const A1 = w(a), B1 = w(b); let i = 0; A1.forEach((x) => B1.has(x) && i++); return i / Math.max(1, A1.size + B1.size - i); };
const avg = (qs) => { const v = qs.flatMap((q) => q.options.filter((_, i) => i !== q.correct).map((o) => sim(o, q.options[q.correct]))); return v.reduce((a, b) => a + b, 0) / v.length; };
console.log('   semelhança média das erradas com a certa — fácil:', avg(easy).toFixed(3), '| difícil:', avg(hard).toFixed(3));
ok(avg(hard) >= avg(easy), 'no difícil as alternativas erradas são mais parecidas com a certa');
const mix = (() => { st.questions = st.questions.filter((q) => q.materialId !== 'M2'); A.create(m, { n: 30 }); return st.questions.filter((q) => q.materialId === 'M2'); })();
ok([1, 2, 3].every((l) => mix.some((q) => q.difficulty === l)), 'misto traz os 3 níveis (' + [1, 2, 3].map((l) => mix.filter((q) => q.difficulty === l).length).join('/') + ')');

/* substituir automáticas */
const before = st.questions.filter((q) => q.materialId === 'M2').length;
A.create(m, { n: 5, levels: [2], replaceAuto: true });
ok(st.questions.filter((q) => q.materialId === 'M2').length === 5, 'substituir remove as automáticas não respondidas (' + before + ' → 5)');
process.exit(fail ? 1 : 0);
