/* Testes do núcleo (Node, sem dependências): node tests/core.test.js */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ctx = { console, setTimeout, clearTimeout, Blob, URL, Math, Date, JSON };
ctx.window = ctx; ctx.document = {}; ctx.addEventListener = () => {};
vm.createContext(ctx);
for (const f of ['util', 'guard']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f + '.js'), 'utf8'), ctx, { filename: f });
// demo.js precisa de Store/Engine; extrai só as definições de questões
const Q = ctx.Q, G = Q.Guard;
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('✗', m); } else console.log('✓', m); };

/* 1) gabaritos */
let worst = { run: 0, stairs: 0, alts: 0, spread: 0 };
for (const n of [3, 4, 5, 8, 10, 12, 15, 20, 30, 50]) {
  for (let s = 1; s <= 300; s++) {
    const key = G.makeKey(n, [], 2, Q.seeded(s * 13 + n));
    const a = G.analyzeKey(key);
    worst.run = Math.max(worst.run, a.maxRun); worst.stairs = Math.max(worst.stairs, a.stairs); worst.alts = Math.max(worst.alts, a.alts);
    if (n >= 8) worst.spread = Math.max(worst.spread, Math.max(...a.counts) - Math.min(...a.counts));
    if (key.length !== n) { fail++; console.error('tamanho errado', n); }
  }
}
console.log('piores casos em 3000 gabaritos:', worst);
ok(worst.run <= 2, 'nunca mais que 2 letras iguais seguidas');
ok(worst.stairs === 0, 'nenhuma escada ABC/DCB');
ok(worst.alts === 0, 'nenhuma alternância ABAB');
ok(worst.spread <= 2, 'distribuição equilibrada entre letras (diferença ≤ 2)');

/* posições fixas */
const fixed = [null, 2, null, null, 2, null, null, null];
const k2 = G.makeKey(8, fixed, 2, Q.seeded(5));
ok(k2[1] === 2 && k2[4] === 2, 'respeita questões com ordem fixa');

/* 2) detecção de padrões */
ok(G.patternSuspects([0, 0, 0, 0, 1, 2]).size === 4, 'detecta 4 letras iguais seguidas');
ok(G.patternSuspects([0, 1, 2, 3, 0, 2]).size === 5, 'detecta escada ABCDA');
ok(G.patternSuspects([1, 3, 1, 3, 1, 0]).size === 5, 'detecta alternância BDBDB');
ok(G.patternSuspects([0, 2, 1, 3, 3, 0, 1]).size === 0, 'não acusa marcação variada');
ok(G.tailRun([1, 2, 2, 2]) === 3, 'tailRun');

/* 3) lint */
const q = (stem, opts, c) => ({ stem, options: opts, correct: c, topicIds: ['t'] });
const lv = (x) => G.worstLevel(G.lint(x));
ok(lv(q('Qual é a capital do Brasil, segundo o slide?', ['Brasília, capital federal desde 1960 e sede dos três poderes', 'Rio', 'São Paulo', 'Salvador'], 0)) === 'bad', 'correta muito maior → bad');
ok(lv(q('Qual é a capital do Brasil, segundo o slide?', ['Brasília', 'Rio de Janeiro', 'São Paulo', 'Todas as anteriores'], 0)) === 'bad', '"todas as anteriores" → bad');
ok(lv(q('Qual é a capital do Brasil, segundo o slide?', ['Brasília', 'Rio de Janeiro', 'São Paulo', 'Salvador'], 0)) !== 'bad', 'questão limpa não é bad');

/* 4) todas as questões do demo passam sem "bad" e sem viés de tamanho sistemático */
const src = fs.readFileSync(path.join(__dirname, '../js/demo.js'), 'utf8');
const sandbox = { ...ctx };
sandbox.Q.Store = { state: { materials: [], questions: [], attempts: [] }, putImage: async () => {}, question: () => null };
vm.runInContext(src, ctx);
const defs = Q.Demo.defs;
let nq = 0, biased = 0, longest = 0, issues = [];
for (const key of ['M1', 'M2']) defs[key].qs.forEach((r, i) => {
  nq++;
  const qq = { stem: r[2], options: r[3], correct: r[4], topicIds: ['x'] };
  const li = G.lint(qq);
  if (li.length) issues.push(`${key} #${i + 1}: ` + li.map((x) => x.level + ':' + x.code).join(','));
  if (G.isLengthBiased(qq)) biased++;
  const L = r[3].map((o) => o.length);
  if (L[r[4]] === Math.max(...L)) longest++;
});
console.log('questões do demo:', nq, '| certa = mais longa:', longest, '| com viés ≥10%:', biased);
console.log(issues.length ? 'avisos:\n  ' + issues.join('\n  ') : 'sem avisos');
ok(!issues.some((s) => s.includes('bad')), 'demo sem alertas graves');
ok(longest / nq <= 0.3, 'certa é a mais longa em ≤ 30% (acaso ≈ 25%)');
const pos = [0, 0, 0, 0]; for (const k of ['M1', 'M2']) defs[k].qs.forEach((r) => pos[r[4]]++);
console.log('posição original da certa nos dados (será embaralhada):', pos);
process.exit(fail ? 1 : 0);
