# PRD — Product Requirements Document
## MathMaster

| | |
|---|---|
| **Documento** | Product Requirements Document (PRD) |
| **Produto** | MathMaster |
| **Versão do documento** | 1.1 |
| **Status** | Draft para aprovação |
| **Autor** | CTO / Arquitetura de Software |
| **Data** | 2026-07-03 |
| **Classificação** | Confidencial — Uso interno |
| **Documento relacionado** | [BUSINESS.md](./BUSINESS.md) — Estratégia de Monetização e Modelo de Negócio |

---

## 1. Visão do Produto

O **MathMaster** é uma plataforma inteligente de resolução, ensino e compreensão matemática que transforma qualquer problema — digitado, escrito à mão ou fotografado — em uma explicação passo a passo verdadeiramente didática, adaptada ao nível de conhecimento do usuário.

Enquanto o mercado atual oferece calculadoras simbólicas poderosas, porém pedagogicamente rasas, o MathMaster nasce com uma tese central:

> **Resolver não é ensinar.** A maior parte das ferramentas existentes entrega a resposta certa com passos genéricos gerados por um motor simbólico. O MathMaster entrega compreensão — mapeando o que o aluno já domina, identificando a lacuna conceitual específica que gerou o erro, lembrando-se do histórico de dificuldades do aluno ao longo do tempo, e conduzindo-o até a autonomia para resolver o próximo problema sozinho.

O MathMaster se diferencia por ser construído sobre quatro pilares inéditos na categoria, que juntos formam o que chamamos de **Camada de Inteligência Pedagógica**:

- **Learning Graph** — um mapa vivo do domínio conceitual do aluno.
- **Math Mentor** — um tutor adaptativo que acompanha a evolução do aluno ao longo do tempo.
- **Confidence Engine** — uma camada de transparência que explica *como* cada resposta foi validada.
- **AI Memory** — uma memória de aprendizado de longo prazo que identifica padrões e dificuldades recorrentes entre sessões.

Nossa visão de longo prazo é que o MathMaster se torne o **tutor de matemática pessoal de referência global**, presente do ensino fundamental à pós-graduação, integrado ao fluxo de estudo real do aluno (dever de casa, provas, vestibulares, ENEM, SAT, engenharia, ciência de dados) e adotado por instituições de ensino como ferramenta oficial de apoio pedagógico.

---

## 2. Problema que Resolve

### 2.1 O problema do usuário final (estudante)

- Estudantes conseguem obter a **resposta** de um problema em segundos, mas continuam sem entender **por que** aquele caminho foi tomado.
- As explicações de ferramentas existentes são **motor-cêntricas** (mostram os passos que o algoritmo simbólico executou), não **aluno-cêntricas** (não se adaptam ao que o aluno já sabe, ao seu histórico ou onde ele errou).
- Não há **diagnóstico de erro conceitual**: se o aluno erra um problema de frações dentro de uma equação, a ferramenta resolve a equação inteira, mas não identifica que a causa raiz foi um erro de operação com frações.
- Não há **memória entre sessões**: cada problema é resolvido de forma isolada. Se o aluno erra o mesmo tipo de erro há semanas, nenhuma ferramenta hoje percebe o padrão.
- Ferramentas existentes não explicam **o quão confiável** é a resposta — apresentam tudo com a mesma autoridade absoluta, mesmo em casos ambíguos ou de múltiplas soluções.
- A explicação é única e fixa — não existe a opção de simplificar para "modo iniciante" ou aprofundar para "modo rigor acadêmico" conforme a necessidade do momento.
- Ferramentas gratuitas escondem os passos atrás de paywall, criando frustração e uma percepção de produto predatório.

### 2.2 O problema do educador e da instituição

- Professores não têm visibilidade sobre **onde** os alunos de fato travam — apenas se acertaram ou erraram a tarefa.
- Falta uma ferramenta que possa ser **recomendada oficialmente** por escolas sem o risco de estar apenas "entregando respostas prontas" para colas.

### 2.3 O problema de negócio do mercado atual

- O mercado é dominado por players maduros, porém estagnados em inovação pedagógica, com forte dependência de anúncios e paywalls agressivos.
- Não existe hoje um player focado especificamente em **compreensão adaptativa, memória de aprendizado e confiabilidade matemática transparente**, construído com IA generativa moderna combinada a motores simbólicos determinísticos.

---

## 3. Público-Alvo

### 3.1 Segmentos primários

| Segmento | Descrição | Necessidade central |
|---|---|---|
| **Estudantes do Ensino Fundamental II e Médio** | 12–18 anos, preparando-se para provas regulares, ENEM, vestibulares | Entender a matéria, não só a resposta |
| **Estudantes universitários (STEM)** | Cálculo, Álgebra Linear, Estatística, Engenharia | Velocidade + rigor + verificação de raciocínio próprio |
| **Adultos em requalificação profissional** | Preparação para concursos, certificações, bootcamps de dados | Estudo autodirigido eficiente, retomado entre sessões |
| **Pais** | Apoiando o dever de casa dos filhos | Confiança de que a ferramenta ensina, não "cola" |

### 3.2 Segmentos secundários (B2B / expansão)

| Segmento | Descrição |
|---|---|
| **Professores e escolas** | Dashboards de acompanhamento de turma, banco de exercícios |
| **Plataformas de e-learning (parcerias via API)** | Embutir o motor MathMaster como camada de resolução/explicação |
| **Editoras e produtoras de conteúdo educacional** | Geração assistida de listas de exercícios e gabaritos comentados |

### 3.3 Personas de referência

- **Ana, 16 anos** — Ensino Médio, se prepara para o ENEM, usa o celular para tirar fotos de exercícios de matemática à noite. Estuda de forma irregular e precisa retomar de onde parou.
- **Lucas, 20 anos** — Engenharia, usa Cálculo II e Álgebra Linear diariamente, quer verificar se seu raciocínio está correto e entender o nível de confiança da resposta antes de uma prova.
- **Professora Marta, 41 anos** — Dá aula de matemática no Ensino Médio, quer entender os erros mais comuns da turma antes da prova.
- **Carla, 35 anos, mãe** — Não lembra matéria do ensino fundamental, precisa de uma explicação em linguagem simples ("Explain Like I'm 10") para ajudar o filho sem "só dar a resposta".

---

## 4. Diferenciais em Relação a Symbolab, Wolfram Alpha e Microsoft Math Solver

| Dimensão | Symbolab | Wolfram Alpha | Microsoft Math Solver | **MathMaster** |
|---|---|---|---|---|
| Resolução simbólica | Forte | Excelente (padrão-ouro) | Boa | Forte (motor simbólico próprio + integrações) |
| Explicação passo a passo | Genérica, motor-cêntrica | Técnica, densa, pouco didática | Simples, mas rasa | **Adaptativa ao nível e ao histórico do aluno, com múltiplos registros via Explain Like...** |
| Diagnóstico de erro conceitual | Inexistente | Inexistente | Inexistente | **Núcleo do produto**: identifica a causa raiz do erro |
| Mapeamento de domínio conceitual | Inexistente | Inexistente | Inexistente | **Learning Graph**: mapa vivo de conceitos dominados, em progresso e não explorados |
| Continuidade e memória de aprendizado | Nenhuma | Nenhuma | Mínima | **AI Memory**: identifica dificuldades recorrentes e permite retomar estudos de onde parou |
| Tutoria personalizada e evolutiva | Inexistente | Inexistente | Inexistente | **Math Mentor**: acompanha a evolução do aluno e ajusta ritmo, estilo e recomendações |
| Transparência de confiança | Não expõe nível de certeza | Alta confiança implícita (mas rígido) | Média | **Confidence Engine**: explica o método de validação e o grau de confiança de cada resposta |
| Reconhecimento de escrita à mão / foto | Básico | Limitado | Bom (OCR) | **OCR + interpretação semântica robusta**, incluindo notação ambígua |
| Modelo de negócio | Paywall agressivo em passos | Freemium técnico, foco em power users | Gratuito, mas genérico | **Freemium ético**: passos essenciais sempre gratuitos, profundidade e personalização como premium (ver [BUSINESS.md](./BUSINESS.md)) |
| Foco pedagógico vs. utilitário | Utilitário | Utilitário/científico | Utilitário escolar | **Pedagógico por design** — a resposta é o efeito colateral, não o produto |
| Integração institucional (B2B) | Limitada | Wolfram for Education (acadêmico, caro) | Integração Microsoft 365 | **API e dashboard nativos para escolas**, com foco em acompanhamento de turma |
| Idioma e contexto local (currículo BR/LatAm) | Tradução genérica | Inglês-cêntrico | Tradução genérica | **Currículo nativo BNCC/ENEM e vestibulares regionais** desde o MVP |

**Resumo do posicionamento estratégico:**
O MathMaster não compete para ser "mais uma calculadora com IA". Compete para ser a ferramenta que **ensina de verdade, lembra do aluno e é transparente sobre sua própria confiabilidade** — uma combinação que nenhum dos três players atuais oferece como núcleo do produto.

---

## 5. Funcionalidades Principais

### 5.1 Núcleo de Resolução e Interação

1. **Entrada multimodal de problemas**
   - Digitação com editor de fórmulas (LaTeX-like, amigável).
   - Upload de foto/imagem com OCR matemático (impresso e manuscrito).
   - Colagem de texto/expressões.

2. **Motor de resolução simbólica**
   - Álgebra (equações, inequações, sistemas, polinômios).
   - Cálculo (limites, derivadas, integrais, séries).
   - Trigonometria e funções.
   - Estatística e probabilidade básica.
   - Matrizes e álgebra linear introdutória.

3. **Verificação de resposta e trabalho do aluno**
   - Comparação entre resposta do aluno e resposta correta com feedback direcionado.
   - Diagnóstico de erro do usuário, identificando o passo exato e a lacuna conceitual associada.

4. **Gráficos e visualizações**
   - Plotagem de funções, derivadas, integrais e regiões.

5. **Modo de estudo guiado**
   - Trilhas por tópico e por currículo (ENEM, vestibulares, disciplinas universitárias).

### 5.2 Learning Graph

O **Learning Graph** é o mapa vivo do domínio conceitual do aluno: um grafo de conhecimento onde cada nó representa um conceito matemático (ex.: "fatoração de trinômios", "regra da cadeia", "teorema de Pitágoras") e as arestas representam relações de pré-requisito e dependência conceitual.

- Cada nó carrega um **nível de domínio estimado** (0–100%), atualizado a cada interação do aluno com problemas relacionados àquele conceito.
- Permite **diagnóstico de causa raiz em cascata**: um erro em "equação do 2º grau" pode ser rastreado até uma lacuna real em "fatoração" ou em "operações com frações", mesmo que o aluno nunca tenha errado diretamente um exercício desses tópicos.
- Alimenta o **Math Mentor** e o motor de recomendação de trilhas de estudo.
- É visualizável pelo aluno como um **mapa de progresso** (conceitos dominados, em desenvolvimento e ainda não explorados), reforçando a percepção de evolução real.
- Na versão institucional, é agregável por turma, permitindo ao professor visualizar lacunas conceituais coletivas (ver RF-21 e Seção 5.3 institucional no roadmap).

### 5.3 Math Mentor

O **Math Mentor** é a camada de tutoria adaptativa que consome os dados do Learning Graph e da AI Memory para acompanhar a evolução do aluno ao longo do tempo e personalizar o ensino, funcionando como uma presença pedagógica contínua — não uma ferramenta stateless.

- **Continuidade**: o aluno tem a percepção de estar sendo acompanhado pelo mesmo mentor ao longo de semanas e meses, não interagindo com uma calculadora anônima a cada sessão.
- **Adaptação de ritmo e estilo**: ajusta a profundidade das explicações, a ordem dos tópicos sugeridos e a frequência de reforço com base no desempenho histórico.
- **Proatividade**: recomenda o que estudar a seguir, sugere revisão espaçada de tópicos frágeis (informada por princípios de repetição espaçada) e reconhece marcos de progresso (ex.: "Você dominou equações do 2º grau — pronto para funções quadráticas").
- **Feedback motivacional calibrado**: reforça avanços reais identificados no Learning Graph, evitando gamificação vazia.

### 5.4 Confidence Engine

O **Confidence Engine** é a camada de transparência que explica **como** cada resposta foi validada — não apenas apresenta um resultado com autoridade implícita, como fazem os concorrentes.

- Exibe **qual método (ou métodos) foi utilizado** para resolver e/ou validar a resposta (ex.: motor simbólico determinístico, verificação cruzada numérica, concordância entre métodos alternativos de resolução).
- Apresenta um **score de confiança explicado em linguagem natural** (ex.: "Verificado por dois métodos simbólicos independentes — confiança alta" vs. "Método único aplicado a um domínio complexo — confiança média, revisão recomendada").
- Sinaliza **casos-limite explicitamente**: restrições de domínio, múltiplas soluções válidas, ou premissas assumidas ao interpretar uma notação ambígua (por exemplo, ao interpretar uma expressão manuscrita pouco clara).
- É um diferencial estratégico de confiança de marca: nenhum concorrente expõe hoje o "porquê" de confiar em uma resposta, apenas a apresenta como fato.

### 5.5 Explain Like...

O recurso **Explain Like...** permite ao aluno escolher o registro de explicação mais adequado ao momento, podendo alternar livremente sem perder o contexto do problema já resolvido:

| Modo | Público-alvo | Estilo |
|---|---|---|
| **Explain Like I'm 10** | Iniciantes, pais ajudando filhos | Linguagem simples, analogias do cotidiano |
| **Explain Like a classmate** | Uso padrão (default) | Passo a passo direto, tom de colega de estudo |
| **Explain Like my professor** | Universitários, avançados | Rigor formal, notação matemática completa, justificativas teoremáticas |
| **Explain Like an exam grader** | Preparação para provas (ENEM, vestibulares, concursos) | Foco no que é necessário para pontuação máxima na banca avaliadora |

A troca de modo é instantânea e não reinicia a resolução — apenas reformula a camada de explicação sobre a mesma solução validada.

### 5.6 AI Memory

O **AI Memory** é o sistema de memória de aprendizado de longo prazo do MathMaster, distinto de um histórico simples de problemas resolvidos:

- **Retomada de estudos**: o aluno pode continuar exatamente de onde parou uma trilha, um tópico ou uma dúvida específica, mesmo após semanas de inatividade.
- **Identificação de padrões recorrentes**: reconhece quando o mesmo tipo de erro se repete ao longo do tempo (ex.: "erro de sinal em inequações" identificado em 5 sessões distintas nos últimos 2 meses), mesmo quando os problemas específicos são diferentes.
- **Sinal longitudinal para o Math Mentor e o Learning Graph**: fornece a base histórica que transforma recomendações pontuais em uma trajetória de aprendizado coerente.
- **Controle e privacidade do usuário**: o aluno pode visualizar, exportar ou apagar sua memória de aprendizado a qualquer momento, em conformidade com a LGPD (ver RNF-13).

---

## 6. Funcionalidades Futuras (pós-MVP / visão de longo prazo)

- **Tutor conversacional por voz**, com o Math Mentor dialogando naturalmente sobre o problema.
- **Modo colaborativo em sala de aula** (professor projeta, alunos resolvem em tempo real).
- **Dashboard institucional para escolas**, com o Learning Graph agregado por turma e analytics de lacunas coletivas.
- **Geração automática de listas de exercícios e provas** a partir de um tópico ou lacuna identificada no Learning Graph.
- **Integração com LMS** (Google Classroom, Moodle, Canvas).
- **API pública para desenvolvedores e parceiros de e-learning**, incluindo acesso programático ao Confidence Engine.
- **Modo "prova simulada"** com cronômetro e correção estilo banca (ENEM, vestibulares, concursos), com relatório pós-prova gerado pelo Math Mentor.
- **Suporte a matemática avançada** (equações diferenciais, análise real, álgebra abstrata, otimização), expandindo o Learning Graph para domínios de pós-graduação.
- **Aplicativo offline** para regiões com conectividade limitada, com sincronização posterior da AI Memory.
- **Comunidade de estudo** (grupos, desafios, gamificação, ranking saudável), ancorada em marcos reais do Learning Graph.
- **Assistente para professores**: geração de plano de aula e identificação de lacunas da turma via Learning Graph agregado.
- **Exportação do Learning Graph pessoal** como relatório de progresso (ex.: para portfólio escolar ou acompanhamento familiar).

---

## 7. Objetivos Técnicos

1. **Precisão matemática de nível referência**, equivalente ou superior ao estado da arte de motores simbólicos existentes, validada por suíte de regressão matemática contínua.
2. **Latência de resposta competitiva**: resolução simbólica simples em menos de 1,5s (p95); problemas complexos em menos de 5s (p95).
3. **Arquitetura híbrida em camadas claramente separadas**:
   - **Camada de verdade matemática**: motor simbólico determinístico, única fonte de verdade para resultado e validação (nunca gerado por IA generativa sem verificação determinística).
   - **Camada de confiança**: Confidence Engine, responsável por anexar metadados de validação e score de confiança a cada resposta do motor simbólico.
   - **Camada pedagógica**: IA generativa responsável por linguagem, adaptação de registro (Explain Like...) e diagnóstico textual de erro — sempre consumindo, nunca substituindo, o resultado da camada de verdade matemática.
   - **Camada de personalização e memória**: Learning Graph, AI Memory e Math Mentor, responsáveis por estado longitudinal do aluno, desacoplados do motor de resolução em si.
4. **OCR matemático robusto**, com taxa de reconhecimento correto ≥ 95% em texto impresso e ≥ 85% em manuscrito em condições normais de captura.
5. **Escalabilidade horizontal** da camada de resolução, suportando picos sazonais previsíveis (véspera de provas, ENEM, vestibulares).
6. **Disponibilidade** de 99,9% (SLA) para o serviço principal.
7. **Segurança e privacidade de dados educacionais** alinhada a LGPD (Brasil) e, na expansão internacional, GDPR e FERPA/COPPA (quando aplicável a menores de idade) — com atenção especial à AI Memory, por armazenar dados comportamentais longitudinais sensíveis.
8. **Extensibilidade do motor de tópicos matemáticos e do Learning Graph**, permitindo adicionar novos domínios e novos nós conceituais sem reescrever o núcleo.
9. **Observabilidade completa**: rastreabilidade de cada resolução, versionamento do método aplicado, capacidade de auditoria de respostas e do histórico de atualização do Learning Graph/AI Memory por usuário.
10. **Modularidade do Math Mentor**: a lógica de personalização deve ser desacoplada o suficiente para permitir experimentação A/B de estratégias pedagógicas sem alterar o núcleo de resolução.

---

## 8. Objetivos Comerciais

1. Estabelecer o MathMaster como **alternativa premium com propósito pedagógico** dentro de 18 meses de operação, com posicionamento claro de marca frente aos concorrentes, ancorado nos diferenciais de Learning Graph, Math Mentor, Confidence Engine e AI Memory.
2. Construir um **modelo freemium sustentável**, com conversão para plano pago ancorada em profundidade pedagógica, personalização e memória de longo prazo — nunca em "esconder o passo a passo básico". Detalhamento completo em [BUSINESS.md](./BUSINESS.md).
3. Abrir uma **linha de receita B2B/B2B2C** via parcerias com escolas, cursinhos e plataformas de e-learning dentro do primeiro ano de operação comercial.
4. Atingir **retenção mensal (D30) superior à média do setor de edtech** (benchmark inicial: >35%), validando que a combinação de Math Mentor e AI Memory gera hábito de estudo recorrente, não uso pontual.
5. Preparar a base para **expansão internacional (LatAm primeiro, depois mercados de língua inglesa)** a partir do segundo ano.
6. Construir **defensibilidade de dados**: quanto mais alunos usam o produto, mais rico e preciso se torna o Learning Graph agregado e o diagnóstico de erro do Confidence Engine — criando efeito de rede de aprendizado interno (não social) e um fosso competitivo de dados difícil de replicar.

---

## 9. Casos de Uso

### UC-01 — Resolver problema digitado
Usuário digita uma equação; sistema retorna solução com passo a passo adaptado ao nível selecionado.

### UC-02 — Resolver problema via foto
Usuário fotografa exercício do caderno/livro; sistema executa OCR, confirma a interpretação com o usuário, resolve e explica.

### UC-03 — Verificar resolução própria
Usuário insere sua tentativa de resposta; sistema identifica se está correta e, se não, aponta o passo exato do erro e a razão conceitual, atualizando o Learning Graph correspondente.

### UC-04 — Estudar por trilha guiada
Usuário seleciona um tópico (ex.: "Funções do 2º grau para o ENEM"); o Math Mentor apresenta sequência progressiva de exercícios com dificuldade adaptativa, informada pelo Learning Graph.

### UC-05 — Consultar histórico e progresso
Usuário acessa painel pessoal com visualização do Learning Graph (tópicos dominados, em progresso e fracos) e recomendação do próximo passo de estudo feita pelo Math Mentor.

### UC-06 — Retomar estudo interrompido
Usuário retorna após duas semanas sem uso; a AI Memory reconhece o ponto exato de interrupção e o Math Mentor sugere retomar o mesmo tópico ou revisar um conceito frágil identificado antes da pausa.

### UC-07 — Consultar a confiança de uma resposta
Usuário, em dúvida sobre um resultado antes de uma prova, expande o painel do Confidence Engine e visualiza qual método validou a resposta e por que o nível de confiança é alto ou médio.

### UC-08 — Alternar o nível de explicação
Usuário lê uma explicação no modo padrão, não entende, e alterna para "Explain Like I'm 10"; posteriormente, para revisar com rigor antes de uma prova universitária, alterna para "Explain Like my professor" sobre o mesmo problema.

### UC-09 — Professor acompanha turma (pós-MVP)
Professor visualiza, em dashboard agregado, o Learning Graph coletivo da turma, identificando os tópicos com maior taxa de erro.

### UC-10 — Simulado cronometrado (pós-MVP)
Usuário realiza uma prova simulada de vestibular/concurso com correção detalhada ao final, gerada pelo Math Mentor.

---

## 10. Fluxo do Usuário

### 10.1 Fluxo principal — Resolução de um problema

1. Usuário acessa o MathMaster (web ou app).
2. Usuário insere o problema (digitação, foto ou colagem).
3. Sistema confirma a interpretação do problema (preview da expressão reconhecida).
4. Usuário confirma ou corrige a interpretação.
5. Sistema resolve via motor simbólico determinístico.
6. O **Confidence Engine** anexa o score de confiança e o método de validação utilizado.
7. A camada pedagógica gera explicação adaptada ao nível declarado/inferido do usuário, no registro padrão de **Explain Like...**.
8. Sistema exibe: resposta final, passo a passo, indicador de confiança e visualização gráfica (quando aplicável).
9. Usuário pode:
   - Pedir mais detalhamento em um passo específico.
   - Trocar o registro de explicação (Explain Like...).
   - Expandir o painel do Confidence Engine para entender a validação.
   - Inserir sua própria tentativa para verificação.
   - Salvar o problema no histórico/trilha de estudo.
10. O **Learning Graph** é atualizado com o tópico praticado e o novo nível de domínio estimado.
11. A **AI Memory** registra o evento para referência longitudinal futura.

### 10.2 Fluxo alternativo — Erro do usuário

1–6. (idêntico ao fluxo principal)
7. Usuário insere sua tentativa de resposta.
8. Sistema compara passo a passo com a solução correta.
9. Sistema identifica o primeiro ponto de divergência e classifica o tipo de erro (conceitual, operacional, de interpretação).
10. O **Learning Graph** localiza o nó conceitual de origem real do erro (possivelmente um pré-requisito, não o tópico do problema em si).
11. Sistema apresenta feedback direcionado e, quando aplicável, sugere exercício de reforço sobre a lacuna identificada.
12. A **AI Memory** verifica se este tipo de erro já ocorreu anteriormente; em caso positivo, o **Math Mentor** sinaliza o padrão recorrente ao usuário.

### 10.3 Fluxo de retomada de estudo (AI Memory + Math Mentor)

1. Usuário retorna à plataforma após um período de inatividade.
2. A **AI Memory** identifica a última trilha/tópico em andamento e as lacunas conceituais ainda abertas.
3. O **Math Mentor** apresenta uma tela de retomada: "Continuar de onde parou" ou "Revisar ponto frágil identificado".
4. Usuário escolhe o caminho; o sistema retoma o fluxo principal a partir do contexto salvo.

### 10.4 Fluxo de onboarding

1. Cadastro (e-mail, Google ou conta escolar/institucional).
2. Declaração de nível/objetivo (ex.: "Ensino Médio — ENEM", "Cálculo I — Engenharia").
3. Diagnóstico inicial opcional (curto teste adaptativo para calibrar o estado inicial do Learning Graph).
4. Apresentação guiada das funcionalidades principais, incluindo Explain Like... e Confidence Engine.
5. Primeiro problema resolvido dentro do onboarding (momento "aha"), com o Math Mentor se apresentando como acompanhamento contínuo.

---

## 11. Requisitos Funcionais

| ID | Requisito |
|---|---|
| RF-01 | O sistema deve permitir entrada de problemas matemáticos via texto digitado com editor de fórmulas. |
| RF-02 | O sistema deve permitir upload de imagem (foto/scan) e realizar reconhecimento óptico de expressões matemáticas. |
| RF-03 | O sistema deve exibir ao usuário a interpretação do problema antes de resolvê-lo, permitindo correção manual. |
| RF-04 | O sistema deve resolver problemas dos domínios: aritmética, álgebra, funções, trigonometria, cálculo diferencial e integral, estatística básica e álgebra linear introdutória. |
| RF-05 | O sistema deve gerar explicação passo a passo para toda resolução, com níveis de detalhamento configuráveis via **Explain Like...**. |
| RF-06 | O sistema deve permitir que o usuário informe sua própria resolução e receber diagnóstico de correção/erro. |
| RF-07 | O sistema deve classificar o tipo de erro identificado (conceitual, operacional, de interpretação) quando aplicável. |
| RF-08 | O sistema deve manter histórico de problemas resolvidos por usuário autenticado. |
| RF-09 | O sistema deve manter um **Learning Graph** por usuário, com nível de domínio estimado por conceito matemático. |
| RF-10 | O sistema deve recomendar próximos exercícios/tópicos de estudo com base no Learning Graph e nas ações do Math Mentor. |
| RF-11 | O sistema deve gerar visualizações gráficas para funções, derivadas e integrais quando aplicável ao problema. |
| RF-12 | O sistema deve exibir, via **Confidence Engine**, um indicador de nível de confiança e o método de validação utilizado em cada resposta. |
| RF-13 | O sistema deve suportar múltiplos idiomas, com português (Brasil) como idioma primário do lançamento. |
| RF-14 | O sistema deve oferecer trilhas de estudo pré-configuradas por currículo (ex.: ENEM, disciplinas universitárias). |
| RF-15 | O sistema deve permitir uso sem cadastro (modo convidado) para o fluxo básico de resolução, com limitação de uso e sem persistência de Learning Graph/AI Memory. |
| RF-16 | O sistema deve oferecer, no mínimo, quatro registros de explicação no recurso **Explain Like...** (iniciante, padrão, acadêmico, foco em prova), alternáveis sem reprocessar a resolução. |
| RF-17 | O sistema deve manter uma **AI Memory** capaz de identificar dificuldades recorrentes do usuário ao longo de múltiplas sessões. |
| RF-18 | O sistema deve permitir ao usuário retomar uma trilha ou tópico de estudo exatamente de onde parou, com base na AI Memory. |
| RF-19 | O sistema deve permitir ao usuário visualizar, exportar e apagar os dados armazenados em sua AI Memory e Learning Graph. |
| RF-20 | O **Math Mentor** deve gerar recomendações proativas de estudo (o que revisar, o que estudar a seguir) com base no cruzamento entre Learning Graph e AI Memory. |
| RF-21 (pós-MVP) | O sistema deve oferecer dashboard institucional agregando o Learning Graph de desempenho de turma para contas de professor. |
| RF-22 (pós-MVP) | O sistema deve oferecer modo de simulado cronometrado com correção final detalhada. |
| RF-23 (pós-MVP) | O sistema deve expor API pública documentada para parceiros integrarem o motor de resolução, o Confidence Engine e a camada de explicação. |

---

## 12. Requisitos Não Funcionais

| ID | Requisito |
|---|---|
| RNF-01 | **Desempenho**: resolução de problemas simples deve responder em até 1,5s (p95); problemas complexos em até 5s (p95). |
| RNF-02 | **Disponibilidade**: SLA de 99,9% para o serviço de resolução principal. |
| RNF-03 | **Escalabilidade**: a arquitetura deve suportar picos de tráfego de até 10x a média em períodos de prova/vestibular sem degradação perceptível. |
| RNF-04 | **Segurança**: dados de usuários, especialmente menores de idade, devem ser tratados conforme LGPD, com criptografia em trânsito e em repouso. |
| RNF-05 | **Privacidade**: nenhum conteúdo de problema/imagem enviado por um usuário deve ser utilizado para treinar modelos de terceiros sem consentimento explícito e anonimização. |
| RNF-06 | **Confiabilidade matemática**: toda resposta simbólica deve ser validada por verificação determinística antes da exibição (zero tolerância a alucinação em resultado numérico/simbólico final), com o resultado dessa validação exposto pelo Confidence Engine. |
| RNF-07 | **Acessibilidade**: interface deve atender diretrizes WCAG 2.1 nível AA. |
| RNF-08 | **Portabilidade**: experiência consistente entre web responsivo e aplicativos móveis (iOS/Android). |
| RNF-09 | **Observabilidade**: todo evento de resolução deve ser rastreável (log estruturado, versão do método aplicado, tempo de resposta) para fins de auditoria e melhoria contínua. |
| RNF-10 | **Manutenibilidade**: o motor de tópicos matemáticos e o Learning Graph devem ser modulares, permitindo adicionar novos domínios/conceitos sem impacto nos existentes. |
| RNF-11 | **Internacionalização**: arquitetura de conteúdo e UI preparada para expansão multi-idioma desde o design inicial. |
| RNF-12 | **Custo de inferência controlado**: uso de IA generativa (camada pedagógica, Math Mentor) deve ser arquitetado para conter custo por resolução dentro de margem sustentável ao plano freemium. |
| RNF-13 | **Governança de dados longitudinais**: a AI Memory deve armazenar apenas dados necessários ao propósito pedagógico declarado, com política clara de retenção, anonimização em análises agregadas e mecanismo de exclusão irreversível a pedido do titular dos dados. |
| RNF-14 | **Explicabilidade**: toda pontuação gerada pelo Confidence Engine deve ser acompanhada de uma justificativa em linguagem natural compreensível pelo público-alvo, não apenas um número isolado. |

---

## 13. MVP (Minimum Viable Product)

### 13.1 Objetivo do MVP

Validar a hipótese central do produto: **usuários preferem e permanecem mais engajados com uma ferramenta que ensina de forma adaptativa, lembra do seu histórico e é transparente sobre sua confiabilidade, do que com uma que apenas resolve**, mantendo paridade mínima de confiabilidade matemática com os concorrentes estabelecidos.

### 13.2 Escopo incluído no MVP

- Entrada de problemas via texto digitado e via foto (OCR).
- Motor de resolução para: aritmética, álgebra (equações e inequações até sistemas simples), funções, trigonometria básica, cálculo diferencial e integral introdutório.
- Explicação passo a passo com **Explain Like...** em versão reduzida: dois registros disponíveis no lançamento (padrão e iniciante), expansão para os quatro registros completos na v1.1.
- Verificação da tentativa do usuário com identificação do passo do erro.
- **Learning Graph** em versão inicial: cobertura dos tópicos do MVP, com nível de domínio por conceito e visualização básica de mapa de progresso.
- **Confidence Engine** em versão inicial: indicador de confiança (alto/médio) com justificativa textual simples, sem o detalhamento completo de métodos alternativos (previsto para v1.1).
- **AI Memory** em versão inicial: identificação de erro recorrente dentro da mesma trilha e retomada básica de estudo interrompido.
- **Math Mentor** em versão inicial: recomendação do próximo tópico com base no Learning Graph, sem ainda a camada completa de proatividade e revisão espaçada (previstas na v1.2).
- Histórico básico de problemas resolvidos.
- Web app responsivo (mobile-first).
- Modo convidado com limite diário de uso + cadastro para uso ilimitado no plano gratuito (sem Learning Graph/AI Memory persistentes no modo convidado).

### 13.3 Explicitamente fora do MVP

- Aplicativo mobile nativo (iOS/Android) — web responsivo cobre a necessidade inicial.
- Dashboard institucional para professores (Learning Graph agregado por turma).
- API pública para parceiros.
- Modo simulado cronometrado.
- Tutor por voz.
- Matemática avançada (equações diferenciais, análise, álgebra abstrata).
- Versão completa dos quatro registros do Explain Like... e da explicação detalhada de métodos alternativos no Confidence Engine.

### 13.4 Critério de saída do MVP

O MVP é considerado validado quando atingir, em ambiente de produção com usuários reais:
- Taxa de conclusão do fluxo de resolução ≥ 90%.
- Retenção D7 ≥ 25%.
- NPS ≥ 40 entre usuários ativos.
- Precisão matemática validada ≥ 99% na suíte de regressão interna.
- Pelo menos 60% dos usuários ativos interagindo com o Learning Graph ou o Confidence Engine ao menos uma vez por semana, validando a percepção de valor desses módulos.

---

## 14. Roadmap de Versões

### **v0.1 — Fundação Técnica (Interno)**
Motor simbólico núcleo, arquitetura de resolução determinística, pipeline de OCR básico, modelo de dados inicial do Learning Graph. Sem interface pública.

### **v1.0 — MVP Público (Lançamento)**
Escopo definido na Seção 13, incluindo versões iniciais de Learning Graph, Confidence Engine, AI Memory e Math Mentor.

### **v1.1 — Consolidação e Confiabilidade**
Expansão da cobertura de domínios matemáticos (estatística intermediária, álgebra linear ampliada), refinamento do diagnóstico de erro, melhoria de precisão de OCR manuscrito, os quatro registros completos do **Explain Like...**, e detalhamento completo de métodos no **Confidence Engine**.

### **v1.2 — Personalização Avançada**
Trilhas de estudo por currículo (ENEM, vestibulares específicos, disciplinas universitárias), **Math Mentor** completo com proatividade e revisão espaçada, **AI Memory** com detecção de padrões de longo prazo entre múltiplas trilhas, gamificação leve ancorada no Learning Graph.

### **v2.0 — Expansão de Plataforma**
Aplicativos móveis nativos (iOS/Android), modo offline parcial com sincronização de AI Memory, plano premium consolidado com limites e benefícios claros.

### **v2.1 — Camada Institucional (B2B)**
Contas de professor, dashboard de turma com Learning Graph agregado, banco de questões, relatórios de desempenho agregado.

### **v3.0 — Ecossistema e API**
API pública para parceiros/edtechs (incluindo Confidence Engine), modo simulado cronometrado, geração automática de listas e provas, integrações com LMS.

### **v3.x — Expansão Internacional**
Localização completa para novos mercados (LatAm, posteriormente mercados de língua inglesa), adequação a frameworks curriculares locais.

---

## 15. Critérios de Sucesso

### 15.1 Métricas de produto

| Métrica | Meta MVP | Meta 12 meses |
|---|---|---|
| Retenção D7 | ≥ 25% | ≥ 40% |
| Retenção D30 | — | ≥ 35% |
| NPS | ≥ 40 | ≥ 55 |
| Precisão matemática (suíte de regressão) | ≥ 99% | ≥ 99,5% |
| Taxa de conclusão do fluxo de resolução | ≥ 90% | ≥ 95% |
| Tempo médio até primeira resolução (onboarding) | < 3 min | < 90s |
| Engajamento semanal com Learning Graph/Confidence Engine | ≥ 60% dos usuários ativos | ≥ 75% dos usuários ativos |
| Taxa de retomada de estudo via AI Memory (usuários inativos por 7+ dias que retomam a trilha sugerida) | — | ≥ 30% |

### 15.2 Métricas de negócio

| Métrica | Meta 12 meses | Meta 24 meses |
|---|---|---|
| Usuários ativos mensais (MAU) | Definir junto ao plano de GTM (ver BUSINESS.md) | Crescimento 3x sobre ano 1 |
| Taxa de conversão free → pago | ≥ 3% | ≥ 6% |
| Parcerias institucionais (B2B) ativas | ≥ 5 | ≥ 30 |
| Churn mensal do plano pago | ≤ 8% | ≤ 5% |

### 15.3 Critérios qualitativos

- Usuários relatam espontaneamente, em pesquisas de satisfação, que "entenderam a matéria" e que "o app lembra de mim" — não apenas "obtiveram a resposta".
- Professores validam publicamente o produto como ferramenta de apoio pedagógico legítima (não associada a cola).
- Usuários citam o **Confidence Engine** como fator de confiança em momentos de alta pressão (véspera de provas).
- Cobertura de imprensa/edtech posiciona o MathMaster como o player focado em **compreensão e memória de aprendizado**, diferenciando-o claramente da categoria "calculadora com IA".

---

## 16. Estratégia de Monetização (Resumo)

A estratégia de monetização completa — modelo de precificação, planos, unit economics, estratégia B2B e princípios éticos de cobrança — está detalhada no documento dedicado **[BUSINESS.md](./BUSINESS.md)**.

Em síntese, o modelo adotado é o de **Freemium Ético**:
- O plano gratuito sempre inclui a resolução completa com passo a passo básico — nunca ocultando o raciocínio matemático em si.
- A monetização recai sobre **profundidade pedagógica e personalização**: Math Mentor completo, AI Memory de longo prazo, registros avançados de Explain Like..., detalhamento total do Confidence Engine, e uso ilimitado.
- Uma linha de receita B2B/institucional é construída em paralelo, ancorada no Learning Graph agregado por turma.

---

## 17. Próximos Passos

1. Validação e aprovação deste PRD e do BUSINESS.md pelos stakeholders do projeto.
2. Elaboração do **Documento de Arquitetura de Software (SAD)**, detalhando a separação entre motor simbólico, Confidence Engine, camada pedagógica e módulos de personalização (Learning Graph, Math Mentor, AI Memory).
3. Elaboração do **Design de Sistema do Motor Matemático** (especificação técnica do núcleo simbólico + camada de IA pedagógica).
4. Elaboração do **Design de Experiência do Usuário (UX/UI Spec)**, incluindo a visualização do Learning Graph e a interação com o Explain Like... e o Confidence Engine.
5. Refinamento do **Plano de Go-to-Market** e do modelo de precificação detalhado em BUSINESS.md.

---

*Fim do documento.*
