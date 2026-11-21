/* node tests/duel.test.js — núcleo das disputas */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console, setTimeout, clearTimeout, Blob, URL, Math, Date, JSON, crypto: globalThis.crypto, TextEncoder, Uint8Array, Promise };
ctx.window = ctx; ctx.document = {}; ctx.addEventListener = () => {};
vm.createContext(ctx);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f + '.js'), 'utf8'), ctx, { filename: f });
load('util'); load('guard');
const Q = ctx.Q;
const st = { materials: [], questions: [], attempts: [], settings: { maxRun: 2 } };
Q.Store = { state: st, putImage: async () => {}, save() {}, material: (id) => st.materials.find((m) => m.id === id), question: (id) => st.questions.find((q) => q.id === id), questionsOf: (id) => st.questions.filter((q) => q.materialId === id), topic: () => null };
load('engine'); load('demo'); load('autogen'); load('duel-core');
let fail = 0; const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) fail++; };
(async () => {
  // carrega o demo só com questões (sem histórico)
  const mats = await Q.Demo.load({ history: false });
  const duel = await Q.Duel.build({ materialIds: mats.map((m) => m.id), n: 12, title: 'Teste', kind: 'casa', host: 'u1', tsec: 30 });
  ok(duel.questions.length === 12, 'montou 12 questões');
  ok(duel.questions.every((q) => q.o.length === 4 && /^[0-9a-f]{64}$/.test(q.h)), 'todas com 4 alternativas e hash do gabarito');
  ok(!JSON.stringify(duel).includes('"correct"'), 'o gabarito não aparece em texto claro');
  const keyLetters = []; const hs = await Q.Duel.hashes(duel);
  duel.questions.forEach((q, i) => keyLetters.push([0, 1, 2, 3].find((c) => hs[i][c] === q.h)));
  const a = Q.Guard.analyzeKey(keyLetters);
  ok(a.maxRun <= 2 && a.stairs === 0 && a.alts === 0, 'gabarito da disputa sem sequências (run ' + a.maxRun + ', escadas ' + a.stairs + ')');
  ok(keyLetters.every((c) => c >= 0), 'cada questão tem uma correta identificável');
  // pontuação
  ok(Q.Duel.points(true, 0, 30) === 1000 && Q.Duel.points(true, 30000, 30) === 500 && Q.Duel.points(false, 1000, 30) === 0 && Q.Duel.points(true, 40000, 30) === 0, 'pontos: 1000 → 500 conforme o tempo; erro/atraso = 0');
  // ranking
  const ans = (cs, ms) => Object.fromEntries(cs.map((c, i) => [i, { c, ms }]));
  const right = keyLetters, wrong = keyLetters.map((c) => (c + 1) % 4);
  const players = [
    { uid: 'a', nick: 'Ana', answers: ans(right.slice(0, 6), 5000) },
    { uid: 'b', nick: 'Beto', answers: ans(right.slice(0, 6), 2000) },
    { uid: 'c', nick: 'Caio', answers: ans(wrong.slice(0, 6), 1000) },
    { uid: 'd', nick: 'Duda', answers: ans(right.slice(0, 8), 9000) },
  ];
  const b = Q.Duel.board(duel, hs, players);
  ok(b[0].nick === 'Duda' && b[0].c === 8, 'mais acertos vence mesmo sendo mais lento');
  ok(b[1].nick === 'Beto' && b[2].nick === 'Ana', 'empate em acertos → desempata por pontos (rapidez)');
  ok(b[3].nick === 'Caio' && b[3].c === 0, 'quem errou tudo fica por último');
  const b3 = Q.Duel.board(duel, hs, players, 2);
  ok(b3.find((r) => r.nick === 'Duda').answered === 3, 'placar parcial até a questão N');
  ok(Q.Duel.status({ kind: 'casa', opensAt: Date.now() + 1e6, state: {} }) === 'soon' && Q.Duel.status({ kind: 'casa', closesAt: Date.now() - 1, state: {} }) === 'closed', 'agenda: em breve / encerrada');
  process.exit(fail ? 1 : 0);
})();
