/* Localquest — banco médico de apoio (dentro do app, sem internet).
 * Serve para DUAS coisas e nada além disso:
 *   1) reconhecer a MATÉRIA de um material (capa, propriedades do arquivo ou termos do conteúdo);
 *   2) sugerir ideias de alternativas ERRADAS plausíveis do mesmo campo (para a IA não inventar distratores absurdos).
 * Ele NUNCA é fonte da resposta correta nem das justificativas: isso vem só dos slides. */
(function () {
  const Q = window.Q;
  const M = (Q.Med = {});

  const n = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* ---------- matérias e palavras-chave (para reconhecer o assunto) ---------- */
  const S = [
    ['Anatomia', 'anatomia anatomico musculo osso ligamento arteria veia nervo plexo fossa forame vertebra umero femur tibia inervacao irrigacao articulacao'],
    ['Histologia', 'histologia tecido epitelio epitelial conjuntivo celula lamina coloracao hematoxilina eosina'],
    ['Embriologia', 'embriologia embriao feto gastrulacao blastocisto folheto ectoderma mesoderma endoderma organogenese'],
    ['Fisiologia', 'fisiologia homeostase potencial de acao debito cardiaco ventilacao filtracao glomerular hormonio reflexo membrana'],
    ['Bioquímica', 'bioquimica enzima metabolismo glicolise ciclo de krebs atp aminoacido proteina lipidio gliconeogenese'],
    ['Farmacologia', 'farmacologia farmaco medicamento farmacocinetica farmacodinamica receptor agonista antagonista meia vida biodisponibilidade efeito adverso interacao'],
    ['Patologia', 'patologia necrose inflamacao neoplasia displasia apoptose lesao celular fibrose granuloma'],
    ['Microbiologia', 'microbiologia bacteria virus fungo cultura gram antibiograma esterilizacao'],
    ['Imunologia', 'imunologia anticorpo antigeno linfocito citocina complemento hipersensibilidade imunoglobulina'],
    ['Parasitologia', 'parasitologia protozoario helminto verme ciclo biologico vetor larva'],
    ['Semiologia', 'semiologia anamnese exame fisico ausculta palpacao percussao inspecao sinal sintoma'],
    ['Clínica Médica', 'clinica medica diagnostico diferencial conduta tratamento quadro clinico fisiopatologia'],
    ['Cardiologia', 'cardiologia coracao infarto angina insuficiencia cardiaca arritmia fibrilacao atrial eletrocardiograma hipertensao arterial coronaria valvula'],
    ['Pneumologia', 'pneumologia pulmao asma dpoc pneumonia espirometria dispneia bronquite fibrose pulmonar tuberculose'],
    ['Gastroenterologia', 'gastroenterologia figado hepatite cirrose estomago gastrite refluxo colon intestino pancreatite diarreia'],
    ['Nefrologia', 'nefrologia rim renal dialise creatinina glomerulonefrite proteinuria insuficiencia renal'],
    ['Endocrinologia', 'endocrinologia diabetes tireoide hipotireoidismo hipertireoidismo insulina cortisol adrenal hipofise'],
    ['Hematologia', 'hematologia anemia leucemia linfoma plaqueta coagulacao hemoglobina ferritina'],
    ['Infectologia', 'infectologia infeccao sepse antibiotico hiv dengue malaria antirretroviral'],
    ['Neurologia', 'neurologia avc acidente vascular encefalico epilepsia cefaleia parkinson demencia neuropatia nervo craniano'],
    ['Psiquiatria', 'psiquiatria depressao ansiedade esquizofrenia transtorno bipolar psicose antidepressivo humor'],
    ['Dermatologia', 'dermatologia pele lesao cutanea psoriase dermatite melanoma acne eczema'],
    ['Ortopedia e Traumatologia', 'ortopedia fratura luxacao osteoporose artrose lesao ligamentar trauma'],
    ['Reumatologia', 'reumatologia artrite lupus artrite reumatoide gota esclerodermia fibromialgia'],
    ['Geriatria', 'geriatria idoso envelhecimento senescencia senilidade queda fragilidade sarcopenia polifarmacia avd katz lawton'],
    ['Pediatria', 'pediatria crianca lactente neonato puericultura vacinacao crescimento desenvolvimento aleitamento'],
    ['Ginecologia e Obstetrícia', 'ginecologia obstetricia gestacao gestante parto pre natal puerperio menopausa utero ovario'],
    ['Cirurgia', 'cirurgia cirurgico incisao sutura pos operatorio hernia apendicite colecistectomia'],
    ['Urgência e Emergência', 'urgencia emergencia reanimacao parada cardiorrespiratoria suporte avancado de vida choque triagem'],
    ['Saúde Coletiva', 'saude coletiva saude publica sus atencao primaria prevencao vigilancia promocao da saude'],
    ['Epidemiologia e Bioestatística', 'epidemiologia incidencia prevalencia risco relativo odds estudo de coorte caso controle sensibilidade especificidade bioestatistica'],
    ['Bioética e Ética Médica', 'bioetica etica medica sigilo consentimento autonomia beneficencia codigo de etica'],
    ['Radiologia e Diagnóstico por Imagem', 'radiologia tomografia ressonancia ultrassonografia radiografia contraste'],
    ['Oncologia', 'oncologia cancer tumor quimioterapia radioterapia metastase estadiamento'],
    ['Oftalmologia', 'oftalmologia olho retina glaucoma catarata cornea acuidade visual'],
    ['Otorrinolaringologia', 'otorrinolaringologia ouvido otite sinusite amigdala laringe audicao'],
    ['Urologia', 'urologia prostata bexiga calculo renal incontinencia urinaria'],
    ['Anestesiologia', 'anestesia anestesiologia anestesico bloqueio epidural sedacao'],
    ['Nutrição', 'nutricao dieta nutriente caloria desnutricao obesidade suplementacao'],
    ['Fisioterapia', 'fisioterapia reabilitacao cinesioterapia amplitude de movimento marcha equilibrio exercicio terapeutico'],
    ['Enfermagem', 'enfermagem cuidado curativo processo de enfermagem sinais vitais'],
  ];
  M.SUBJECTS = S.map(([name, kw]) => ({ name, kw: kw.split(' ') }));

  /** Palavras-chave de 1 palavra pesam 1; frases (juntando vizinhas) são casadas por trecho. */
  const PHRASES = {};
  M.SUBJECTS.forEach((s) => {
    const txt = s.kw.join(' ');
    // reconstrói frases conhecidas comuns
    ['potencial de acao', 'debito cardiaco', 'ciclo de krebs', 'meia vida', 'efeito adverso', 'ciclo biologico', 'exame fisico', 'clinica medica', 'insuficiencia cardiaca',
      'fibrilacao atrial', 'hipertensao arterial', 'fibrose pulmonar', 'insuficiencia renal', 'acidente vascular encefalico', 'nervo craniano', 'transtorno bipolar', 'artrite reumatoide',
      'pre natal', 'pos operatorio', 'suporte avancado de vida', 'saude coletiva', 'saude publica', 'atencao primaria', 'promocao da saude', 'estudo de coorte', 'caso controle',
      'risco relativo', 'codigo de etica', 'etica medica', 'processo de enfermagem', 'sinais vitais', 'amplitude de movimento', 'exercicio terapeutico', 'acuidade visual', 'calculo renal',
      'incontinencia urinaria', 'parada cardiorrespiratoria', 'filtracao glomerular', 'lesao celular', 'lesao cutanea', 'lesao ligamentar', 'quadro clinico', 'diagnostico diferencial'].forEach((p) => {
      if (txt.includes(p)) (PHRASES[s.name] = PHRASES[s.name] || []).push(p);
    });
  });

  const pretty = (t) => t.replace(/\s+/g, ' ').trim().replace(/^[\-–:\s]+|[\s.\-–:]+$/g, '');

  /**
   * Descobre a matéria de um material.
   * in: { subject, title, slides:[{title,text}] }  (subject/title vêm das propriedades do arquivo)
   * out: { materia, source: 'capa'|'propriedades'|'conteúdo'|'', confidence: 0..1, alternatives:[nomes] }
   */
  M.detectSubject = (info) => {
    const slides = info.slides || [];
    const head = slides.slice(0, 5).map((s) => `${s.title || ''}\n${s.text || ''}`).join('\n');
    const all = slides.map((s) => `${s.title || ''}\n${s.text || ''}`).join('\n');

    const canon = (raw) => {
      const k = n(raw);
      const hit = M.SUBJECTS.find((s) => n(s.name) === k) || M.SUBJECTS.find((s) => k.includes(n(s.name)) || n(s.name).includes(k));
      return hit ? hit.name : pretty(raw).replace(/\b\p{L}/gu, (c) => c.toUpperCase());
    };

    // 1) a capa diz explicitamente ("Disciplina: Cardiologia")
    const re = /(?:disciplina|mat[eé]ria|unidade curricular|componente curricular|m[oó]dulo)\s*[:\-–]\s*([^\n|;]{3,70})/i;
    const m1 = head.match(re);
    if (m1) return { materia: canon(m1[1]), source: 'capa', confidence: 0.95, alternatives: [] };
    // 2) propriedades do arquivo (assunto)
    if (info.subject && pretty(info.subject).length >= 3 && pretty(info.subject).length <= 70) return { materia: canon(info.subject), source: 'propriedades', confidence: 0.9, alternatives: [] };

    // 3) termos do conteúdo
    const text = n(all);
    const scores = M.SUBJECTS.map((s) => {
      let sc = 0;
      s.kw.forEach((w) => { if (w.length >= 4) { const c = text.split(w).length - 1; sc += Math.min(c, 8); } });
      (PHRASES[s.name] || []).forEach((p) => { const c = text.split(p).length - 1; sc += Math.min(c, 6) * 2; });
      // o título do material e do primeiro slide pesam mais
      const t = n(`${info.title || ''} ${(slides[0] || {}).title || ''}`);
      if (t.includes(n(s.name))) sc += 12;
      return { name: s.name, sc };
    }).sort((a, b) => b.sc - a.sc);
    const [a, b] = scores;
    if (!a || a.sc < 4) return { materia: '', source: '', confidence: 0, alternatives: [] };
    const conf = Math.min(0.9, a.sc / (a.sc + (b ? b.sc : 0) + 4));
    return { materia: a.name, source: 'conteúdo', confidence: conf, alternatives: scores.slice(1, 3).filter((x) => x.sc >= 4).map((x) => x.name) };
  };

  /* ---------- ideias de alternativas ERRADAS plausíveis (apoio de distratores) ---------- */
  const SUP = {
    'Farmacologia': [
      ['Beta-bloqueadores', 'propranolol, metoprolol, atenolol, carvedilol, bisoprolol'], ['IECA', 'captopril, enalapril, lisinopril, ramipril'], ['BRA', 'losartana, valsartana, candesartana'],
      ['Diuréticos', 'hidroclorotiazida, clortalidona, furosemida, bumetanida, espironolactona, amilorida'], ['Bloqueadores de canal de cálcio', 'anlodipino, nifedipino, verapamil, diltiazem'],
      ['Estatinas', 'sinvastatina, atorvastatina, rosuvastatina'], ['Anticoagulantes e antiagregantes', 'varfarina, heparina, rivaroxabana, apixabana, AAS, clopidogrel'],
      ['Antidiabéticos', 'metformina, glibenclamida, gliclazida, insulina NPH, insulina regular, liraglutida, empagliflozina'], ['Antibióticos', 'amoxicilina, cefalexina, ceftriaxona, azitromicina, ciprofloxacino, gentamicina, vancomicina'],
      ['Analgésicos e AINEs', 'dipirona, paracetamol, ibuprofeno, diclofenaco, naproxeno, tramadol, morfina'], ['Benzodiazepínicos', 'diazepam, clonazepam, alprazolam, lorazepam'],
      ['ISRS', 'fluoxetina, sertralina, escitalopram, paroxetina'], ['Antipsicóticos', 'haloperidol, risperidona, olanzapina, quetiapina'], ['Corticoides', 'prednisona, dexametasona, hidrocortisona, budesonida'],
      ['Conceitos', 'biodisponibilidade, meia-vida, volume de distribuição, depuração, janela terapêutica, dose de ataque, dose de manutenção, efeito de primeira passagem, agonista, antagonista, agonista parcial'],
    ],
    'Cardiologia': [
      ['Condições', 'infarto agudo do miocárdio, angina estável, angina instável, insuficiência cardíaca, fibrilação atrial, flutter atrial, bloqueio atrioventricular, estenose aórtica, insuficiência mitral, pericardite, miocardite, endocardite infecciosa, dissecção de aorta'],
      ['Exames', 'eletrocardiograma, ecocardiograma, teste ergométrico, cintilografia miocárdica, cateterismo cardíaco, troponina, BNP, Holter, MAPA'],
    ],
    'Pneumologia': [
      ['Condições', 'asma, DPOC, pneumonia adquirida na comunidade, tuberculose pulmonar, embolia pulmonar, pneumotórax, derrame pleural, fibrose pulmonar idiopática, bronquiectasia, sarcoidose, SDRA, apneia obstrutiva do sono'],
      ['Exames', 'espirometria, gasometria arterial, radiografia de tórax, tomografia de tórax, broncoscopia, oximetria'],
    ],
    'Gastroenterologia': [['Condições', 'doença do refluxo gastroesofágico, úlcera péptica, gastrite, doença celíaca, doença de Crohn, retocolite ulcerativa, síndrome do intestino irritável, pancreatite aguda, colelitíase, colecistite, hepatites virais, cirrose, esteatose hepática, diverticulite, apendicite']],
    'Nefrologia': [['Condições', 'lesão renal aguda, doença renal crônica, síndrome nefrótica, síndrome nefrítica, glomerulonefrite, pielonefrite, nefrolitíase, acidose metabólica, hiperpotassemia, hiponatremia'], ['Exames', 'creatinina, ureia, taxa de filtração glomerular, urina tipo 1, proteinúria de 24 horas']],
    'Endocrinologia': [['Condições', 'diabetes mellitus tipo 1, diabetes mellitus tipo 2, cetoacidose diabética, estado hiperosmolar, hipotireoidismo, hipertireoidismo, doença de Graves, tireoidite de Hashimoto, síndrome de Cushing, insuficiência adrenal, feocromocitoma, hiperparatireoidismo, acromegalia, hipoglicemia'], ['Exames', 'hemoglobina glicada, glicemia de jejum, teste oral de tolerância à glicose, TSH, T4 livre, cortisol']],
    'Hematologia': [['Condições', 'anemia ferropriva, anemia megaloblástica, anemia falciforme, talassemia, leucemia mieloide aguda, leucemia linfoide crônica, linfoma de Hodgkin, mieloma múltiplo, púrpura trombocitopênica imune, hemofilia, doença de von Willebrand'], ['Exames', 'hemograma, ferritina, reticulócitos, esfregaço de sangue periférico, tempo de protrombina, TTPA']],
    'Infectologia': [['Agentes', 'Staphylococcus aureus, Streptococcus pyogenes, Streptococcus pneumoniae, Escherichia coli, Pseudomonas aeruginosa, Klebsiella pneumoniae, Mycobacterium tuberculosis, Candida albicans, Plasmodium falciparum, vírus da dengue, HIV'], ['Doenças', 'dengue, malária, leptospirose, sífilis, infecção pelo HIV, tuberculose, hanseníase, leishmaniose, doença de Chagas, esquistossomose']],
    'Neurologia': [['Condições', 'AVC isquêmico, AVC hemorrágico, ataque isquêmico transitório, epilepsia, enxaqueca, cefaleia tensional, doença de Parkinson, doença de Alzheimer, esclerose múltipla, miastenia gravis, síndrome de Guillain-Barré, meningite, neuropatia periférica']],
    'Psiquiatria': [['Transtornos', 'transtorno depressivo maior, transtorno bipolar, esquizofrenia, transtorno de ansiedade generalizada, transtorno de pânico, TOC, TEPT, TDAH, delirium'], ['Classes', 'ISRS, antidepressivos tricíclicos, antipsicóticos típicos, antipsicóticos atípicos, benzodiazepínicos, lítio, valproato']],
    'Geriatria': [['Síndromes e condições', 'imobilidade, instabilidade postural, incontinência, insuficiência cognitiva, iatrogenia, sarcopenia, fragilidade, osteoporose, delirium, demência, polifarmácia, quedas, hipotensão ortostática'], ['Instrumentos', 'Índice de Katz, Escala de Lawton, Timed Up and Go, Mini Exame do Estado Mental, Escala de Depressão Geriátrica, Mini Avaliação Nutricional']],
    'Pediatria': [['Vacinas', 'BCG, hepatite B, pentavalente, VIP, rotavírus, pneumocócica, meningocócica C, febre amarela, tríplice viral'], ['Doenças', 'bronquiolite, otite média aguda, diarreia aguda, asma, sarampo, varicela, coqueluche']],
    'Ginecologia e Obstetrícia': [['Obstetrícia', 'pré-eclâmpsia, eclâmpsia, diabetes gestacional, placenta prévia, descolamento prematuro de placenta, aborto, gravidez ectópica, trabalho de parto, parto pré-termo'], ['Ginecologia', 'mioma uterino, endometriose, síndrome dos ovários policísticos, cervicite, doença inflamatória pélvica, câncer de colo do útero, câncer de mama']],
    'Fisiologia': [['Conceitos', 'potencial de ação, sinapse, contração muscular, débito cardíaco, volume sistólico, pré-carga, pós-carga, complacência, ventilação alveolar, difusão, shunt, taxa de filtração glomerular, reabsorção tubular, sistema renina-angiotensina-aldosterona, hormônio antidiurético, aldosterona, insulina, glucagon, cortisol, hormônios tireoidianos']],
    'Patologia': [['Processos', 'necrose coagulativa, necrose liquefativa, necrose caseosa, apoptose, inflamação aguda, inflamação crônica granulomatosa, hiperplasia, hipertrofia, metaplasia, displasia, neoplasia benigna, neoplasia maligna, metástase, trombose, embolia, infarto, edema']],
    'Imunologia': [['Conceitos', 'hipersensibilidade tipo I, hipersensibilidade tipo II, hipersensibilidade tipo III, hipersensibilidade tipo IV, IgG, IgA, IgM, IgE, IgD, linfócito T CD4, linfócito T CD8, linfócito B, célula NK, sistema complemento, citocinas']],
    'Microbiologia': [['Conceitos', 'bactéria gram-positiva, bactéria gram-negativa, coloração de Ziehl-Neelsen, cultura, antibiograma, esterilização, desinfecção, vírus envelopado, fungo dimórfico']],
    'Saúde Coletiva': [['Conceitos', 'universalidade, integralidade, equidade, atenção primária, vigilância epidemiológica, prevenção primária, prevenção secundária, prevenção terciária, prevenção quaternária, promoção da saúde']],
    'Epidemiologia e Bioestatística': [['Medidas', 'incidência, prevalência, mortalidade, letalidade, risco relativo, odds ratio, sensibilidade, especificidade, valor preditivo positivo, valor preditivo negativo'], ['Estudos', 'coorte, caso-controle, transversal, ensaio clínico randomizado, revisão sistemática, série de casos']],
    'Bioética e Ética Médica': [['Princípios', 'autonomia, beneficência, não maleficência, justiça, sigilo profissional, consentimento livre e esclarecido']],
    'Anatomia': [['Nervos cranianos', 'olfatório, óptico, oculomotor, troclear, trigêmeo, abducente, facial, vestibulococlear, glossofaríngeo, vago, acessório, hipoglosso'], ['Manguito rotador', 'supraespinal, infraespinal, redondo menor, subescapular']],
    'Semiologia': [['Sinais e achados', 'sinal de Murphy, sinal de Blumberg, sinal de Giordano, sinal de Babinski, sinal de Romberg, sinal de Lasègue, sinal de Kernig, sinal de Brudzinski, sopro, estertores, sibilos, roncos, atrito pleural']],
    'Urgência e Emergência': [['Tipos de choque', 'hipovolêmico, cardiogênico, séptico, anafilático, neurogênico, obstrutivo'], ['Ritmos de parada', 'fibrilação ventricular, taquicardia ventricular sem pulso, assistolia, atividade elétrica sem pulso']],
    'Reumatologia': [['Condições', 'artrite reumatoide, lúpus eritematoso sistêmico, espondilite anquilosante, gota, osteoartrite, esclerose sistêmica, polimialgia reumática, vasculites']],
    'Dermatologia': [['Condições', 'psoríase, dermatite atópica, dermatite de contato, urticária, acne vulgar, escabiose, tinha, melanoma, carcinoma basocelular, carcinoma espinocelular, vitiligo']],
    'Ortopedia e Traumatologia': [['Condições', 'fratura de colo do fêmur, fratura de Colles, osteoporose, osteoartrose, entorse, lesão do ligamento cruzado anterior, síndrome do túnel do carpo, hérnia de disco, escoliose']],
  };

  /** Texto curto de apoio para o pedido à IA (só para alternativas ERRADAS). */
  M.supportText = (subject, maxChars = 1800) => {
    const key = Object.keys(SUP).find((k) => n(k) === n(subject)) || Object.keys(SUP).find((k) => n(subject).includes(n(k)) || n(k).includes(n(subject)));
    if (!key) return '';
    let out = '';
    for (const [g, items] of SUP[key]) {
      const line = `- ${g}: ${items}\n`;
      if (out.length + line.length > maxChars) break;
      out += line;
    }
    return out.trim();
  };
  M.knownSubjects = () => M.SUBJECTS.map((s) => s.name);
})();
