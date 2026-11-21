/* Localquest — dicas ao passar o cursor (title) em todos os botões e controles. */
(function () {
  const Q = window.Q;

  const ACT = {
    'toggle-theme': 'Alterna entre o tema claro e o escuro.',
    'toggle-images': 'Liga ou desliga as imagens nas questões. Desligado, as questões que dependem de figura ficam fora da prova.',
    'toggle-enamed': 'Liga o modo ENAMED (precisa de internet): vincula os temas das aulas a questões e provas do ENAMED. A bolinha mostra se há conexão.',
    'clear-filter': 'Remove os filtros de curso, período e matéria.',
    'quick-start': 'Monta e inicia uma prova com todas as questões dos materiais do filtro atual.',
    'load-demo': 'Carrega 2 aulas e um histórico fictício para você conhecer o app.',
    'go-upload': 'Abre a Biblioteca para enviar seus slides.',
    'drill-weak': 'Inicia um treino com as questões dos temas em que você está mais frágil.',
    'drill-new': 'Inicia um treino com os temas que você ainda não respondeu.',
    new: 'Envia slides (PPTX ou PDF). As questões são criadas automaticamente.',
    demo: 'Carrega o material de exemplo.',
    sim: 'Simula todas as questões deste material, em um toque.',
    'sim-all': 'Simula todas as questões de todos os materiais do filtro atual.',
    'tog-ign': 'Ignora ou reativa este slide (ex.: capa, agenda). Slides ignorados não geram questões nem contam na cobertura.',
    'ren-topic': 'Renomeia este slide.',
    'edit-mat': 'Edita título, curso, período e matéria do material.',
    'del-demo': 'Remove só os materiais de exemplo (e o histórico fictício deles).',
    'del-mat': 'Exclui o material, as questões e o histórico dele.',
    'open-topic': 'Abre o conteúdo deste slide.',
    'zoom-img': 'Amplia a imagem.',
    'new-q': 'Escreve uma questão manualmente.',
    'edit-q': 'Edita esta questão.',
    'del-q': 'Exclui esta questão.',
    'mat-all': 'Seleciona todos os materiais (e todos os temas) para a prova.',
    'mat-none': 'Desmarca todos os materiais.',
    'cfg-open': 'Mostra os temas (slides) deste material para você tirar algum da prova.',
    'topics-all': 'Marca todos os temas deste material.',
    'topics-none': 'Desmarca todos os temas deste material.',
    'cfg-n': 'Define quantas questões terá a prova ("Todas" usa todas as disponíveis).',
    'cfg-strat': 'Define como as questões são escolhidas: misto, cobertura, pontos fracos ou aleatório.',
    'cfg-timer': 'Define um tempo limite para a prova.',
    start: 'Inicia a prova com as opções escolhidas.',
    pick: 'Marca esta alternativa. Atalho: teclas A, B, C ou D.',
    conf: 'Informa o quanto você está seguro. Chutes e respostas rápidas demais não contam como domínio. Atalhos: 1, 2 e 3.',
    next: 'Vai para a próxima questão (tecla Enter).',
    quit: 'Encerra a prova agora e contabiliza o que foi respondido.',
    again: 'Volta para montar uma nova prova.',
    'rev-f': 'Filtra a revisão: todas, só erradas ou só chutes e respostas suspeitas.',
    'r-drill': 'Inicia um treino focado nos pontos fracos desta prova.',
    dim: 'Muda o agrupamento do gráfico: matéria, período, curso ou material.',
    print: 'Abre a impressão para salvar este relatório em PDF.',
    'open-attempt': 'Abre o resultado desta prova.',
    theme: 'Escolhe o tema visual.',
    maxrun: 'Máximo de letras certas iguais seguidas no gabarito sorteado.',
    'save-ai': 'Salva a chave de API, o modelo e a opção de IA ao enviar materiais.',
    export: 'Baixa um arquivo de backup com seus materiais, questões e histórico.',
    import: 'Restaura um backup salvo antes.',
    reset: 'Apaga todos os dados deste navegador.',
    'adv-prompt': 'Gera o prompt com as regras e o conteúdo dos slides, para colar em uma IA.',
    'adv-import': 'Importa as questões que a IA devolveu (JSON).',
    'adv-ai': 'Gera as questões deste material pela API da Anthropic (exige chave) e troca as automáticas.',
    'adv-auto': 'Cria questões automáticas para os slides que ainda não têm nenhuma.',
    'en-import': 'Importa o caderno e o gabarito oficiais do ENAMED e vincula as questões aos seus temas.',
    'en-clear': 'Remove as questões do ENAMED importadas.',
    'rk-join': 'Entra em um grupo de estudo com o código recebido.',
    'rk-create': 'Cria um grupo de estudo e gera o código para convidar colegas.',
    'rk-leave': 'Sai deste grupo de estudo.',
    'rk-sync': 'Envia seu placar atual para os rankings.',
    'rk-copy': 'Copia o código do grupo para você compartilhar.',
    'rk-nick': 'Salva o nome que aparece no ranking.',
    'rk-scope': 'Escolhe se o ranking é geral ou de um grupo.',
    'rk-by': 'Escolhe como o ranking é separado: geral, matéria, aula ou assunto.',
  };
  const ID = {
    'u-go': 'Lê os slides e cria as questões automaticamente.',
    'imp-go': 'Importa as questões coladas acima.', 'imp-f': 'Escolhe um arquivo .json com as questões.',
    'pp-c': 'Copia o prompt para a área de transferência.', 'ai-go': 'Gera as questões pela API.', 'q-save': 'Salva a questão no banco.',
    'q-up': 'Anexa uma imagem a esta questão.', ok: 'Confirma.',
  };
  const NAV = {
    '#/inicio': 'Painel com seu domínio, cobertura e próximos passos.', '#/biblioteca': 'Seus materiais (slides) e temas.',
    '#/banco': 'Banco de questões: crie, edite e revise.', '#/simulado': 'Monte e inicie uma prova.',
    '#/desempenho': 'Seu desempenho por matéria, período e curso.', '#/ranking': 'Ranking entre usuários e grupos de estudo.',
    '#/ajustes': 'Preferências, versão avançada, ENAMED e backup.',
  };
  const CHANGE = {
    filter: 'Filtra tudo por curso, período ou matéria.', 'cfg-mat': 'Inclui ou tira este material da prova.',
    'cfg-topic': 'Inclui ou tira este tema (slide) da prova.', 'bank-mat': 'Escolhe o material cujas questões você quer ver.',
    'rk-scope': 'Escolhe se o ranking é geral ou de um grupo.', 'rk-by': 'Separa o ranking por matéria, aula ou assunto.', 'rk-key': 'Escolhe qual matéria, aula ou assunto mostrar.',
    'only-issues': 'Mostra só as questões com alertas de pista.', 'adv-mat': 'Escolhe o material para os passos abaixo.',
  };

  Q.applyTips = (root) => {
    (root || document).querySelectorAll('button, a, select, input[type=checkbox], [data-act], [data-change]').forEach((el) => {
      if (el.getAttribute('title')) return;
      let tip = '';
      if (el.dataset.act && ACT[el.dataset.act]) tip = ACT[el.dataset.act];
      else if (el.dataset.change && CHANGE[el.dataset.change]) tip = CHANGE[el.dataset.change];
      else if (el.id && ID[el.id]) tip = ID[el.id];
      else if (el.tagName === 'A' && NAV[el.getAttribute('href')]) tip = NAV[el.getAttribute('href')];
      else if (el.hasAttribute('data-close')) tip = 'Fecha esta janela.';
      else if (el.classList.contains('modal-x')) tip = 'Fecha esta janela.';
      else if (el.classList.contains('tile')) return;
      if (tip) el.setAttribute('title', tip);
    });
  };
})();
