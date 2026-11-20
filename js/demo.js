/* Atlas — material de demonstração (ilustrativo; NÃO é fonte de estudo). */
(function () {
  const Q = window.Q;
  const D = (Q.Demo = {});

  const wrap = (w, h, inner) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Helvetica, Arial, sans-serif">` +
    `<rect width="${w}" height="${h}" rx="14" fill="#ffffff"/>${inner}</svg>`;
  const T = (x, y, s, o = {}) =>
    `<text x="${x}" y="${y}" font-size="${o.size || 13}" fill="${o.fill || '#1f2937'}" text-anchor="${o.anchor || 'middle'}" font-weight="${o.weight || 400}">${s}</text>`;

  /* ---- imagens ---- */
  const pyramid = () => {
    const a = [112, 106, 98, 88, 74, 58, 42, 28, 14];
    const b = [58, 60, 64, 70, 76, 78, 72, 60, 46];
    const panel = (cx, w, c1, c2, title) => {
      let s = T(cx, 28, title, { size: 15, weight: 700 });
      w.forEach((hw, i) => {
        const y = 290 - i * 28;
        const t = i / 8;
        s += `<rect x="${cx - hw}" y="${y - 24}" width="${hw * 2}" height="24" rx="4" fill="${t < 0.5 ? c1 : c2}" opacity="${0.55 + t * 0.45}"/>`;
      });
      return s;
    };
    return wrap(660, 345,
      panel(190, a, '#14b8a6', '#7c5cff', 'Brasil — 2000') +
      panel(490, b, '#14b8a6', '#7c5cff', 'Brasil — projeção 2050') +
      T(190, 316, '↑ mais idosos', { size: 11, fill: '#6b7280' }) +
      T(40, 288, 'jovens', { size: 11, fill: '#14b8a6', anchor: 'start', weight: 700 }) +
      T(40, 52, 'idosos (60+)', { size: 11, fill: '#7c5cff', anchor: 'start', weight: 700 }) +
      T(330, 338, 'Ilustração esquemática (valores fictícios). Cada barra = uma faixa etária; da base ao topo, do mais jovem ao mais idoso.', { size: 10, fill: '#6b7280' }));
  };

  const avd = () =>
    wrap(560, 300,
      `<polygon points="200,20 252,100 148,100" fill="#7c5cff" opacity=".9"/>` +
      `<polygon points="148,100 252,100 304,180 96,180" fill="#22d3ee" opacity=".85"/>` +
      `<polygon points="96,180 304,180 356,260 44,260" fill="#14b8a6" opacity=".85"/>` +
      T(200, 72, 'AVD avançadas', { fill: '#fff', weight: 700, size: 12 }) +
      T(200, 143, 'AVD instrumentais', { fill: '#0b1220', weight: 700 }) + T(200, 160, '(Lawton)', { fill: '#0b1220', size: 11 }) +
      T(200, 226, 'AVD básicas', { fill: '#fff', weight: 700 }) + T(200, 244, '(Katz)', { fill: '#fff', size: 11 }) +
      `<defs><marker id="ar" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#ef4444"/></marker></defs>` +
      `<line x1="430" y1="40" x2="430" y2="250" stroke="#ef4444" stroke-width="3" marker-end="url(#ar)"/>` +
      T(430, 28, 'Perda funcional: começa no topo…', { size: 11, fill: '#ef4444', weight: 700 }) +
      T(430, 272, '…e avança até a base', { size: 11, fill: '#ef4444', weight: 700 }));

  const tug = () => {
    const step = (x, y, n) => `<circle cx="${x}" cy="${y}" r="11" fill="#7c5cff"/>${T(x, y + 4, n, { fill: '#fff', weight: 700 })}`;
    return wrap(660, 250,
      `<line x1="30" y1="170" x2="630" y2="170" stroke="#9ca3af" stroke-width="2"/>` +
      // cadeira
      `<rect x="48" y="128" width="34" height="8" fill="#6b7280"/><rect x="48" y="96" width="8" height="40" fill="#6b7280"/><rect x="52" y="136" width="5" height="34" fill="#6b7280"/><rect x="76" y="136" width="5" height="34" fill="#6b7280"/>` +
      T(64, 192, 'cadeira', { size: 11, fill: '#6b7280' }) +
      // cone
      `<polygon points="560,170 580,170 570,125" fill="#f97316"/>` + T(570, 192, 'marco', { size: 11, fill: '#6b7280' }) +
      // distância
      `<line x1="100" y1="112" x2="560" y2="112" stroke="#111827" stroke-width="2"/><line x1="100" y1="104" x2="100" y2="120" stroke="#111827" stroke-width="2"/><line x1="560" y1="104" x2="560" y2="120" stroke="#111827" stroke-width="2"/>` +
      T(330, 100, '3 metros', { size: 15, weight: 700 }) +
      step(64, 70, '1') + T(64, 52, 'levantar', { size: 11 }) +
      step(240, 140, '2') + T(240, 160, 'caminhar', { size: 11 }) +
      step(570, 70, '3') + T(570, 52, 'girar', { size: 11 }) +
      step(420, 140, '4') + T(420, 160, 'voltar', { size: 11 }) +
      step(110, 140, '5') + T(110, 160, 'sentar', { size: 11 }) +
      T(330, 222, 'Cronometrar do sinal de “já” até o paciente sentar novamente', { size: 12, fill: '#374151' }) +
      T(330, 238, '≥ 12 s → risco aumentado de quedas (conforme o slide)', { size: 12, fill: '#ef4444', weight: 700 }));
  };

  const body = () => {
    const bar = (x, label, w, f, o) =>
      `<rect x="${x}" y="${250 - (w + f + o) * 2.2}" width="110" height="${(w + f + o) * 2.2}" fill="#e5e7eb" rx="6"/>` +
      `<rect x="${x}" y="${250 - w * 2.2}" width="110" height="${w * 2.2}" fill="#38bdf8" rx="6"/>` +
      `<rect x="${x}" y="${250 - (w + f) * 2.2}" width="110" height="${f * 2.2}" fill="#fbbf24"/>` +
      T(x + 55, 272, label, { weight: 700 });
    return wrap(520, 300,
      bar(70, 'Adulto jovem', 60, 20, 20) + bar(250, 'Idoso', 50, 30, 20) +
      `<rect x="400" y="80" width="14" height="14" fill="#38bdf8"/>` + T(420, 92, 'Água corporal total', { anchor: 'start', size: 12 }) + T(420, 108, '↓ com a idade', { anchor: 'start', size: 11, fill: '#0284c7', weight: 700 }) +
      `<rect x="400" y="130" width="14" height="14" fill="#fbbf24"/>` + T(420, 142, 'Gordura corporal', { anchor: 'start', size: 12 }) + T(420, 158, '↑ com a idade', { anchor: 'start', size: 11, fill: '#b45309', weight: 700 }) +
      `<rect x="400" y="180" width="14" height="14" fill="#e5e7eb"/>` + T(420, 192, 'Demais componentes', { anchor: 'start', size: 12 }) +
      T(260, 24, 'Composição corporal (valores ilustrativos)', { size: 13, weight: 700 }));
  };

  const cascade = () => {
    const box = (x, y, t1, t2, c) =>
      `<rect x="${x}" y="${y}" width="190" height="66" rx="12" fill="${c}" opacity=".95"/>` + T(x + 95, y + 28, t1, { fill: '#fff', weight: 700, size: 12 }) + T(x + 95, y + 46, t2, { fill: '#fff', size: 11 });
    const arr = `<defs><marker id="a2" markerWidth="9" markerHeight="9" refX="5" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="#374151"/></marker></defs>`;
    const ln = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#374151" stroke-width="2.5" marker-end="url(#a2)"/>`;
    return wrap(700, 290, arr +
      T(350, 26, 'Cascata de prescrição', { size: 15, weight: 700 }) +
      box(20, 48, 'Medicamento A', '(ex.: AINE)', '#7c5cff') + ln(212, 81, 248, 81) +
      box(250, 48, 'Efeito adverso', '(ex.: ↑ pressão arterial)', '#f97316') + ln(442, 81, 478, 81) +
      box(480, 48, 'Interpretado como', 'doença nova', '#ef4444') + ln(575, 116, 575, 150) +
      box(480, 152, 'Medicamento B', '(ex.: anti-hipertensivo)', '#14b8a6') + ln(478, 185, 444, 185) +
      box(250, 152, 'Novo efeito adverso', '(ex.: edema de tornozelos)', '#f97316') +
      `<path d="M345 150 C345 128 345 126 345 118" stroke="#374151" stroke-width="2.5" fill="none" stroke-dasharray="6 5" marker-end="url(#a2)"/>` +
      T(350, 250, 'O ciclo se repete: mais fármacos, mais efeitos, mais riscos.', { size: 12, fill: '#374151' }));
  };

  /* ---- conteúdo ---- */
  const M1 = {
    title: 'Envelhecimento e avaliação funcional', curso: 'Fisioterapia', periodo: '6º período', materia: 'Geriatria',
    slides: [
      { t: 'Geriatria: envelhecimento e avaliação funcional', x: 'Aula 1 · Prof. Exemplo', ign: true },
      { t: 'Transição demográfica', x: 'Queda da fecundidade + aumento da expectativa de vida\nA pirâmide etária perde a base larga e ganha topo mais largo\nNo Brasil, é considerada idosa a pessoa com 60 anos ou mais\nPaíses desenvolvidos usam 65 anos ou mais', img: 'pyramid' },
      { t: 'Senescência × senilidade', x: 'Senescência: alterações esperadas do envelhecimento normal\nSenilidade: alterações provocadas por doenças que acometem o idoso\nExemplos de senescência: cabelos grisalhos, pele menos elástica' },
      { t: 'Alterações fisiológicas do envelhecimento', x: 'Sarcopenia: perda progressiva de massa e força muscular\nRedução da densidade mineral óssea\nRedução da complacência arterial → aumento da pressão arterial sistólica\nRedução progressiva da taxa de filtração glomerular\nPresbiopia e presbiacusia' },
      { t: 'Avaliação funcional: AVDs', x: 'AVD básicas (Índice de Katz): banho, vestir-se, higiene, transferência, continência, alimentação\nAVD instrumentais (Escala de Lawton): telefone, compras, preparo de refeições, tarefas domésticas, transporte, medicações, finanças\nA perda funcional costuma começar pelas avançadas, depois instrumentais e por fim as básicas', img: 'avd' },
      { t: 'Timed Up and Go (TUG)', x: 'Levantar de uma cadeira, caminhar 3 metros, girar, voltar e sentar\nTempo cronometrado\n≥ 12 segundos: risco aumentado de quedas', img: 'tug' },
      { t: 'Síndromes geriátricas: os 5 Is', x: 'Imobilidade\nInstabilidade postural\nIncontinência\nInsuficiência cognitiva\nIatrogenia' },
      { t: 'Prevenção de quedas', x: 'Fatores intrínsecos: fraqueza muscular, alteração do equilíbrio, déficit visual, polifarmácia\nFatores extrínsecos: pisos escorregadios, tapetes soltos, má iluminação, ausência de barras de apoio\nIntervenções: treino de equilíbrio e força, revisão de medicamentos, adaptação do ambiente' },
    ],
    qs: [
      [[2], 'pyramid', 'Observe a figura. Qual transformação a projeção para 2050 representa na distribuição da população?', ['Estreitamento da base e alargamento do topo da pirâmide', 'Alargamento da base, com mais crianças na população', 'Manutenção do formato triangular, de base larga, em ambos os anos', 'Estreitamento do topo, com redução do número de idosos'], 0, 'A figura mostra base menor e topo maior: menos jovens e mais idosos, efeito da queda da fecundidade e do aumento da expectativa de vida.', 1],
      [[2], null, 'No Brasil, conforme o slide, é considerada idosa a pessoa com idade igual ou superior a:', ['55 anos', '60 anos', '65 anos', '70 anos'], 1, 'O limite de 65 anos é o usado em países desenvolvidos; no Brasil é 60 anos.', 1],
      [[2], null, 'Quais fatores demográficos o slide aponta como causa do envelhecimento populacional?', ['Aumento da natalidade e redução da expectativa de vida', 'Crescimento da fecundidade associado à imigração de idosos', 'Queda da fecundidade e aumento da expectativa de vida', 'Redução da mortalidade em adultos jovens, sem alteração da fecundidade'], 2, 'Menos nascimentos e vida mais longa deslocam o peso da população para as faixas etárias mais velhas.', 1],
      [[3], null, 'Uma idosa tem cabelos grisalhos e pele menos elástica, sem doença associada. Segundo o slide, esse quadro é:', ['Senilidade: alteração provocada por doença que acomete o idoso', 'Iatrogenia: alteração decorrente de tratamento médico', 'Síndrome geriátrica: condição que compromete a funcionalidade', 'Senescência: alteração esperada do envelhecimento normal'], 3, 'Mudanças esperadas, sem doença, são senescência.', 2],
      [[4], null, 'Qual alteração do envelhecimento explica o aumento da pressão arterial sistólica, segundo o slide?', ['Aumento progressivo da taxa de filtração glomerular', 'Hipertrofia generalizada da massa muscular esquelética', 'Redução da complacência (elasticidade) das artérias', 'Aumento da densidade mineral óssea nas vértebras'], 2, 'Artérias mais rígidas elevam a sistólica.', 2],
      [[4], null, 'O slide define sarcopenia como:', ['Redução da densidade mineral óssea, com fragilidade esquelética', 'Diminuição da acuidade visual para perto', 'Perda progressiva de massa e força muscular', 'Degeneração das cartilagens articulares'], 2, 'Sarcopenia é a perda de massa e força muscular; a perda óssea é osteopenia/osteoporose; a visão para perto é presbiopia.', 1],
      [[5], null, 'Preparar refeições, tomar as próprias medicações e controlar finanças são avaliados por qual instrumento?', ['Índice de Katz (AVD básicas)', 'Timed Up and Go (mobilidade e quedas)', 'Índice de Katz (AVD instrumentais)', 'Escala de Lawton (AVD instrumentais)'], 3, 'Lawton avalia AVD instrumentais; Katz avalia AVD básicas.', 2],
      [[5], 'avd', 'Observe a figura. Segundo o slide, em que ordem a perda funcional costuma se instalar?', ['Básicas, depois instrumentais e, por fim, avançadas', 'Avançadas, depois instrumentais e, por fim, básicas', 'Instrumentais, depois básicas e, por fim, avançadas', 'Avançadas e básicas juntas, depois as instrumentais'], 1, 'A perda segue do topo (avançadas) para a base (básicas).', 2],
      [[6], 'tug', 'Observe a figura. No Timed Up and Go, o paciente deve:', ['Permanecer sentado e levantar a perna alternadamente por 30 segundos', 'Levantar da cadeira, andar 3 metros, girar, voltar e sentar', 'Caminhar 10 metros em velocidade máxima e sentar no chão', 'Subir e descer um degrau repetidamente por um minuto'], 1, 'Sequência: levantar, caminhar 3 m, girar, voltar e sentar, cronometrando todo o percurso.', 1],
      [[6], null, 'Segundo o slide, qual tempo no TUG indica risco aumentado de quedas?', ['Inferior a 10 segundos para qualquer idoso', 'Igual ou superior a 12 segundos', 'Entre 3 e 5 segundos de execução total', 'Menor que 8 segundos com uso de apoio'], 1, 'O ponto de corte apresentado é ≥ 12 segundos.', 1],
      [[7], null, 'Qual das opções NÃO integra os 5 Is das síndromes geriátricas apresentados no slide?', ['Instabilidade postural', 'Insuficiência cognitiva', 'Isolamento social', 'Incontinência'], 2, 'Os 5 Is: imobilidade, instabilidade postural, incontinência, insuficiência cognitiva e iatrogenia.', 2],
      [[7], null, 'Um idoso acamado há semanas desenvolve contraturas e perda de força. Qual síndrome do slide está em primeiro plano?', ['Instabilidade postural', 'Incontinência', 'Imobilidade', 'Insuficiência cognitiva'], 2, 'A restrição ao leito caracteriza a imobilidade.', 3],
      [[8], null, 'Qual item é fator de risco EXTRÍNSECO para quedas, segundo o slide?', ['Fraqueza muscular de membros inferiores', 'Alteração do equilíbrio e da marcha', 'Uso de vários medicamentos (polifarmácia)', 'Tapetes soltos e má iluminação no domicílio'], 3, 'Fatores extrínsecos são do ambiente; os demais são intrínsecos.', 1],
      [[8], null, 'Quais intervenções de prevenção de quedas o slide recomenda?', ['Repouso prolongado no leito e restrição de caminhadas fora de casa', 'Treino de equilíbrio e força, revisão de fármacos e ambiente seguro', 'Contenção física rotineira para impedir que o idoso se levante sozinho', 'Redução da ingestão de líquidos para diminuir idas ao banheiro'], 1, 'Exercício, revisão de medicamentos e adaptação do ambiente são as medidas do slide.', 2],
    ],
  };

  const M2 = {
    title: 'Polifarmácia e segurança medicamentosa', curso: 'Fisioterapia', periodo: '4º período', materia: 'Farmacologia',
    slides: [
      { t: 'Farmacologia no idoso', x: 'Aula 3 · Prof. Exemplo', ign: true },
      { t: 'O que é polifarmácia', x: 'Polifarmácia: uso concomitante de 5 ou mais medicamentos\nPolifarmácia excessiva: 10 ou mais medicamentos\nAumenta o risco de interações, reações adversas e quedas' },
      { t: 'Farmacocinética no envelhecimento', x: 'Composição corporal: ↓ água corporal total e ↑ gordura corporal\nFármacos lipossolúveis: maior volume de distribuição e ação prolongada\nRedução do fluxo hepático → metabolismo mais lento\nRedução da filtração glomerular → risco de acúmulo de fármacos eliminados pelos rins', img: 'body' },
      { t: 'Critérios de Beers', x: 'Lista de medicamentos potencialmente inapropriados para idosos\nExemplos: benzodiazepínicos de longa ação, anti-histamínicos de 1ª geração\nUsados como guia, não como regra absoluta' },
      { t: 'Cascata de prescrição', x: 'Efeito adverso interpretado como doença nova\nÉ prescrito outro medicamento para tratá-lo\nExemplo: AINE → aumento da pressão arterial → anti-hipertensivo\nO ciclo gera novos efeitos adversos', img: 'cascade' },
      { t: 'Medicamentos e quedas', x: 'Maior risco: sedativos, anti-hipertensivos e diuréticos\nHipotensão ortostática: queda da PAS ≥ 20 mmHg ou da PAD ≥ 10 mmHg em até 3 minutos após ficar em pé' },
      { t: 'Estratégias de segurança', x: 'Start low, go slow: começar com dose baixa e aumentar lentamente\nDesprescrição: retirada planejada de medicamentos sem benefício claro\nReconciliação medicamentosa e caixa organizadora de comprimidos\nSimplificar esquemas terapêuticos' },
    ],
    qs: [
      [[2], null, 'Segundo o slide, polifarmácia é o uso concomitante de quantos medicamentos?', ['Dois ou mais', 'Três ou mais', 'Cinco ou mais', 'Dez ou mais'], 2, 'Cinco ou mais é polifarmácia; dez ou mais é polifarmácia excessiva.', 1],
      [[3], 'body', 'Observe a figura. A mudança da composição corporal no envelhecimento altera a distribuição dos fármacos porque:', ['A água corporal total aumenta e a gordura diminui', 'Tanto a água quanto a gordura diminuem de forma proporcional', 'A água corporal total diminui e a gordura aumenta', 'Ambas aumentam, elevando o volume de distribuição geral'], 2, 'Menos água e mais gordura mudam o volume de distribuição.', 2],
      [[3], null, 'Por que fármacos lipossolúveis tendem a agir por mais tempo no idoso?', ['A absorção intestinal fica muito acelerada nessa fase', 'A filtração glomerular fica mais intensa e retém o fármaco', 'O aumento da gordura corporal amplia seu volume de distribuição', 'A água corporal total maior dilui e prolonga a ação'], 2, 'Mais gordura = maior volume de distribuição para lipossolúveis.', 2],
      [[3], null, 'Qual a consequência da redução da filtração glomerular para fármacos de eliminação renal?', ['Eliminação mais rápida e menor duração do efeito', 'Aumento da absorção pelo trato gastrointestinal', 'Metabolização hepática acelerada, por compensação', 'Maior risco de acúmulo e de efeitos tóxicos'], 3, 'Menor depuração renal favorece o acúmulo.', 2],
      [[4], null, 'Os Critérios de Beers servem para:', ['Calcular a dose proporcional ao peso corporal do idoso', 'Listar medicamentos potencialmente inapropriados ao idoso', 'Classificar o grau de dependência funcional do idoso', 'Definir o esquema vacinal recomendado aos idosos'], 1, 'São uma lista de medicamentos potencialmente inapropriados na população idosa.', 1],
      [[4], null, 'Qual item o slide cita como exemplo de medicamento potencialmente inapropriado para idosos?', ['Paracetamol em dose terapêutica habitual', 'Vitamina D em dose de reposição', 'Cálcio em dose de suplementação diária', 'Benzodiazepínicos de longa ação'], 3, 'Benzodiazepínicos de longa ação e anti-histamínicos de 1ª geração são exemplos.', 2],
      [[5], 'cascade', 'Observe a figura. O que caracteriza uma cascata de prescrição?', ['Associação planejada de dois fármacos para potencializar o mesmo efeito', 'Suspensão progressiva de medicamentos até a menor dose possível', 'Efeito adverso tratado como doença nova com outro fármaco', 'Troca de um fármaco por outro de mesma classe por custo menor'], 2, 'O efeito adverso é confundido com doença nova e recebe outro medicamento.', 2],
      [[5], null, 'Um idoso usa AINE, desenvolve aumento da pressão arterial e passa a receber anti-hipertensivo. Esse é um exemplo de:', ['Desprescrição supervisionada', 'Reconciliação medicamentosa', 'Subdosagem terapêutica', 'Cascata de prescrição'], 3, 'AINE → ↑PA → anti-hipertensivo é o exemplo do slide.', 2],
      [[6], null, 'Hipotensão ortostática é definida, no slide, como queda de:', ['PAS ≥ 10 mmHg ou PAD ≥ 20 mmHg em até 3 minutos em pé', 'PAS ≥ 20 mmHg ou PAD ≥ 10 mmHg em até 3 minutos em pé', 'PAS ≥ 30 mmHg ou PAD ≥ 15 mmHg em até 3 minutos em pé', 'PAS ≥ 20 mmHg ou PAD ≥ 10 mmHg após 30 minutos deitado'], 1, 'Atenção às inversões entre PAS/PAD e ao tempo de 3 minutos em pé.', 3],
      [[6], null, 'Qual combinação de medicamentos o slide associa a maior risco de quedas?', ['Vitaminas, suplementos de cálcio e protetores gástricos', 'Antibióticos, antifúngicos e antivirais', 'Sedativos, anti-hipertensivos e diuréticos', 'Laxantes, antiácidos e vitaminas do complexo B'], 2, 'Sedação, hipotensão e depleção de volume favorecem quedas.', 1],
      [[7], null, '“Start low, go slow” significa, segundo o slide:', ['Iniciar com dose alta e reduzir conforme a resposta', 'Manter dose fixa e trocar a classe com frequência', 'Começar com dose baixa e aumentar lentamente', 'Suspender os fármacos e reintroduzi-los um a um'], 2, 'Dose inicial baixa e titulação lenta.', 1],
      [[7], null, 'A desprescrição consiste em:', ['Substituir medicamentos de marca por similares genéricos', 'Retirar, de forma planejada, medicamentos sem benefício claro', 'Associar fármacos para reduzir o número de comprimidos', 'Interromper o tratamento ao primeiro efeito adverso'], 1, 'É a retirada planejada e supervisionada de medicamentos sem benefício claro.', 2],
      [[7], null, 'Qual medida o slide recomenda para melhorar a adesão e reduzir erros no uso dos remédios?', ['Aumentar o número de tomadas diárias para distribuir a dose', 'Orientar o idoso a ajustar a dose por conta própria', 'Reconciliação medicamentosa e caixa organizadora de comprimidos', 'Guardar os remédios fora do alcance dos cuidadores'], 2, 'Reconciliação medicamentosa e organizadores de comprimidos reduzem erros e esquecimentos.', 1],
    ],
  };

  const SVG = { pyramid, avd, tug, body, cascade };

  const addMaterial = async (def) => {
    const topics = [];
    for (let i = 0; i < def.slides.length; i++) {
      const s = def.slides[i];
      const images = [];
      if (s.img) {
        const id = Q.uid('img');
        await Q.Store.putImage(id, new Blob([SVG[s.img]()], { type: 'image/svg+xml' }));
        images.push({ id, alt: s.img === 'pyramid' ? 'Pirâmide etária 2000 × 2050' : s.t, kind: 'fig', key: s.img });
      }
      topics.push({ id: Q.uid('tp'), n: i + 1, title: s.t, text: s.x, images, ignored: !!s.ign });
    }
    const m = { id: Q.uid('mat'), title: def.title, curso: def.curso, periodo: def.periodo, materia: def.materia, createdAt: Date.now(), source: 'demo', topics };
    Q.Store.state.materials.push(m);
    def.qs.forEach(([slides, img, stem, options, correct, explanation, difficulty]) => {
      const tp = slides.map((n) => topics.find((t) => t.n === n));
      const imageIds = img ? tp.flatMap((t) => t.images.filter((x) => x.key === img).map((x) => x.id)) : [];
      Q.Store.state.questions.push({
        id: Q.uid('q'), materialId: m.id, topicIds: tp.map((t) => t.id), stem, options, correct, explanation,
        imageIds, difficulty, fixedOrder: false, origin: 'demo', createdAt: Date.now(),
      });
    });
    return m;
  };

  D.defs = { M1, M2 };

  /** Carrega o exemplo. `history` gera 6 provas fictícias para ver os gráficos funcionando. */
  D.load = async ({ history = true } = {}) => {
    const mats = [await addMaterial(M1), await addMaterial(M2)];
    if (history) {
      const rnd = Q.seeded(7);
      const day = 86400000;
      const plan = [[26, 0.45, 'cobertura', [0]], [19, 0.52, 'cobertura', [1]], [12, 0.6, 'misto', [0, 1]], [7, 0.66, 'misto', [0, 1]], [3, 0.74, 'fraquezas', [0, 1]], [1, 0.8, 'misto', [0, 1]]];
      plan.forEach(([ago, p, strat, mi], k) => {
        const ses = Q.Engine.buildSession({ materialIds: mi.map((i) => mats[i].id), n: 5, strategy: strat, mode: 'prova', rnd });
        ses.items.forEach((it, i) => {
          const q = Q.Store.question(it.qid);
          const ok = rnd() < p;
          const chosenOrig = ok ? q.correct : [0, 1, 2, 3].filter((x) => x !== q.correct)[Math.floor(rnd() * 3)];
          const r = rnd();
          const conf = ok ? (r < 0.55 + k * 0.05 ? 'sure' : r < 0.9 ? 'doubt' : 'guess') : r < 0.2 ? 'sure' : r < 0.6 ? 'doubt' : 'guess';
          const words = Q.words(q.stem) + q.options.reduce((s, o) => s + Q.words(o), 0);
          const ms = Math.round((words * 90 + 3000 + rnd() * 14000) * (rnd() < 0.07 ? 0.2 : 1));
          it.a = { chosenPos: it.order.indexOf(chosenOrig), conf, ms };
        });
        const at = Q.Engine.finish(ses);
        at.at = Date.now() - ago * day + k * 1000;
        at.durationMs = at.answers.reduce((s, a) => s + a.ms, 0);
        at.startedAt = at.at - at.durationMs;
        Q.Store.state.attempts.push(at);
      });
    }
    Q.Store.save();
    return mats;
  };
})();
