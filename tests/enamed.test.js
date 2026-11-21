/* node tests/enamed.test.js — parser do ENAMED com texto sintético (NÃO são questões reais do INEP) */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console, setTimeout, Math, Date, JSON, navigator: {} }; ctx.window = ctx; ctx.document = {}; ctx.addEventListener = () => {};
vm.createContext(ctx);
for (const f of ['util', 'enamed']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f + '.js'), 'utf8'), ctx);
const Q = ctx.Q; let fail = 0; const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) fail++; };
const t1 = `ENAMED 2025\nQUESTÃO 1\nA paciente de 70 anos apresenta queda da própria altura. Qual a conduta inicial mais adequada\nneste caso?\n(A) Solicitar exame laboratorial de rotina\n(B) Avaliar risco de quedas com o teste Timed Up and Go\n(C) Orientar repouso absoluto no leito\n(D) Iniciar sedativo\n\nQUESTÃO 2\nSobre a hipotensão ortostática, assinale a alternativa correta.\nA queda de pressão ocorre ao levantar\nB sempre há febre\nC aumenta a pressão em pé\nD é exclusiva de jovens\n\nQUESTÃO 3\nObserve a figura abaixo e assinale a correta.\nA um\nB dois\nC três\nD quatro\n`;
const q = Q.Enamed.parseCaderno(t1);
ok(q.length === 3, 'achou 3 questões (' + q.length + ')');
ok(q[0].options.length === 4 && /Timed Up and Go/.test(q[0].options[1]), 'alternativas explícitas (A)…(D)');
ok(/neste caso/.test(q[0].stem), 'enunciado multilinha');
ok(q[1].options[0].startsWith('queda de pressão') || q[1].options[0].includes('queda de pressão'), 'alternativas simples "A texto" (stem "A queda" não vira alternativa): ' + JSON.stringify(q[1].options[0]));
const g = Q.Enamed.parseGabarito('Item Gabarito\n1 B\n2 - A\n3: C\n');
ok(g[1] === 'B' && g[2] === 'A' && g[3] === 'C', 'gabarito ' + JSON.stringify(g));
process.exit(fail ? 1 : 0);
