/* node tests/medbank.test.js — reconhecimento automático da matéria */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console, Math, Date, JSON }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['util', 'medbank', 'demo']) { try { vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f + '.js'), 'utf8'), ctx); } catch (e) { if (f !== 'demo') throw e; } }
const Q = ctx.Q, M = Q.Med; let fail = 0; const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) fail++; };
const sl = (t, x) => ({ title: t, text: x });
let r = M.detectSubject({ slides: [sl('Capa', 'Disciplina: Farmacologia Clínica\nProf. Fulano'), sl('Intro', 'texto')] });
ok(r.materia.startsWith('Farmacologia') && r.source === 'capa', 'capa explícita → ' + JSON.stringify(r));
r = M.detectSubject({ subject: 'Cardiologia', slides: [sl('x', 'y')] });
ok(r.materia === 'Cardiologia' && r.source === 'propriedades', 'propriedades do arquivo → ' + r.materia);
r = M.detectSubject({ slides: [sl('Hipertensão arterial', 'Definição: pressão arterial sistólica ≥ 140 mmHg\nFatores de risco: obesidade'), sl('Insuficiência cardíaca', 'Dispneia\nEdema\nFibrilação atrial: ritmo irregular\nInfarto agudo do miocárdio e angina'), sl('ECG', 'O eletrocardiograma mostra arritmia e a coronária')] });
ok(r.materia === 'Cardiologia' && r.source === 'conteúdo', 'pelo conteúdo (cardio) → ' + r.materia + ' (' + Math.round(r.confidence * 100) + '%)');
const d = ctx.Q.Demo && ctx.Q.Demo.defs;
if (d) {
  r = M.detectSubject({ title: d.M1.title, slides: d.M1.slides.map((s) => sl(s.t, s.x)) });
  ok(r.materia === 'Geriatria', 'demo 1 (envelhecimento, TUG, quedas) → ' + r.materia);
  r = M.detectSubject({ title: d.M2.title, slides: d.M2.slides.map((s) => sl(s.t, s.x)) });
  ok(r.materia === 'Farmacologia', 'demo 2 (polifarmácia, Beers) → ' + r.materia);
}
r = M.detectSubject({ slides: [sl('Aula', 'Bom dia a todos. Vamos começar.')] });
ok(r.materia === '' && r.confidence === 0, 'sem pista → vazio (o app pede para o usuário)');
ok(M.supportText('Farmacologia').includes('propranolol') && M.supportText('Assunto inexistente') === '', 'apoio de distratores só quando há banco da matéria');
process.exit(fail ? 1 : 0);
