/* Localquest — Escudo anti-chute.
 *  1. Lint de questões: detecta pistas (alternativa certa maior, "todas as anteriores", absolutos…).
 *  2. Gabarito controlado: distribui as letras certas sem sequências suspeitas (AAA, ABC, ABAB…).
 *  3. Detecção de comportamento: respostas rápidas demais e padrões de marcação.
 */
(function () {
  const Q = window.Q;
  const G = (Q.Guard = {});

  /* ================= 1. LINT ================= */
  const ALL_ABOVE = /(todas|nenhuma|ambas)\s+(as|das)?\s*(anteriores|alternativas|acima|opç[õo]es)|todas\s+est[ãa]o\s+corretas|n[ãa]o\s+sei|\bnda\b/i;
  const ABSOLUTE = /\b(sempre|nunca|jamais|somente|apenas|exclusivamente|todos|nenhum|todas|nenhuma|unicamente)\b/i;

  const len = (s) => String(s || '').trim().length;
  const keyWords = (s) =>
    new Set(
      String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .match(/[a-z]{5,}/g) || []
    );

  /** Retorna a razão entre a alternativa certa e a maior alternativa errada. */
  G.lengthRatio = (q) => {
    const L = q.options.map(len);
    const others = L.filter((_, i) => i !== q.correct);
    return L[q.correct] / Math.max(1, Math.max(...others));
  };

  /** A certa é a mais longa (por ≥10%)? Usado para balancear provas. */
  G.isLengthBiased = (q) => G.lengthRatio(q) >= 1.1;

  G.lint = (q) => {
    const issues = [];
    const push = (level, code, msg) => issues.push({ level, code, msg });
    const opts = q.options || [];
    if (opts.length !== 4 || opts.some((o) => !len(o))) {
      push('bad', 'opcoes', 'São necessárias exatamente 4 alternativas preenchidas.');
      return issues;
    }
    if (len(q.stem) < 15) push('bad', 'enunciado', 'Enunciado muito curto.');
    if (new Set(opts.map((o) => o.trim().toLowerCase())).size < 4)
      push('bad', 'duplicada', 'Há alternativas repetidas.');
    if (opts.some((o) => ALL_ABOVE.test(o)))
      push('bad', 'todas', 'Evite "todas/nenhuma das anteriores": permite acertar por eliminação e quebra o embaralhamento.');

    const ratio = G.lengthRatio(q);
    if (ratio >= 1.3)
      push('bad', 'maior', `A alternativa certa é ${Math.round((ratio - 1) * 100)}% maior que a maior errada — vira pista.`);
    else if (ratio >= 1.1)
      push('warn', 'maior', 'A alternativa certa é a mais longa. Equilibre o tamanho das alternativas.');
    const L = opts.map(len);
    const minOther = Math.min(...L.filter((_, i) => i !== q.correct));
    if (L[q.correct] < 0.6 * minOther)
      push('warn', 'menor', 'A alternativa certa é bem menor que as outras — destoa e vira pista.');

    const abs = opts.map((o, i) => (i !== q.correct && ABSOLUTE.test(o) ? 1 : 0)).reduce((a, b) => a + b, 0);
    if (abs >= 2 && !ABSOLUTE.test(opts[q.correct]))
      push('warn', 'absolutos', 'Várias erradas usam termos absolutos (sempre/nunca/apenas); a certa não.');

    const stemW = keyWords(q.stem);
    const ov = opts.map((o) => [...keyWords(o)].filter((w) => stemW.has(w)).length);
    const maxOther = Math.max(...ov.filter((_, i) => i !== q.correct));
    if (ov[q.correct] >= 2 && ov[q.correct] > maxOther)
      push('warn', 'eco', 'A certa repete termos do enunciado que as outras não repetem.');

    if (q.origin !== 'auto' && /\b(segundo|conforme|de acordo com|no|do|pelo|pela)\s+(o\s+|a\s+)?(slide|material|aula|texto)\b/i.test(q.stem)) push('warn', 'meta', 'O enunciado cita “slide/material”: numa prova real isso não aparece.');
    if (!(q.topicIds || []).length) push('warn', 'slide', 'Vincule a questão a pelo menos um slide (necessário para o mapa de cobertura).');
    return issues;
  };

  G.worstLevel = (issues) => (issues.some((i) => i.level === 'bad') ? 'bad' : issues.length ? 'warn' : 'ok');

  /* ================= 2. GABARITO CONTROLADO ================= */
  /**
   * Gera as posições (0..3) das respostas certas para n questões.
   * Regras: no máx. `maxRun` letras iguais seguidas; sem escadas (ABC / DCB);
   * sem alternância (ABAB); distribuição equilibrada entre as letras.
   * `fixed[i]` (opcional) força a posição de questões com ordem fixa.
   */
  G.makeKey = (n, fixed = [], maxRun = 2, rnd = Math.random) => {
    const levels = [
      { run: maxRun, mono: true, alt: true, cap: true },
      { run: maxRun, mono: true, alt: false, cap: true },
      { run: maxRun, mono: false, alt: false, cap: true },
      { run: maxRun + 1, mono: false, alt: false, cap: false },
    ];
    const baseCap = Math.ceil(n / 4) + (n >= 12 ? 1 : 0);
    for (const lv of levels) {
      const seq = [];
      const count = [0, 0, 0, 0];
      let steps = 0;
      const ok = (c, i) => {
        if (fixed[i] != null) return c === fixed[i];
        const k = lv.run;
        if (i >= k && seq.slice(i - k, i).every((x) => x === c)) return false;
        if (lv.mono && i >= 2) {
          const a = seq[i - 2], b = seq[i - 1];
          if ((b - a === 1 && c - b === 1) || (b - a === -1 && c - b === -1)) return false;
        }
        if (lv.alt && i >= 3) {
          const x = seq[i - 3], y = seq[i - 2];
          if (x !== y && seq[i - 1] === x && c === y) return false;
        }
        if (lv.cap && count[c] >= baseCap) return false;
        return true;
      };
      const dfs = (i) => {
        if (i === n) return true;
        if (++steps > 20000) return false;
        const cands = [0, 1, 2, 3].sort((a, b) => count[a] - count[b] + (rnd() - 0.5) * 1.6);
        for (const c of cands) {
          if (!ok(c, i)) continue;
          seq.push(c);
          count[c]++;
          if (dfs(i + 1)) return true;
          seq.pop();
          count[c]--;
        }
        return false;
      };
      if (dfs(0)) return seq;
    }
    return Array.from({ length: n }, (_, i) => (fixed[i] != null ? fixed[i] : Math.floor(rnd() * 4)));
  };

  /** Métricas de um gabarito (letras ou índices) — usado no painel de integridade e nos testes. */
  G.analyzeKey = (key) => {
    const k = key.map((x) => (typeof x === 'string' ? x.charCodeAt(0) - 65 : x));
    let maxRun = 1, run = 1, stairs = 0, alts = 0;
    for (let i = 1; i < k.length; i++) {
      run = k[i] === k[i - 1] ? run + 1 : 1;
      maxRun = Math.max(maxRun, run);
    }
    for (let i = 2; i < k.length; i++) {
      const a = k[i - 2], b = k[i - 1], c = k[i];
      if ((b - a === 1 && c - b === 1) || (b - a === -1 && c - b === -1)) stairs++;
    }
    for (let i = 3; i < k.length; i++) {
      if (k[i - 3] !== k[i - 2] && k[i - 1] === k[i - 3] && k[i] === k[i - 2]) alts++;
    }
    const counts = [0, 1, 2, 3].map((l) => k.filter((x) => x === l).length);
    return { maxRun, stairs, alts, counts };
  };

  /** Posiciona a alternativa certa em `pos` e embaralha o resto. Retorna order[posição] = índice original. */
  G.arrange = (q, pos, rnd = Math.random) => {
    if (q.fixedOrder) return [0, 1, 2, 3];
    const others = Q.shuffle([0, 1, 2, 3].filter((i) => i !== q.correct), rnd);
    others.splice(pos, 0, q.correct);
    return others;
  };

  /* ================= 3. COMPORTAMENTO ================= */
  /** Tempo mínimo plausível (ms) para ler e decidir com consciência. */
  G.minReadMs = (q) => {
    const w = Q.words(q.stem) + (q.options || []).reduce((s, o) => s + Q.words(o), 0);
    return Math.max(2000, w * 80);
  };
  G.tooFast = (ms, q) => ms < G.minReadMs(q);

  /**
   * Recebe as letras marcadas (0..3, na ordem das questões) e devolve um Set de índices suspeitos:
   *  - 4+ letras iguais seguidas
   *  - 5+ respostas seguindo escada (ABCDA…) ou alternância (ABABA…)
   */
  G.patternSuspects = (letters) => {
    const sus = new Set();
    const n = letters.length;
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && letters[j + 1] === letters[i]) j++;
      if (j - i + 1 >= 4) for (let k = i; k <= j; k++) sus.add(k);
      i = j + 1;
    }
    for (let s = 0; s + 5 <= n; s++) {
      const w = letters.slice(s, s + 5);
      const step = (w[1] - w[0] + 4) % 4;
      const stair = step !== 0 && w.every((x, k) => k === 0 || (x - w[k - 1] + 4) % 4 === step);
      const alt = w[0] !== w[1] && w.every((x, k) => x === w[k % 2]);
      if (stair || alt) for (let k = s; k < s + 5; k++) sus.add(s + (k - s));
    }
    return sus;
  };

  /** Streak atual de mesma letra no fim (para alerta em tempo real). */
  G.tailRun = (letters) => {
    let r = 0;
    for (let i = letters.length - 1; i >= 0 && letters[i] === letters[letters.length - 1]; i--) r++;
    return r;
  };
})();
