# Localquest — simulador de provas feito dos seus slides

Plataforma web (HTML/CSS/JS puro, sem build, sem servidor) para treinar com questões de múltipla escolha (4 alternativas) baseadas **apenas** nos slides das aulas.

## Criar questões a partir do material (o foco do app)
1. **Biblioteca → Adicionar slides** (PPTX ou PDF; pode enviar vários). O app **descobre a matéria sozinho**: pela capa ("Disciplina: …"), pelas propriedades do arquivo ou pelos termos do conteúdo, com um banco médico de apoio embutido. Você só confirma.
2. Em seguida abre o **✨ Criar questões** (também disponível em cada material): escolha **quantidade (até 50)**, **nível** e **como criar**.
3. Uma **IA lê os slides, entende o assunto e elabora questões de prova**: conceituais, de aplicação e casos clínicos, com 4 alternativas, justificativa da correta e de cada errada. Tudo que sustenta a resposta correta vem **só dos slides**; o banco médico de apoio só inspira alternativas *erradas*. Nada se repete.
   - **Fácil**: compreensão (conceitos, definições) · **Médio**: aplicação em situação-problema curta · **Difícil**: caso clínico que integra vários conceitos · **Misto**: um terço de cada.
4. Formas de usar a IA:
   - **IA automática (Claude)** — no link do claude.ai, usa a conta de quem abre (pede autorização na primeira vez).
   - **IA pela chave da API** — chave da Anthropic (Ajustes → perfil Criador); cobrada à parte.
   - **Meu chat de IA (grátis)** — o app gera o pedido (regras + slides), você cola no Claude/ChatGPT/Gemini e traz a resposta; para 50 questões são 5 partes.
   - **Básico, sem IA** — só reorganiza frases dos slides (perguntas literais); serve para revisão rápida.
5. No **Simulado** dá para filtrar por nível, escolher os temas e simular.

## Perfis
- **Estudante** (padrão): só o essencial — enviar material, criar questões, simular, desempenho, disputas e ranking.
- **Criador (programador)**: em **Ajustes → Perfil**. Libera o banco de questões (editar/excluir), prompt para IA, importação de JSON, IA pela API, base ENAMED e indicadores técnicos.

## Como abrir
- **Windows:** dê dois cliques em `iniciar.bat` (precisa do Python instalado). **Mac/Linux:** `./iniciar.sh`.
- Ou manualmente: `python3 -m http.server 8000` na pasta e abra `http://localhost:8000`.
- Para só testar com PPTX, abrir `index.html` direto no Chrome também funciona; a leitura de PDF exige o servidor local.

## Como usar
1. **Biblioteca** → envie slides `.pptx` ou `.pdf` e informe curso, período e matéria. Cada slide vira um *tema*; as imagens dos slides são extraídas.
2. **Questões** → crie manualmente, **importe JSON** ou use **Prompt para IA** (copie, cole numa IA, importe a resposta). Opcional: gerar direto com a API da Anthropic (chave em Ajustes, fica só no navegador).
3. **Simulado** → escolha materiais, quantidade, estratégia (mista, cobertura, pontos fracos) e modo (prova ou estudo). Figuras relevantes aparecem dentro da questão.
4. **Resultado** → panorama de utilização do conteúdo (mapa de slides, temas cobrados, banco usado e veredito de "conteúdo exaurido"), conquistas e pontos de melhoria.
5. **Desempenho** → filtros por curso/período/matéria, evolução, matriz período × matéria, calibragem e temas frágeis.

## Escudo anti-chute
- Gabarito balanceado: no máx. 2 letras iguais seguidas, sem escadas (A-B-C) nem alternâncias (A-B-A-B), letras distribuídas por igual; alternativas embaralhadas a cada prova.
- Lint de questões: alerta quando a certa é bem maior/menor, "todas as anteriores", termos absolutos só nas erradas, eco do enunciado. A montagem da prova limita questões em que a certa é a mais longa ao nível do acaso.
- Tocou, marcou: a resposta é registrada na hora, sem pergunta de certeza. Respostas rápidas demais para a leitura ou em padrão de marcação (mesma letra, escada, alternância) valem metade no "domínio real".

## Testes
`node tests/core.test.js` (gabaritos, detecção de padrões, lint e qualidade das questões de exemplo).

Dados ficam no IndexedDB do navegador; use Ajustes → Exportar backup. O conteúdo de exemplo é ilustrativo e não serve como fonte de estudo.


## Sala presencial (disputa ao vivo sem internet, pelo ponto de acesso do celular)
Em **Disputas → Sala presencial** os aparelhos se conectam **direto entre si** (WebRTC), sem servidor e sem conta:
1. Com internet, abra o Localquest em cada celular **uma vez** e instale (“Adicionar à tela inicial”). O service worker (`sw.js`) guarda o app para uso offline.
2. O anfitrião liga o **ponto de acesso** do celular; todos conectam nesse Wi-Fi (não precisa ter internet nele).
3. O anfitrião toca em **Abrir sala** e, para cada colega, **Adicionar participante**: o colega escaneia o QR (ou cola o código), mostra o QR de resposta e o anfitrião escaneia de volta.
4. O anfitrião inicia; todos jogam com o mesmo pódio e as mesmas regras (4 alternativas, acertos > pontos > rapidez).

Requisitos: a câmera (QR) e a instalação exigem **https** — use o site publicado pelo GitHub Pages deste repositório — **https://vitormaster.github.io/localquest/** (workflow em `.github/workflows/pages.yml`; em Settings → Pages, escolha *Source: GitHub Actions*) — ou outro hospedeiro https. O código de pareamento também pode ser copiado/colado se o QR não ler. Não funciona dentro do link do claude.ai (o ambiente bloqueia WebRTC e câmera).
