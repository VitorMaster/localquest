/* node tests/ai.test.js — pedido à IA e validação da resposta */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console, setTimeout, clearTimeout, Math, Date, JSON, Blob, URL }; ctx.window = ctx; ctx.document = {}; ctx.addEventListener = () => {}; vm.createContext(ctx);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f + '.js'), 'utf8'), ctx, { filename: f });
load('util'); load('guard'); load('medbank');
const Q = ctx.Q;
const st = { materials: [], questions: [], attempts: [], settings: {} };
Q.Store = { state: st, save() {}, questionsOf: (id) => st.questions.filter((q) => q.materialId === id) };
Q.Engine = { activeTopics: (m) => m.topics.filter((t) => !t.ignored) };
load('ai');
let fail = 0; const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) fail++; };
const mat = { id: 'm1', title: 'Polifarmácia', materia: 'Farmacologia', periodo: '4º período', curso: 'Medicina', topics: [
  { id: 't1', n: 1, title: 'Polifarmácia', text: 'Uso concomitante de 5 ou mais medicamentos\nAumenta o risco de interações e quedas' },
  { id: 't2', n: 2, title: 'Critérios de Beers', text: 'Lista de medicamentos potencialmente inapropriados para idosos\nBenzodiazepínicos de longa ação' },
  { id: 't3', n: 3, title: 'Cascata de prescrição', text: 'Efeito adverso interpretado como doença nova\nAINE causa aumento da pressão arterial e leva a anti-hipertensivo' }] };
st.materials.push(mat);

const p = Q.Ai.buildExamPrompt(mat, { n: 10, levels: [1, 2, 3], focus: ['t2'], avoid: ['Pergunta antiga sobre Beers?'] });
ok(/EXATAMENTE 10 questões/.test(p), 'pede exatamente N questões');
ok(/FÁCIL/.test(p) && /MÉDIO/.test(p) && /DIFÍCIL/.test(p) && /caso clínico/.test(p), 'descreve os 3 níveis (o difícil é caso clínico/análise)');
ok(/PROIBIDO escrever "segundo o slide"/.test(p), 'proíbe citar "segundo o slide"');
ok(/FONTE ÚNICA/.test(p) && /Não traga dados de outras fontes/.test(p), 'regra de fonte única: os slides');
ok(/### Slide 2 — Critérios de Beers/.test(p) && /PRIORIZE os slides 2/.test(p), 'inclui os slides e o foco do lote');
ok(/Pergunta antiga sobre Beers\?/.test(p), 'lista as questões existentes para não repetir');
ok(/APOIO PARA ALTERNATIVAS ERRADAS/.test(p) && /propranolol/.test(p) && /nunca como fonte da resposta correta/.test(p), 'banco médico entra só como apoio de alternativas erradas');
ok(/"justificativas"/.test(p) && /explicacao/.test(p), 'pede justificativa da correta e de cada errada');

const good = { nivel: 3, slides: [2], conceito: 'Beers', enunciado: 'Idosa de 78 anos em uso crônico de diazepam passa a ter quedas. Qual avaliação melhor se relaciona ao risco apontado?', alternativas: ['Revisar o uso de benzodiazepínico de longa ação', 'Aumentar a dose do sedativo', 'Associar um segundo ansiolítico', 'Manter a prescrição sem alterações'], correta: 'A', explicacao: 'No slide 2, benzodiazepínicos de longa ação são potencialmente inapropriados para idosos.', justificativas: { B: 'Aumentar a dose agrava o risco.', C: 'Associar outro sedativo soma riscos.', D: 'O slide 2 recomenda revisar, não manter.' } };
const dup = Object.assign({}, good, { enunciado: 'Uma idosa de 78 anos em uso crônico de diazepam passa a ter quedas. Qual avaliação melhor se relaciona ao risco apontado?' });
const bad = { enunciado: 'Pergunta incompleta', alternativas: ['a', 'b', 'c'], correta: 'A' };
const semSlide = { enunciado: 'Um paciente usa AINE, evolui com aumento da pressão arterial e recebe anti-hipertensivo. Que fenômeno descreve esse encadeamento?', alternativas: ['Cascata de prescrição', 'Desprescrição', 'Reconciliação medicamentosa', 'Subdosagem'], correta: 'Cascata de prescrição', explicacao: 'Efeito adverso tratado como doença nova.', justificativas: ['', 'x', 'y', 'z'] };
const meta = { slides: [1], enunciado: 'Segundo o slide, quantos medicamentos definem a polifarmácia?', alternativas: ['Dois', 'Cinco ou mais', 'Três', 'Oito'], correta: 'B', explicacao: 'x' };
const r = Q.Ai.importQuestions(mat, '```json\n' + JSON.stringify([good, dup, bad, semSlide, meta]) + '\n```', 'ai');
ok(r.added.length === 3, 'importou 3 de 5 (' + r.added.length + ')');
ok(r.rejected.some((x) => /repetida/.test(x.why)) && r.rejected.some((x) => /4 alternativas/.test(x.why)), 'descartou a quase-duplicada e a malformada: ' + r.rejected.map((x) => x.why).join(' | '));
const q1 = r.added[0];
ok(q1.correct === 0 && q1.difficulty === 3 && q1.topicIds[0] === 't2', 'correta, nível e slide mapeados');
ok(q1.whyNot[0] === '' && /agrava/.test(q1.whyNot[1]) && q1.whyNot.filter(Boolean).length === 3, 'justificativa de cada alternativa errada');
const q2 = r.added[1];
ok(q2.topicIds[0] === 't3' && q2.correct === 0, 'sem slide informado → associa ao slide certo pelo conteúdo (' + q2.topicIds + ')');
ok(r.meta === 1, 'sinaliza enunciado que cita "segundo o slide" (' + r.meta + ')');
ok(Q.Guard.lint(r.added[2]).some((i) => i.code === 'meta'), 'lint avisa sobre o enunciado que cita o slide');
const r2 = Q.Ai.importQuestions(mat, [good], 'ai', { max: 1 });
ok(r2.added.length === 0, 'não reimporta a mesma questão');
const parts = Q.Ai.chatParts(mat, 30, [1, 2, 3]);
ok(parts.length === 3 && parts.map((x) => x.n).join(',') === '12,12,6', 'chat: 30 questões em 3 partes (12, 12, 6)');
ok(Q.Ai.levelPlan(30, [1, 2, 3]).filter((l) => l === 3).length === 10, 'misto: 10 de cada nível');
ok(Q.Ai.levelPlan(8, [3]).every((l) => l === 3), 'só difícil: todas no nível difícil');
process.exit(fail ? 1 : 0);
