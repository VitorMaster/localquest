/* Localquest — elaboração de questões por IA.
 * A IA LÊ os slides, entende o assunto e escreve questões de prova (conceituais, de aplicação e casos clínicos).
 * Regras: fatos, resposta correta e justificativas vêm SÓ dos slides; o banco médico de apoio só inspira alternativas erradas.
 * Três caminhos: Claude pela conta de quem abre o link do claude.ai (sample), API própria (chave) ou o chat do usuário (copiar/colar). */
(function () {
  const Q = window.Q;
  const Ai = (Q.Ai = {});

  const LEVEL_TXT = {
    1: 'FÁCIL (compreensão): conceito, definição, identificação ou comparação direta de ideias dos slides; enunciado curto; alternativas claramente distintas entre si.',
    2: 'MÉDIO (aplicação): situação-problema curta, relação de causa e efeito ou interpretação de uma informação dos slides; alternativas plausíveis.',
    3: 'DIFÍCIL (análise): caso clínico ou cenário integrado que combina 2 ou mais ideias dos slides e exige raciocínio e decisão; alternativas muito plausíveis, com diferença sutil.',
  };
  const LEVEL_NAME = { 1: 'fácil', 2: 'médio', 3: 'difícil' };

  /* ---------- plano: quantas questões de cada nível e em que slides focar ---------- */
  Ai.levelPlan = (n, levels) => {
    const lv = levels && levels.length ? levels : [1, 2, 3];
    return Q.shuffle(Array.from({ length: n }, (_, i) => lv[i % lv.length]));
  };
  const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
  const toks = (s) => new Set((norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]{4,}/g) || []));
  const jac = (a, b) => { let i = 0; a.forEach((w) => b.has(w) && i++); return i / Math.max(1, a.size + b.size - i); };

  /* ---------- o pedido (prompt) ---------- */
  Ai.buildExamPrompt = (material, o = {}) => {
    const topics = Q.Engine.activeTopics(material).filter((t) => (t.text || '').trim().length >= 15);
    const n = Q.clamp(Math.round(o.n || 10), 1, 50);
    const plan = o.plan || Ai.levelPlan(n, o.levels);
    const counts = [1, 2, 3].map((l) => plan.filter((x) => x === l).length);
    const focus = (o.focus || []).map((id) => topics.find((t) => t.id === id)).filter(Boolean).map((t) => t.n);
    const avoid = (o.avoid || []).slice(-60).map((s) => '- ' + String(s).slice(0, 140)).join('\n');
    const sup = Q.Med ? Q.Med.supportText(material.materia) : '';
    let budget = 170000;
    const slides = topics.map((t) => {
      const body = `### Slide ${t.n} — ${t.title}\n${String(t.text).slice(0, 1800)}`;
      budget -= body.length;
      return budget > 0 ? body : '';
    }).filter(Boolean).join('\n\n');
    return `Você é professor e elaborador de provas de ${material.materia || 'medicina'} (${[material.periodo, material.curso].filter(Boolean).join(' — ')}). Leia os slides da aula "${material.title}", entenda do que se trata e elabore EXATAMENTE ${n} questões de múltipla escolha que poderiam ser cobradas na prova dessa aula.

QUANTIDADE E NÍVEL
${[1, 2, 3].filter((l, i) => counts[i]).map((l) => `- ${counts[l - 1]} questão(ões) de nível ${LEVEL_TXT[l]}`).join('\n')}

REGRAS (obrigatórias)
1. FONTE ÚNICA: todo fato, critério, valor, conduta ou classificação que sustenta a alternativa CORRETA e as justificativas deve estar nos slides abaixo. Não traga dados de outras fontes. Se os slides não bastam para ${n} questões sem repetir, devolva menos.
2. Escreva como uma prova de verdade: enunciado autossuficiente (contexto, caso ou pergunta clara), em português. É PROIBIDO escrever "segundo o slide", "conforme o material", "de acordo com a aula" ou qualquer referência aos slides no enunciado ou nas alternativas.
3. Questão ≠ cópia de frase: transforme o conteúdo em raciocínio (aplicar, comparar, decidir, interpretar, prever consequência), conforme o nível. Evite perguntar apenas "o que o slide diz".
4. Exatamente 4 alternativas (A–D) e UMA correta. As erradas devem ser plausíveis, do mesmo campo e inequivocamente erradas à luz dos slides (nenhuma pode estar também correta). Pode usar a terminologia comum da área apenas para montar alternativas ERRADAS.
5. Anti-chute: alternativas de tamanho parecido; a correta NÃO pode ser sistematicamente a mais longa; sem "todas as anteriores", "nenhuma das anteriores" ou "ambas"; evite termos absolutos (sempre, nunca, apenas) só nas erradas; varie a letra da correta.
6. Cobertura: espalhe as questões por vários slides${focus.length ? `; nesta etapa PRIORIZE os slides ${focus.join(', ')}` : ''}. Não faça duas questões sobre o mesmo fato.
7. "explicacao": por que a correta está certa, apoiada no que o slide afirma (cite o nº do slide, ex.: "No slide 4, …"). "justificativas": para CADA alternativa errada (chave = letra), por que ela não é a correta, com base nos slides; se o slide não trata do ponto, diga que o material não sustenta aquela afirmação e explique o que o slide indica no lugar.
8. Não crie questões que dependam de imagem.
${avoid ? `\nNÃO REPITA nem reformule estas questões já existentes:\n${avoid}\n` : ''}${sup ? `\nAPOIO PARA ALTERNATIVAS ERRADAS (ideias do campo; nunca como fonte da resposta correta):\n${sup}\n` : ''}
FORMATO — responda APENAS com um JSON válido (lista), sem comentários:
[
  {
    "nivel": 2,
    "slides": [3, 4],
    "conceito": "tema curto da questão",
    "enunciado": "…",
    "alternativas": ["…", "…", "…", "…"],
    "correta": "C",
    "explicacao": "No slide 3, …",
    "justificativas": { "A": "…", "B": "…", "D": "…" }
  }
]

=== SLIDES ===
${slides}`;
  };
  /** Compatibilidade com o passo "Prompt para IA" do perfil Criador. */
  Ai.buildPrompt = (material, opts = {}) => Ai.buildExamPrompt(material, { n: opts.n || 20, levels: opts.levels });

  /* ---------- leitura e validação da resposta ---------- */
  const parseLoose = (text) => {
    let t = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const a = t.indexOf('['), o = t.indexOf('{');
    const start = a === -1 ? o : o === -1 ? a : Math.min(a, o);
    if (start > 0) t = t.slice(start);
    const endA = t.lastIndexOf(']'), endO = t.lastIndexOf('}');
    t = t.slice(0, Math.max(endA, endO) + 1);
    return JSON.parse(t);
  };
  const stripLabel = (s) => String(s).replace(/^\s*(?:\(?[A-Da-d][\)\.\:\-–]\s+)/, '').trim();
  const META = /\b(segundo|conforme|de acordo com|no|do|pelo|pela)\s+(o\s+|a\s+)?(slide|material|aula|texto)\b/i;

  const inferTopic = (material, text) => {
    const qt = toks(text);
    let best = null;
    Q.Engine.activeTopics(material).forEach((t) => {
      const s = jac(qt, toks(t.title + ' ' + t.text));
      if (!best || s > best.s) best = { t, s };
    });
    return best && best.s > 0.02 ? best.t : null;
  };

  /** Converte a resposta da IA (texto, lista ou {questoes}) em questões do banco. */
  Ai.importQuestions = (material, input, origin = 'import', opts = {}) => {
    let data = input;
    if (typeof input === 'string') {
      try { data = parseLoose(input); } catch (e) { throw new Error('Não consegui ler a resposta. Copie a resposta inteira da IA (ela deve começar com "[").'); }
    }
    if (!Array.isArray(data)) data = (data && (data.questoes || data.questions || data.items)) || [];
    const existing = Q.Store.questionsOf(material.id);
    const seen = existing.map((q) => toks(q.stem));
    const out = { added: [], rejected: [] };
    data.forEach((it, idx) => {
      if (opts.max && out.added.length >= opts.max) return;
      const stem = String(it.enunciado || it.stem || it.pergunta || '').trim();
      let opt = it.alternativas || it.options || it.opcoes || [];
      if (opt && !Array.isArray(opt)) opt = Object.values(opt);
      opt = opt.map(stripLabel);
      const why = (r) => out.rejected.push({ i: idx + 1, why: r });
      if (!stem || opt.length !== 4 || opt.some((o) => !o)) return why('precisa de enunciado e exatamente 4 alternativas');
      if (new Set(opt.map(norm)).size < 4) return why('alternativas repetidas');
      let c = it.correta != null ? it.correta : it.correct != null ? it.correct : it.resposta;
      let correct = -1;
      if (typeof c === 'string') {
        const L = c.trim().toUpperCase().replace(/[^A-D]/g, '');
        if (L.length === 1 && c.trim().length <= 3) correct = 'ABCD'.indexOf(L);
        else correct = opt.findIndex((o) => norm(o) === norm(stripLabel(c)));
      } else if (typeof c === 'number') correct = c >= 1 && c <= 4 ? c - 1 : -1;
      if (correct < 0) return why('não identifiquei qual é a correta');
      const st = toks(stem);
      if (seen.some((s) => jac(s, st) >= 0.7)) return why('repetida (muito parecida com outra questão)');
      const nums = [].concat(it.slides != null ? it.slides : it.slide != null ? it.slide : []).map(Number).filter(Boolean);
      let topics = nums.map((n) => material.topics.find((t) => t.n === n)).filter(Boolean);
      if (!topics.length) { const g = inferTopic(material, stem + ' ' + opt[correct]); if (g) topics = [g]; }
      const jw = it.justificativas || it.whyNot || it.justificativa || null;
      let whyNot = ['', '', '', ''];
      if (Array.isArray(jw)) whyNot = [0, 1, 2, 3].map((i) => (i === correct ? '' : String(jw[i] || '')));
      else if (jw && typeof jw === 'object') whyNot = [0, 1, 2, 3].map((i) => (i === correct ? '' : String(jw['ABCD'[i]] || jw['abcd'[i]] || '')));
      const lvl = Q.clamp(parseInt(it.nivel || it.dificuldade || it.difficulty || opts.level || 2, 10) || 2, 1, 3);
      const q = {
        id: Q.uid('q'), materialId: material.id, topicIds: topics.map((t) => t.id), stem, options: opt, correct,
        explanation: String(it.explicacao || it.explanation || '').trim(), whyNot, imageIds: [], difficulty: lvl,
        concept: String(it.conceito || '').trim(), fixedOrder: false, origin, createdAt: Date.now(),
      };
      seen.push(st);
      Q.Store.state.questions.push(q);
      out.added.push(q);
    });
    Q.Store.save();
    out.flagged = out.added.filter((q) => Q.Guard.lint(q).some((i) => i.level === 'bad')).length;
    out.meta = out.added.filter((q) => META.test(q.stem)).length;
    return out;
  };

  /* ---------- provedores ---------- */
  Ai.hasKey = () => !!Q.Store.state.settings.apiKey;
  const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
  /** Quais caminhos automáticos existem agora. */
  Ai.providers = async () => {
    let sample = null;
    try { if (window.claude && window.claude.use) sample = await withTimeout(window.claude.use('sample'), 2500); } catch (_) {}
    return { sample: !!sample, api: Ai.hasKey() };
  };

  const callSample = async (prompt, signal) => {
    const s = await window.claude.use('sample');
    if (!s || !s.json) throw { code: 'capability_removed' };
    return s.json(prompt, { modelTier: 'default', cache: false, signal });
  };
  const callApi = async (prompt, signal) => {
    const st = Q.Store.state.settings;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', 'x-api-key': st.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: st.model || 'claude-sonnet-5-5', max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) { let m = String(res.status); try { m = (await res.json()).error.message; } catch (_) {} throw { code: 'api', message: m }; }
    const j = await res.json();
    return (j.content || []).map((c) => c.text || '').join('');
  };

  Ai.errorText = (e) => {
    const c = e && e.code;
    if (c === 'cancelled') return 'Cancelado.';
    if (c === 'not_granted') return 'Você não autorizou o uso do Claude nesta página. Use “Meu chat de IA (grátis)” ou autorize quando o pedido aparecer.';
    if (c === 'rate_limited') return 'Limite de uso do Claude atingido por agora. Tente mais tarde ou use “Meu chat de IA (grátis)”.';
    if (c === 'sampling_disabled' || c === 'not_declared' || c === 'capability_disabled' || c === 'capability_removed') return 'O Claude não está disponível nesta página. Use “Meu chat de IA (grátis)”.';
    if (c === 'invalid_json') return 'A IA respondeu fora do formato. Tente criar de novo (um lote menor ajuda).';
    if (c === 'session_expired') return 'Sua sessão expirou. Entre novamente e tente de novo.';
    if (c === 'api') return 'A API recusou: ' + (e.message || '');
    return (e && e.message) || 'Não consegui falar com a IA agora. Tente de novo ou use “Meu chat de IA (grátis)”.';
  };

  /**
   * Cria até n questões lendo os slides com IA (lotes de 10, sem repetir).
   * provider: 'sample' | 'api'. Retorna { created, requested, rejected, flagged }.
   */
  Ai.generateExam = async (material, o) => {
    const n = Q.clamp(Math.round(o.n || 10), 1, 50);
    const plan = Ai.levelPlan(n, o.levels);
    const topics = Q.Engine.activeTopics(material).filter((t) => (t.text || '').trim().length >= 15);
    if (!topics.length) throw new Error('Este material não tem texto nos slides para elaborar questões.');
    const call = o.provider === 'api' ? callApi : callSample;
    const BATCH = 10;
    const batches = Math.ceil(n / BATCH);
    const total = { created: 0, requested: n, rejected: [], flagged: 0 };
    const perFocus = Math.max(3, Math.ceil(topics.length / batches));
    let guard = 0;
    for (let b = 0; total.created < n && guard < batches + 2; b++, guard++) {
      if (o.signal && o.signal.aborted) throw { code: 'cancelled' };
      const need = Math.min(BATCH, n - total.created);
      o.onProgress && o.onProgress(total.created / n, `Lendo os slides e elaborando questões… (${total.created} de ${n})`);
      const focus = Array.from({ length: Math.min(perFocus, topics.length) }, (_, i) => topics[(b * perFocus + i) % topics.length].id);
      const levelsNow = plan.slice(total.created, total.created + need);
      const prompt = Ai.buildExamPrompt(material, { n: need, plan: levelsNow, focus, avoid: Q.Store.questionsOf(material.id).map((q) => q.stem) });
      const raw = await call(prompt, o.signal);
      const r = Ai.importQuestions(material, raw, 'ai', { max: need });
      total.created += r.added.length;
      total.rejected.push(...r.rejected);
      total.flagged += r.flagged;
      if (!r.added.length && b >= batches) break; // a IA não consegue mais variar
    }
    o.onProgress && o.onProgress(1, 'Concluído');
    return total;
  };

  /* ---------- caminho "meu chat de IA" (copiar e colar), em partes de até 12 ---------- */
  Ai.chatParts = (material, n, levels) => {
    const plan = Ai.levelPlan(Q.clamp(n, 1, 50), levels);
    const topics = Q.Engine.activeTopics(material).filter((t) => (t.text || '').trim().length >= 15);
    const K = Math.ceil(plan.length / 12);
    const per = Math.max(3, Math.ceil(topics.length / K));
    return Array.from({ length: K }, (_, i) => {
      const lv = plan.slice(i * 12, i * 12 + 12);
      const focus = Array.from({ length: Math.min(per, topics.length) }, (_, j) => topics[(i * per + j) % topics.length].id);
      return { i: i + 1, k: K, n: lv.length, plan: lv, focus };
    });
  };
  Ai.chatPrompt = (material, part) => Ai.buildExamPrompt(material, { n: part.n, plan: part.plan, focus: part.focus, avoid: Q.Store.questionsOf(material.id).map((q) => q.stem) });
})();
