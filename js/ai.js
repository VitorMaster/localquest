/* Localquest — geração de questões: prompt para copiar, importação de JSON e geração direta via API Claude (opcional). */
(function () {
  const Q = window.Q;
  const Ai = (Q.Ai = {});

  const RULES = `REGRAS (obrigatórias):
1. Use SOMENTE o conteúdo que está nos slides abaixo. Não invente fatos, valores ou conceitos que não estejam neles.
2. Questões de múltipla escolha com EXATAMENTE 4 alternativas e UMA correta.
3. ANTI-CHUTE: as 4 alternativas devem ter tamanho parecido. A correta NÃO pode ser sistematicamente a maior (em cerca de metade das questões ela deve ser menor ou igual às demais). Nada de "todas as anteriores", "nenhuma das anteriores", "ambas" nem termos absolutos só nas erradas (sempre/nunca/apenas).
4. Distratores plausíveis: erros comuns, conceitos vizinhos do mesmo slide ou de slides próximos, valores trocados. Nada absurdo.
5. Cada questão cita o(s) slide(s) de origem em "slides". Varie o nível: 1 (lembrar), 2 (compreender), 3 (aplicar/caso clínico curto).
6. Use figura com MODERAÇÃO: em no máximo ~15% das questões, e só quando a imagem for indispensável ao aprendizado (interpretar gráfico, esquema, anatomia, sequência visual). Se a questão puder ser respondida só pelo texto, use null. Quando indispensável, use "usa_imagem_do_slide": <nº do slide> e escreva o enunciado remetendo à figura ("Observe a figura…"). Caso contrário, use null. Nunca peça figura que não exista.
7. Inclua "explicacao" curta dizendo por que a correta está certa e, se útil, por que uma errada tenta enganar.
8. A letra da correta pode ser qualquer uma (o aplicativo embaralha depois).`;

  const FORMAT = `FORMATO DE SAÍDA — responda APENAS com JSON válido (sem comentários), uma lista:
[
  {
    "slides": [3],
    "enunciado": "…",
    "alternativas": ["texto A", "texto B", "texto C", "texto D"],
    "correta": "B",
    "explicacao": "…",
    "usa_imagem_do_slide": null,
    "dificuldade": 2
  }
]`;

  const slideBlock = (t) => {
    const imgs = t.images.filter((i) => i.kind === 'fig');
    const hasPage = t.images.some((i) => i.kind === 'page');
    let s = `### Slide ${t.n} — ${t.title}\n${t.text || '(sem texto)'}`;
    if (imgs.length) s += `\n[Contém ${imgs.length} figura(s)${imgs.map((i) => (i.alt ? ` — "${i.alt}"` : '')).join('')}]`;
    if (hasPage) s += '\n[A página inteira está disponível como imagem]';
    return s;
  };

  /** Prompt completo para colar em qualquer IA (ou para anexar junto com o arquivo). */
  Ai.buildPrompt = (material, opts = {}) => {
    const topics = Q.Engine.activeTopics(material).filter((t) => (opts.only ? opts.only.includes(t.id) : true));
    const per = opts.perSlide || 2;
    return `Você é um elaborador de questões de prova. Crie questões de múltipla escolha a partir dos slides da aula "${material.title}" (${material.materia} — ${material.periodo} — ${material.curso}).
Gere cerca de ${per} questão(ões) por slide que tenha conteúdo cobrável (ao todo ~${topics.length * per}).

${RULES}

${FORMAT}

=== SLIDES ===
${topics.map(slideBlock).join('\n\n')}`;
  };

  /* ---------- importação ---------- */
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
  const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();

  /** Converte o JSON (de qualquer IA) em questões do banco. */
  Ai.importQuestions = (material, text, origin = 'import') => {
    let data;
    try {
      data = parseLoose(text);
    } catch (e) {
      throw new Error('Não consegui ler o JSON. Confira se copiou a resposta inteira da IA.');
    }
    if (!Array.isArray(data)) data = data.questoes || data.questions || data.items || [];
    const existing = new Set(Q.Store.questionsOf(material.id).map((q) => norm(q.stem)));
    const out = { added: [], rejected: [] };
    data.forEach((it, idx) => {
      const stem = String(it.enunciado || it.stem || it.pergunta || '').trim();
      let opts = it.alternativas || it.options || it.opcoes || [];
      if (opts && !Array.isArray(opts)) opts = Object.values(opts);
      opts = opts.map(stripLabel);
      if (!stem || opts.length !== 4 || opts.some((o) => !o)) return out.rejected.push({ i: idx + 1, why: 'precisa de enunciado e exatamente 4 alternativas' });
      let c = it.correta != null ? it.correta : it.correct != null ? it.correct : it.resposta;
      let correct = -1;
      if (typeof c === 'string') {
        const L = c.trim().toUpperCase().replace(/[^A-D]/g, '');
        if (L.length === 1 && c.trim().length <= 3) correct = 'ABCD'.indexOf(L);
        else correct = opts.findIndex((o) => norm(o) === norm(stripLabel(c)));
      } else if (typeof c === 'number') correct = c >= 1 && c <= 4 ? c - 1 : -1;
      if (correct < 0) return out.rejected.push({ i: idx + 1, why: 'não identifiquei qual é a correta' });
      if (existing.has(norm(stem))) return out.rejected.push({ i: idx + 1, why: 'enunciado repetido' });

      const nums = [].concat(it.slides != null ? it.slides : it.slide != null ? it.slide : []).map(Number).filter(Boolean);
      const topicIds = nums.map((n) => material.topics.find((t) => t.n === n)).filter(Boolean).map((t) => t.id);
      let imageIds = [];
      const ui = it.usa_imagem_do_slide != null ? it.usa_imagem_do_slide : it.imagem_slide;
      if (ui) {
        const tp = material.topics.find((t) => t.n === Number(ui));
        if (tp) imageIds = tp.images.map((i) => i.id);
      }
      const q = {
        id: Q.uid('q'), materialId: material.id, topicIds, stem, options: opts, correct,
        explanation: String(it.explicacao || it.explanation || '').trim(), imageIds,
        difficulty: Q.clamp(parseInt(it.dificuldade || it.difficulty || 2, 10) || 2, 1, 3),
        fixedOrder: false, origin, createdAt: Date.now(),
      };
      existing.add(norm(stem));
      Q.Store.state.questions.push(q);
      out.added.push(q);
    });
    Q.Store.save();
    out.flagged = out.added.filter((q) => Q.Guard.lint(q).some((i) => i.level === 'bad')).length;
    return out;
  };

  /* ---------- geração direta (opcional, requer chave de API) ---------- */
  const downscale = async (id, max = 1000) => {
    const blob = await Q.Store.getImageBlob(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = url;
      });
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.8).split(',')[1];
    } catch (e) {
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  Ai.hasKey = () => !!Q.Store.state.settings.apiKey;

  Ai.generate = async (material, opts = {}) => {
    const st = Q.Store.state.settings;
    if (!st.apiKey) throw new Error('Cadastre sua chave de API em Ajustes.');
    const topics = Q.Engine.activeTopics(material).filter((t) => t.text.length >= 30 || t.images.length);
    const batches = [];
    for (let i = 0; i < topics.length; i += 4) batches.push(topics.slice(i, i + 4));
    const total = { added: 0, rejected: 0, flagged: 0 };
    for (let b = 0; b < batches.length; b++) {
      opts.onProgress && opts.onProgress(b / batches.length, `Gerando lote ${b + 1} de ${batches.length}…`);
      const batch = batches[b];
      const content = [];
      for (const t of batch) {
        const first = t.images[0];
        if (first) {
          const data = await downscale(first.id);
          if (data) {
            content.push({ type: 'text', text: `Imagem do slide ${t.n}:` });
            content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } });
          }
        }
      }
      content.push({ type: 'text', text: Ai.buildPrompt(material, { only: batch.map((t) => t.id), perSlide: opts.perSlide || 2 }) });
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': st.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model: st.model || 'claude-sonnet-5-5', max_tokens: 6000, messages: [{ role: 'user', content }] }),
      });
      if (!res.ok) {
        let msg = res.status + '';
        try { msg = (await res.json()).error.message; } catch (_) {}
        throw new Error('API: ' + msg);
      }
      const j = await res.json();
      const text = (j.content || []).map((c) => c.text || '').join('');
      const r = Ai.importQuestions(material, text, 'ai');
      total.added += r.added.length;
      total.rejected += r.rejected.length;
      total.flagged += r.flagged;
    }
    opts.onProgress && opts.onProgress(1, 'Concluído');
    return total;
  };
})();
