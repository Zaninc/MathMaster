# UI_UX.md
## MathMaster — Documento de Experiência e Interface (UX/UI Spec)

| | |
|---|---|
| **Documento** | UX/UI Specification |
| **Produto** | MathMaster |
| **Versão do documento** | 1.0 |
| **Status** | Draft para aprovação de design |
| **Autor** | Principal Product Designer / UX Research / UI Architecture |
| **Data** | 2026-07-03 |
| **Classificação** | Confidencial — Uso interno |
| **Documentos relacionados** | [PRD.md](./PRD.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) |

> Este documento não contém código. Ele define princípios de design, sistema visual, arquitetura de informação, fluxos e comportamento de interface. Especificações de componente em código (design tokens em JSON, componentes React) pertencem a um repositório de design system subsequente.

---

## 1. Filosofia de Design

### 1.1 Missão da interface

A interface do MathMaster existe para uma única finalidade: **remover tudo o que fica entre o aluno e o momento de entender**. Todo pixel compete com a compreensão do aluno pela sua atenção — e deve perder essa competição de propósito.

Isso se traduz em uma regra de design não negociável: **a interface nunca deve parecer mais inteligente que o aluno, e nunca deve parecer mais complicada que o problema em si.** Symbolab e Wolfram Alpha frequentemente erram nessa segunda frente — a densidade visual da ferramenta rivaliza com a densidade do problema. O MathMaster resolve isso com uma hierarquia visual implacável: **uma coisa de cada vez, na ordem certa, no ritmo do aluno.**

### 1.2 Valores de design

1. **Clareza acima de tudo.** Se um elemento visual não ajuda a entender, ele é ruído — é removido, não estilizado.
2. **Confiança silenciosa, não alarde.** O produto não precisa gritar "eu sou inteligente"; ele demonstra inteligência sendo previsível, correto e calmo, sessão após sessão.
3. **Ritmo do aluno, não ritmo do produto.** A interface nunca empurra o aluno adiante mais rápido do que ele processa — mas também nunca o segura quando ele já entendeu.
4. **Precisão matemática é uma questão estética.** Notação matemática mal tipografada quebra a confiança tanto quanto um erro de cálculo. Tipografia matemática correta é tratada como requisito de produto, não decoração.
5. **Progresso deve ser visível, nunca fabricado.** Toda barra, todo selo, toda conquista reflete domínio real medido pelo Learning Graph — nunca gamificação vazia desconectada de aprendizado real.
6. **Um sistema, não uma coleção de telas.** Cada componente (editor matemático, badge de confiança, bolha do mentor) se comporta de forma idêntica em qualquer lugar do produto em que aparece.

### 1.3 Como o usuário deve se sentir ao utilizar o sistema

| Momento | Sentimento-alvo |
|---|---|
| Abrindo o app pela primeira vez | Acolhido, não intimidado — "isso parece ser para mim" |
| Digitando um problema | No controle, sem fricção — "é rápido escrever o que eu quero" |
| Vendo a resposta | Aliviado e curioso — "certo, mas por quê?" |
| Lendo a explicação | Iluminado, não sobrecarregado — "ah, agora eu entendi" |
| Errando um exercício | Acolhido, não humilhado — "ok, eu vejo onde errei, faz sentido" |
| Voltando no dia seguinte | Reconhecido — "o app lembra de mim e sabe onde eu parei" |
| Vendo seu progresso semanal | Orgulhoso, com prova concreta — "eu realmente evoluí aqui" |

O fio condutor emocional é **alívio seguido de clareza seguido de orgulho** — nunca ansiedade, nunca confusão, nunca sensação de estar sendo avaliado por uma máquina fria.

### 1.4 Personalidade da marca

Se o MathMaster fosse uma pessoa: o **melhor monitor de matemática que você já teve** — competente o suficiente para nunca errar a matéria, paciente o suficiente para nunca fazer você se sentir burro, direto o suficiente para nunca enrolar, e presente o suficiente para lembrar da última vez que vocês estudaram juntos.

Em termos de arquétipos de marca, o MathMaster combina:
- **O Sábio** (Wolfram Alpha, na dimensão de rigor) — mas sem a frieza acadêmica.
- **O Cuidador** (Duolingo, na dimensão de acompanhamento) — mas sem a infantilização.
- **O Artesão** (Linear/Notion/Figma, na dimensão de polimento visual) — precisão silenciosa, nunca ostentação.

### 1.5 Emoções que queremos transmitir

**Buscamos:** clareza, calma, confiança, progresso tangível, respeito pela inteligência do usuário, sensação de continuidade ("alguém lembra de mim").

**Evitamos ativamente:** ansiedade de performance, infantilização, excesso de estímulo visual, sensação de estar "sendo vendido algo" a cada tela, frieza robótica, gamificação que soa a prêmio de participação vazio.

---

## 2. Design System

### 2.1 Princípio estrutural: dois sistemas tipográficos coexistindo

O MathMaster é um dos poucos produtos onde **texto de interface e notação matemática são dois sistemas visuais distintos que precisam conviver em perfeita harmonia** na mesma tela. Tratamos isso como uma decisão de primeira classe, não um detalhe técnico:

- **Tipografia de UI**: uma fonte humanista-geométrica sans-serif, otimizada para legibilidade em telas pequenas e alta densidade de texto curto (rótulos, botões, corpo de explicação em linguagem natural).
- **Tipografia matemática**: renderização via motor de composição matemática dedicado (família tipográfica no padrão Computer Modern/Latin Modern ou equivalente), garantindo que frações, expoentes, radicais, somatórios e integrais sigam as convenções tipográficas matemáticas reais — nunca aproximações com caracteres Unicode soltos.

A regra de convivência: **texto de UI nunca compete visualmente com notação matemática na mesma linha de leitura.** Sempre que uma fórmula aparece embutida em uma frase explicativa, ela recebe um respiro visual (padding horizontal e leve ajuste de linha) que a destaca sem quebrar o fluxo de leitura.

### 2.2 Tipografia

| Papel | Uso | Peso |
|---|---|---|
| **Display** | Títulos de marketing, telas de onboarding | Semibold/Bold |
| **Heading (H1–H4)** | Títulos de seção dentro do produto (Workspace, Dashboard, Histórico) | Semibold |
| **Body** | Explicações em linguagem natural, texto do Math Mentor | Regular/Medium |
| **UI Label** | Rótulos de botão, tabs, badges | Medium |
| **Caption** | Metadados (tempo de resolução, timestamps, contadores) | Regular, tamanho reduzido |
| **Math** | Toda notação matemática (entrada, passos, gráficos rotulados) | Motor de composição matemática dedicado, não a fonte de UI |

### 2.3 Escala de fontes

Escala modular com razão **1.250 (terça maior)**, base de 16px, garantindo hierarquia perceptível sem saltos bruscos:

| Token | Tamanho | Uso típico |
|---|---|---|
| `font.size.xs` | 12px | Caption, metadados |
| `font.size.sm` | 14px | UI Label, texto secundário |
| `font.size.base` | 16px | Corpo de texto padrão |
| `font.size.md` | 20px | Subtítulos, corpo de explicação em destaque |
| `font.size.lg` | 25px | H4 |
| `font.size.xl` | 31px | H3 |
| `font.size.2xl` | 39px | H2 |
| `font.size.3xl` | 49px | H1 / Display |
| `font.size.math.inline` | herda do `base` da linha corrente | Fórmula embutida em texto |
| `font.size.math.block` | 1.25× do `base` corrente | Fórmula em bloco de destaque (resultado final, passo ativo) |

Altura de linha (`line-height`) segue proporção 1.5 para corpo de texto e 1.2 para títulos, com exceção de blocos matemáticos, que recebem `line-height` calculado dinamicamente para acomodar frações e expoentes sem cortar.

### 2.4 Espaçamentos

Sistema de espaçamento em **unidade base de 4px**, evitando valores arbitrários em qualquer parte da interface:

| Token | Valor | Uso |
|---|---|---|
| `space.1` | 4px | Espaço entre ícone e rótulo |
| `space.2` | 8px | Padding interno de badges/chips |
| `space.3` | 12px | Padding interno de botões pequenos |
| `space.4` | 16px | Padding padrão de cards, gap entre itens de lista |
| `space.6` | 24px | Gap entre blocos dentro de uma seção |
| `space.8` | 32px | Separação entre seções dentro de uma tela |
| `space.12` | 48px | Separação entre grandes regiões (ex.: header e conteúdo) |
| `space.16` | 64px | Respiro de tela em telas de onboarding/marketing |

### 2.5 Grid

- **Grid de 12 colunas** no desktop, com gutter de `space.6` (24px) e margem lateral responsiva.
- **Container máximo de conteúdo de leitura/explicação**: 720px de largura de texto (otimizado para legibilidade de explicações longas), independentemente da largura total da tela — mesmo em monitores ultrawide, o corpo de explicação não se estica além disso (ver Seção 12).
- **Workspace matemático** (Seção 5) usa um grid de duas regiões flexíveis (entrada + resultado) que se reorganizam por breakpoint, nunca um grid de 12 colunas genérico.

### 2.6 Radius (arredondamento)

Sistema de raio com uma assinatura visual própria: **cantos suavemente arredondados em controles, mais arredondados em superfícies de conteúdo** — transmitindo a sensação "acolhedor, mas preciso".

| Token | Valor | Uso |
|---|---|---|
| `radius.sm` | 6px | Inputs, botões pequenos, chips |
| `radius.md` | 12px | Botões padrão, campos do editor matemático |
| `radius.lg` | 16px | Cards, painéis (Confidence Panel, Mentor Bubble) |
| `radius.xl` | 24px | Superfícies de destaque (card de resultado principal) |
| `radius.full` | 999px | Avatares, badges circulares, pill buttons |

### 2.7 Sombras (elevação)

Sistema de elevação sutil em 5 níveis, nunca "flat demais" (perderia hierarquia) nem "skeuomórfico demais" (competiria com a matemática). Em modo escuro, sombra é substituída por variação de luminância de superfície (ver 2.9).

| Token | Uso |
|---|---|
| `elevation.0` | Superfície de base (canvas) |
| `elevation.1` | Cards em repouso (histórico, sugestões) |
| `elevation.2` | Cards em hover/foco |
| `elevation.3` | Painéis flutuantes (Mentor Bubble, tooltips ricos) |
| `elevation.4` | Modais, confirmação de ações críticas |

### 2.8 Ícones

- Conjunto de ícones **próprio e exclusivo**, com traço de 1.5px, cantos levemente arredondados — ecoando o `radius.sm/md` do sistema, para que ícone e controle pareçam desenhados pela mesma mão.
- Ícones matemáticos (função, derivada, integral, matriz, gráfico) são tratados como uma **subfamília dedicada**, desenhados para não conflitar visualmente com a notação matemática real renderizada ao lado deles.
- Tamanho padrão de 20px em contexto de UI densa, 24px em navegação principal, nunca menor que 16px (limite de legibilidade).

### 2.9 Cores

#### Paleta primitiva (tokens de marca)

| Papel | Nome do token | Descrição |
|---|---|---|
| Cor de marca primária | `color.brand.primary` (Índigo "Mentor") | Usada em ações primárias, elementos de identidade, foco do Math Mentor |
| Cor de marca secundária | `color.brand.secondary` (Verde "Domínio") | Usada exclusivamente para sinalizar domínio/confiança/acerto — nunca decorativa |
| Cor de alerta | `color.brand.warning` (Âmbar) | Confiança média, atenção necessária |
| Cor de erro pedagógico | `color.brand.error` (Terracota, não vermelho puro) | Sinaliza erro do aluno de forma corretiva, não punitiva — deliberadamente mais quente e menos agressivo que um vermelho de erro de sistema |
| Neutros | `color.neutral.0…900` | Escala de cinzas com leve tintura fria, base de toda a superfície de UI |

A escolha de **não usar vermelho puro** para erro do aluno é uma decisão deliberada de filosofia de design (Seção 1.3): o produto corrige, não pune.

#### Tokens semânticos (consumidos pelos componentes)

| Token semântico | Mapeamento (Light) | Mapeamento (Dark) |
|---|---|---|
| `color.bg.canvas` | `neutral.0` | `neutral.900` |
| `color.bg.surface` | `neutral.50` | `neutral.850` |
| `color.bg.surface-raised` | branco puro | `neutral.800` |
| `color.text.primary` | `neutral.900` | `neutral.50` |
| `color.text.secondary` | `neutral.600` | `neutral.300` |
| `color.border.default` | `neutral.200` | `neutral.700` |
| `color.confidence.high` | `brand.secondary` (verde) | `brand.secondary` (ajustado de luminância) |
| `color.confidence.medium` | `brand.warning` | `brand.warning` (ajustado) |
| `color.confidence.low` | `brand.error` | `brand.error` (ajustado) |
| `color.mentor.accent` | `brand.primary` | `brand.primary` (ajustado) |

### 2.10 Dark Mode e Light Mode

- Ambos os modos são **cidadãos de primeira classe**, não um modo "invertido automaticamente" — cada superfície e sombra é recalibrada manualmente para manter contraste e hierarquia (RNF-07/Seção 11).
- **Dark Mode não é apenas fundo escuro**: a paleta de confiança (verde/âmbar/terracota) é reajustada de saturação para não "brilhar" excessivamente sobre fundo escuro, mantendo a mesma leitura emocional em ambos os modos.
- Gráficos e renderização matemática (Seção 5/6) têm paleta própria adaptada por modo, garantindo que curvas, eixos e anotações mantenham contraste AA mínimo em ambos os temas.
- O modo é detectado por preferência do sistema operacional por padrão, com opção manual de override persistida no perfil do usuário.

### 2.11 Tokens de design — arquitetura em camadas

Seguimos uma arquitetura de tokens em três camadas, essencial para escalabilidade (RNF-10 do ARCHITECTURE.md aplicado ao design):

1. **Tokens primitivos** (`color.indigo.500`, `space.4`) — valores brutos, sem significado semântico.
2. **Tokens semânticos** (`color.text.primary`, `color.confidence.high`) — significado de uso, mapeados aos primitivos, o que muda entre light/dark.
3. **Tokens de componente** (`button.primary.bg`, `mentorBubble.border-radius`) — mapeados aos semânticos, permitindo que um componente específico evolua sem afetar o resto do sistema.

Essa camada tripla é o que permite, por exemplo, lançar um tema institucional (marca-branca para uma escola parceira, Roadmap B2B) trocando apenas a camada semântica, sem tocar em nenhum componente.

### 2.12 Componentes reutilizáveis (inventário núcleo)

| Componente | Papel |
|---|---|
| **MathInput** | Editor matemático estruturado (Seção 5/11 do ARCHITECTURE.md) |
| **StepCard** | Um passo individual de resolução, expansível |
| **ConfidenceBadge / ConfidencePanel** | Indicador e painel expandido do Confidence Engine |
| **ExplainLikeSwitcher** | Seletor de registro de explicação |
| **GraphCanvas** | Área de plotagem interativa |
| **MentorBubble** | Unidade de fala do Math Mentor, com variantes (proativa, reativa, celebrativa, corretiva) |
| **LearningNode / LearningGraphMap** | Representação visual de um conceito e do mapa completo |
| **HistoryEntry** | Item de histórico de problema resolvido |
| **SuggestionCard** | Card de sugestão de exercício/tópico |
| **XPBar / StreakIndicator** | Elementos de progresso e gamificação |
| **EmptyState** | Estado vazio ilustrado (histórico vazio, Learning Graph não iniciado) |
| **Toast / InlineConfirmation** | Feedback de ação (salvo, copiado, exercício concluído) |

Todos os componentes são desenhados **mobile-first**, com variantes de densidade (compact/comfortable) para adaptação a diferentes breakpoints (Seção 12), nunca componentes distintos por plataforma.

---

## 3. Jornada do Usuário

A jornada é desenhada como uma **espiral, não uma linha reta**: o aluno entra, resolve, entende, pratica e volta — e cada volta da espiral é mais rica porque o sistema já sabe mais sobre ele (Learning Graph + AI Memory).

### 3.1 Primeira visita

O aluno chega (geralmente via busca por um problema específico ou indicação). A tela de entrada **não pede cadastro antes de demonstrar valor** — o campo matemático está imediatamente visível e utilizável em modo convidado. Objetivo: reduzir a distância entre "cheguei" e "vi o produto funcionar" ao mínimo absoluto.

### 3.2 Primeira expressão matemática

O aluno digita, fotografa ou cola um problema. A interface reage com **feedback imediato de reconhecimento** (a expressão aparece renderizada corretamente, com uma pequena confirmação "é isso que você quis dizer?"). Esse é o primeiro momento de confiança — se o produto interpreta corretamente, a confiança para os próximos passos é estabelecida.

### 3.3 Resultado

A resposta aparece **primeiro e sozinha**, em destaque tipográfico máximo, antes de qualquer passo a passo — respeitando que muitos usuários, no primeiro contato, só querem confirmar "cheguei perto?". O caminho para a explicação está a um clique/scroll de distância, nunca escondido, nunca forçado.

### 3.4 Explicação

Ao expandir, o passo a passo aparece progressivamente (streaming, conforme ARCHITECTURE.md Seção 5.1/9.2), no registro padrão do Explain Like.... O aluno percebe que pode trocar o registro sem perder o lugar onde está lendo.

### 3.5 Gráfico

Quando aplicável, o gráfico aparece como uma **visualização companion**, não como uma tela separada — ele existe ao lado da explicação, sincronizado (ex.: passar o mouse sobre um passo destaca a parte correspondente do gráfico).

### 3.6 Exercícios

Ao final da explicação, o sistema oferece — sem insistência — um exercício semelhante para praticar. Esta é a primeira semente visível do Learning Graph.

### 3.7 Histórico

O problema resolvido já está automaticamente salvo (se autenticado) ou oferecido para salvar (se convidado, como gancho sutil de cadastro). O histórico nunca é uma "gaveta" separada e esquecida — ele é referenciado ativamente pelo Math Mentor em sessões futuras.

### 3.8 Retorno diário

Ao voltar, o aluno não recomeça do zero: a Home já reflete a AI Memory (Seção 4) — "continue de onde parou" é a primeira coisa visível, não a última. É o momento em que a espiral se fecha e reabre em um nível mais alto.

---

## 4. Home

### 4.1 Layout geral

Layout de três regiões (desktop): **Sidebar de navegação fixa (esquerda) + Área principal central + Painel contextual (direita, colapsável)**. Em mobile, colapsa para navegação inferior (Seção 12).

### 4.2 Header

Minimalista e persistente: logo/wordmark à esquerda, campo de busca/entrada rápida ao centro (atalho global para iniciar uma resolução de qualquer lugar do produto), avatar/menu de conta e indicador de sequência de estudo (streak) à direita. O header **nunca cresce em altura** — é uma faixa de referência constante, nunca competindo por atenção com o conteúdo.

### 4.3 Sidebar

Itens de navegação primária: **Workspace (resolver)**, **Learning Dashboard**, **Histórico**, **Trilhas de Estudo**, e, quando aplicável, **Turma** (contas institucionais). Ícone + rótulo, com estado colapsado (somente ícone) disponível para usuários que preferem mais espaço de tela — preferência persistida no perfil.

### 4.4 Área principal

Estruturada em três blocos verticais, em ordem deliberada de prioridade:

1. **Bloco de retomada** ("Continue de onde parou" — vindo da AI Memory): o bloco mais proeminente da Home, sempre que existir uma sessão em aberto.
2. **Campo matemático de entrada rápida**: um convite direto e grande para começar algo novo, mesmo que o usuário tenha uma sessão para retomar.
3. **Grade de cards secundários**: sugestões do Math Mentor, histórico recente, resumo do Learning Dashboard.

### 4.5 Barra de pesquisa / campo matemático

Um único componente inteligente que aceita tanto **linguagem natural** ("como resolver equação do segundo grau") quanto **entrada matemática estruturada** — o sistema detecta a intenção e roteia internamente (busca de conteúdo de trilha vs. resolução direta de um problema), sem exigir que o aluno saiba qual "modo" usar.

### 4.6 Cards

Sistema de cards unificado (`SuggestionCard`, `HistoryEntry`) com hierarquia visual consistente: título do conceito/problema, metadado leve (tempo atrás, nível de domínio, ou tipo de sugestão), e uma única ação primária clara por card — nunca múltiplos botões competindo dentro do mesmo card.

### 4.7 Sugestões

Geradas pelo Math Mentor a partir do cruzamento Learning Graph + AI Memory (ARCHITECTURE.md Seção 20.2), apresentadas com uma frase curta de justificativa humana (“Porque você ainda está consolidando fatoração”) — nunca uma recomendação sem explicação, o que geraria desconfiança.

### 4.8 Histórico recente

Uma faixa horizontal compacta (não uma lista longa) dos últimos 3–5 problemas, com acesso rápido ao histórico completo — a Home nunca tenta ser a tela de histórico completa.

### 4.9 Dashboard de aprendizado (resumo)

Uma versão condensada do Learning Dashboard completo (Seção 8): um anel/barra de progresso geral, o streak atual, e um único destaque de conquista recente — convidando ao aprofundamento sem duplicar a tela completa.

---

## 5. Workspace Matemático

### 5.1 Princípio central: uma superfície, múltiplas portas de entrada

O Workspace é desenhado como **uma única superfície de entrada com múltiplos modos de captura coexistentes**, não telas separadas por método de entrada. O aluno nunca precisa "escolher entre digitar ou fotografar" como uma decisão de navegação — todos os modos estão disponíveis simultaneamente a partir do mesmo campo:

- **Digitação estruturada** (MathInput / teclado matemático virtual) como modo padrão sempre visível.
- **Desenho** (à mão livre, mouse/trackpad ou caneta em tablet) disponível via alternância de modo dentro do mesmo campo, útil para geometria e notação livre.
- **Fotografar** e **colar imagem** acessíveis por um único botão de anexo, que aceita câmera, arquivo ou colagem (Ctrl/Cmd+V) de forma indistinta.
- **Enviar PDF** tratado como um caso do mesmo botão de anexo (múltiplas páginas navegáveis antes da confirmação de OCR).
- **Escrever em LaTeX** disponível como um modo de "poder" (power user), alternável a qualquer momento — o que for digitado em LaTeX é imediatamente refletido no MathInput estruturado e vice-versa, os dois modos são **duas visualizações do mesmo AST**, nunca sistemas paralelos.

### 5.2 Layout

Tela dividida em duas regiões que se ajustam dinamicamente:

- **Região de entrada** (superior/esquerda): onde o problema é construído/capturado.
- **Região de pré-visualização e confirmação**: mostra a interpretação renderizada em tempo real, incluindo o passo de confirmação de OCR (ARCHITECTURE.md RF-03) quando aplicável — nunca a resolução avança sem essa confirmação explícita.

Ao confirmar, a região de entrada recolhe suavemente (não desaparece abruptamente) e dá lugar à tela de Resultado (Seção 6), mantendo a expressão confirmada visível no topo como âncora de contexto.

### 5.3 Limpeza como funcionalidade

O Workspace é a tela com **menor densidade de elementos de chrome** (menu, decoração, navegação secundária) de todo o produto — a Sidebar pode se auto-colapsar ao entrar em modo de resolução ativa, e reaparece com um gesto simples, priorizando a superfície de trabalho matemático acima de tudo.

---

## 6. Resultado

### 6.1 Princípio de organização: divulgação progressiva

A tela de Resultado segue rigorosamente o princípio de **divulgação progressiva** (progressive disclosure): nem todo o conteúdo listado pelo requisito (resposta, passo a passo, conceitos, explicação, erros comuns, exercícios, vídeos, gráfico, tempo, dificuldade, confiança) aparece com o mesmo peso visual ao mesmo tempo.

**Camada 1 — sempre visível, acima da dobra:**
- Resposta final (destaque tipográfico máximo).
- Indicador de confiança compacto (`ConfidenceBadge`).
- Gráfico, quando aplicável (companion visual, Seção 3.5).
- Metadados leves: tempo de resolução e nível de dificuldade, apresentados como pequenos badges discretos ao lado da resposta — informativos, nunca competindo com ela.

**Camada 2 — um clique/scroll de distância:**
- Passo a passo completo (`StepCard` expansíveis).
- Conceitos matemáticos utilizados (chips clicáveis, cada um linkando ao nó correspondente no Learning Graph).
- Explicação completa da IA no registro ativo do Explain Like....

**Camada 3 — contextual, oferecida no momento certo (não empurrada):**
- Erros comuns relacionados a este tipo de problema (aparece como um card discreto ao final da explicação, com tom de "aliás, isso costuma confundir" — nunca alarmista).
- Exercícios semelhantes (aparece após o aluno demonstrar ter consumido a explicação — scroll até o fim ou expansão do último passo).
- Vídeos recomendados (aparece apenas se o aluno interagir com "quero ver de outra forma" — é um recurso de reforço, não um elemento padrão de poluição de tela).

**Camada 4 — sob demanda explícita:**
- Painel expandido do Confidence Engine (detalhamento completo de método de validação) — acessível ao clicar no `ConfidenceBadge`, nunca aberto por padrão, pois é informação para o momento de dúvida/verificação, não para o fluxo padrão de aprendizado.

### 6.2 Por que essa hierarquia

Um usuário em cima de uma prova quer a resposta e a confiança em 2 segundos. Um usuário estudando para entender quer a explicação em 20 segundos. Um usuário revisando antes do vestibular quer o Confidence Engine detalhado e os erros comuns em 2 minutos. A tela de Resultado serve aos três com **a mesma estrutura, em camadas diferentes de profundidade**, nunca com três telas diferentes.

### 6.3 Layout visual

- Coluna central única em mobile; em desktop, o gráfico e o painel de confiança podem viver em uma coluna lateral direita persistente enquanto o passo a passo rola na coluna principal — permitindo referência cruzada sem perder contexto.
- Cada `StepCard` é numerado, com o conceito matemático daquele passo etiquetado discretamente (chip pequeno), permitindo ao aluno escanear visualmente "onde" no processo está o conceito que ele não entende, antes mesmo de ler o texto.

---

## 7. Math Mentor

### 7.1 Como ele conversa

O Math Mentor fala em **frases curtas, na segunda pessoa, sem jargão de produto** ("Você já mandou bem em equações do 1º grau — bora tentar uma do 2º?" em vez de "Recomendação de conteúdo disponível"). O tom é o de um monitor de confiança: nunca infantilizado, nunca corporativo.

Regra de ouro de copywriting: **o Mentor nunca fala sobre si mesmo, sempre fala sobre o aluno e a matemática.** Nunca "Eu sou seu assistente de IA"; sempre "Você está indo bem em...".

### 7.2 Quando aparece

- **Ao final de uma explicação**, com uma sugestão contextual leve (Camada 3, Seção 6.1).
- **No retorno após inatividade** (Seção 3.8), com a proposta de retomada.
- **Ao detectar um erro recorrente** (`RecurringMistakeDetected`, ARCHITECTURE.md Seção 20.2), com uma intervenção gentil e específica.
- **Ao atingir um marco real** no Learning Graph (ex.: domínio completo de um tópico), com uma celebração breve.
- **Na Home**, como origem das sugestões (Seção 4.7), sempre com justificativa.

### 7.3 Quando NÃO aparece

- **Nunca durante a digitação ativa** de uma expressão — o Mentor não interrompe o ato de escrever matemática.
- **Nunca durante a leitura de uma explicação em andamento** (streaming) — ele espera o conteúdo terminar de aparecer.
- **Nunca mais de uma vez por sessão de forma proativa não solicitada** — evitando fadiga de notificação; o aluno sempre pode abrir o Mentor manualmente a qualquer momento além disso.
- **Nunca com um pop-up modal bloqueante.** O Mentor se manifesta exclusivamente através do `MentorBubble`, um elemento ancorado (canto da tela ou embutido no fluxo), nunca uma interrupção que exige dispensar antes de continuar.

### 7.4 Como corrige

Ao identificar um erro do aluno, o Mentor segue uma estrutura fixa de três partes, sempre nessa ordem: **(1) validação** ("Você chegou bem até aqui") → **(2) localização exata do erro** ("O deslize foi neste passo, ao trocar o sinal") → **(3) ponte para o conceito correto**, nunca apenas "está errado". Essa estrutura vem diretamente do diagnóstico de erro do Confidence/Math Engine (ARCHITECTURE.md Seção 8.4), traduzido para linguagem acolhedora.

### 7.5 Como motiva

A motivação do Mentor é **sempre ancorada em um fato do Learning Graph**, nunca genérica. Em vez de "Mandou bem!", ele diz "Você já resolveu 8 equações do 2º grau seguidas sem erro de sinal — isso já não te derruba mais." Motivação com evidência é mais duradoura do que elogio vazio, e é consistente com o valor de design da Seção 1.2.5 (progresso nunca fabricado).

### 7.6 Como evita interromper o usuário

O Mentor opera sob um "orçamento de interrupção": no máximo uma manifestação proativa por sessão de estudo ativa, sempre ancorada (nunca modal), sempre dispensável com um único gesto, e sempre reversível (o aluno pode reabrir a última mensagem do Mentor a qualquer momento pelo ícone persistente no header/sidebar).

---

## 8. Learning Dashboard

### 8.1 Mapa de conhecimento

Visualização do **Learning Graph pessoal** como um mapa navegável (não uma lista): nós representam conceitos, coloridos por nível de domínio (do neutro/não explorado ao verde de domínio pleno), conectados por linhas que representam pré-requisitos. O aluno pode dar zoom, focar em uma área (ex.: "Álgebra") e ver exatamente qual conceito específico está barrando o próximo.

### 8.2 Evolução

Um gráfico de linha simples (não um dashboard de BI complexo) mostrando o crescimento do domínio médio ao longo do tempo — a métrica central de "estou realmente melhorando" traduzida visualmente, atualizado com cada `LearningGraphNodeUpdated`.

### 8.3 Sequência de estudos (streak)

Indicador de dias consecutivos de estudo, desenhado para reforçar consistência **sem ansiedade de perda** — ao contrário de apps que punem visualmente uma sequência quebrada, o MathMaster trata uma pausa como dado neutro ("sua sequência anterior foi de 12 dias" em vez de um ícone de "sequência perdida" alarmante).

### 8.4 Tempo estudado

Total acumulado e média semanal, apresentado de forma discreta — é informação de acompanhamento, não uma métrica de vaidade que o produto tenta maximizar de forma manipuladora.

### 8.5 Domínio por assunto

Lista/grade de grandes áreas (Álgebra, Cálculo, Trigonometria, Estatística, Álgebra Linear) com barra de domínio agregado por área, servindo como ponto de entrada para o mapa detalhado (Seção 8.1) filtrado por área.

### 8.6 Conquistas

Apresentadas como uma prateleira discreta, não uma tela cheia de emblemas — cada conquista é sempre acompanhada do fato concreto que a originou (ver Seção 9, princípio "sem infantilizar").

### 8.7 Recomendações

Lista curta (3 itens no máximo visíveis por padrão) do que o Math Mentor sugere estudar a seguir, cada item com a mesma justificativa contextual da Seção 4.7 — nunca uma lista longa e genérica de "conteúdo relacionado".

### 8.8 Objetivos

Metas que o próprio aluno pode definir (ex.: "Quero dominar Funções até o dia da prova, 2026-08-15") — o Dashboard mostra a distância atual até o objetivo em termos de nós do Learning Graph ainda não dominados, dando ao aluno uma medida honesta de quanto falta, não apenas uma data no calendário.

---

## 9. Gamificação

### 9.1 Filosofia: gamificação como espelho, não como isca

Toda a camada de gamificação do MathMaster segue uma regra estrita: **nenhum elemento de jogo pode existir sem estar ancorado em um dado real do Learning Graph ou da AI Memory.** Isso é o que separa gamificação madura (Duolingo em seus melhores momentos, Linear com seus insights de produtividade) de gamificação vazia (badges por login).

### 9.2 XP

XP é ganho **proporcionalmente à dificuldade real do problema resolvido e ao esforço demonstrado** (ex.: resolver sem erro, ou corrigir o próprio erro identificado), não por volume bruto de cliques. Isso evita o "farming" de XP em problemas triviais, que corroeria o significado do número.

### 9.3 Níveis

Níveis do aluno são amarrados a marcos reais de domínio agregado no Learning Graph (não a um contador arbitrário de XP desconectado) — subir de nível sempre corresponde a algo que o aluno genuinamente passou a saber fazer.

### 9.4 Conquistas

Divididas em duas famílias visuais distintas para não se confundirem:
- **Conquistas de domínio** (ligadas ao Learning Graph — "Dominou Fatoração").
- **Conquistas de hábito** (ligadas à AI Memory/consistência — "Estudou 5 dias seguidos").

Nunca misturadas na mesma prateleira sem distinção visual clara, para que o aluno sempre saiba se está sendo reconhecido por saber mais ou por ser consistente.

### 9.5 Missões

Sequências curtas e objetivas geradas pelo Math Mentor (ex.: "Resolva 3 problemas de derivadas por regra do produto para consolidar este conceito") — sempre com prazo flexível e nunca com penalidade por não concluir, apenas com "essa missão ainda está disponível" em vez de "você falhou".

### 9.6 Sequências (streaks)

Ver Seção 8.3 — tratadas com o mesmo cuidado anti-ansiedade em toda a superfície do produto, não apenas no Dashboard.

### 9.7 Desafios

Desafios cronometrados opcionais (ligados ao futuro modo de simulado do PRD), sempre **opt-in explícito**, nunca aparecendo como pressão default sobre o fluxo normal de estudo.

### 9.8 Sistema de progresso

A barra/anel de progresso central do produto é sempre lida em conjunto com uma frase de contexto ("62% de domínio em Funções — faltam 3 conceitos") — nunca um número solto sem significado imediatamente legível.

### 9.9 Como evitar infantilização

- Paleta de gamificação usa os mesmos tokens de cor semântica do resto do produto (Seção 2.9), nunca uma paleta "arco-íris" separada.
- Nenhum personagem mascote, confete excessivo ou som que soe a aplicativo infantil — celebração é expressa por microinterações sutis (Seção 10), tipografia e cor, não por elementos decorativos.
- Linguagem de conquistas é redigida no registro adulto/neutro por padrão, com a possibilidade de um tom mais lúdico apenas dentro do perfil declarado de faixa etária mais jovem (configurável, nunca assumido).

---

## 10. Microinterações

### 10.1 Princípio: toda animação comunica estado, nenhuma decora

Cada microinteração no MathMaster existe para responder a uma pergunta implícita do usuário ("isso funcionou?", "está carregando?", "posso clicar aqui?") — nunca para "dar vida" gratuitamente à interface.

### 10.2 Animações

Durações curtas (150–250ms) com curva de easing suave (ease-out para entradas, ease-in para saídas), consistentes em todo o produto. Transições de conteúdo matemático (ex.: um passo se expandindo) usam uma leve animação de altura + fade, nunca animações "chamativas" (bounce, zoom exagerado) que trivializariam o conteúdo sério que está sendo exibido.

### 10.3 Hover

Em desktop, todo elemento interativo tem um estado de hover sutil (leve elevação ou mudança de tom de superfície) — nunca uma mudança de cor abrupta. Chips de conceito (Seção 6.3) têm hover que antecipa visualmente a navegação para o Learning Graph, criando uma conexão perceptível entre a explicação e o mapa de conhecimento.

### 10.4 Loading

- **Resolução matemática**: um indicador leve e determinado (não um spinner genérico infinito) — como a resposta costuma chegar rápido (RNF-01), o loading é desenhado para não ser percebido como demora, usando um estado de "esqueleto" (skeleton) da própria estrutura do resultado.
- **Geração de explicação (streaming)**: não há "loading" tradicional — o texto aparece progressivamente, o que por si só comunica atividade em andamento (Seção 3.4), reduzindo a percepção de espera a praticamente zero.
- **OCR**: indicador específico com etapas nomeadas ("lendo a imagem" → "reconhecendo símbolos" → "pronto para confirmar"), já que esse processo pode levar alguns segundos e o aluno precisa entender o que está acontecendo.

### 10.5 Feedback visual

Toda ação do usuário recebe confirmação em menos de 100ms, mesmo que a operação de fundo demore mais — um clique em "salvar no histórico" muda o ícone/estado imediatamente de forma otimista, com reconciliação silenciosa caso a operação de backend falhe (com um toast discreto apenas em caso de erro real).

### 10.6 Transições

Transições entre telas principais (Home → Workspace → Resultado) usam continuidade visual: o campo de entrada do Workspace se transforma suavemente no cabeçalho de contexto da tela de Resultado, em vez de uma troca de tela abrupta — reforçando que é uma jornada contínua, não páginas desconectadas.

### 10.7 Estados vazios

Cada tela com dado ausente (Histórico vazio, Learning Graph não iniciado, Dashboard de um usuário novo) tem um estado vazio desenhado com propósito: nunca apenas "Nada aqui ainda", sempre com uma ação clara de próximo passo ("Resolva seu primeiro problema para começar a ver seu progresso aqui").

### 10.8 Mensagens

Mensagens de erro do sistema (não do aluno matematicamente, mas erros técnicos — ex.: falha de rede) são redigidas em linguagem humana, nunca códigos de erro crus, com uma ação de recuperação clara ("Tentar novamente").

### 10.9 Confirmações

Ações destrutivas (apagar histórico, apagar AI Memory — RF-19) usam confirmação explícita de dois passos, com linguagem específica do que será perdido (nunca um genérico "Tem certeza?") — coerente com o requisito de governança de dados do ARCHITECTURE.md (RNF-13).

---

## 11. Acessibilidade

### 11.1 Contraste

Todos os pares de cor de texto/fundo definidos nos tokens semânticos (Seção 2.9) são validados para **WCAG 2.1 AA** como piso mínimo, com meta de AAA para texto de corpo principal onde viável sem comprometer a paleta de marca.

### 11.2 Leitores de tela

- Toda notação matemática renderizada é acompanhada de uma **anotação semântica paralela** (MathML/descrição estruturada), permitindo que leitores de tela leiam a expressão de forma matematicamente correta ("x ao quadrado", não "x 2 pequeno"), não apenas leiam o LaTeX bruto.
- O `MentorBubble` e o `ConfidencePanel` são anunciados como regiões live (ARIA live regions) apropriadas, sem interromper abruptamente o que o leitor de tela já estava lendo.

### 11.3 Navegação por teclado

O `MathInput` é totalmente operável por teclado (incluindo construção de frações, expoentes e demais estruturas via atalhos previsíveis, não apenas mouse), e toda a jornada crítica (resolver um problema, revisar o passo a passo, alternar Explain Like...) é navegável sem mouse, com foco visível e ordem de tabulação lógica.

### 11.4 Zoom

A interface suporta zoom de texto do navegador/sistema até 200% sem quebra de layout (sem sobreposição de elementos ou corte de conteúdo), validado especificamente nas telas de maior densidade (Resultado, Learning Dashboard).

### 11.5 Daltonismo

A paleta de confiança (verde/âmbar/terracota, Seção 2.9) **nunca depende apenas da cor** para comunicar significado — cada estado de confiança carrega também um ícone e um rótulo textual, garantindo leitura correta para os tipos mais comuns de daltonismo (deuteranopia, protanopia).

### 11.6 Responsividade como requisito de acessibilidade

Tratada tecnicamente na Seção 12, mas vale registrar aqui: a capacidade de usar o produto confortavelmente em um celular de tela pequena, em condições de luz variável (uso noturno comum do público-alvo), é considerada parte do compromisso de acessibilidade do produto, não apenas uma questão de layout.

---

## 12. Responsividade

### 12.1 Princípio: reflow de prioridade, não apenas de layout

Cada breakpoint não apenas reorganiza elementos — **reordena prioridades** conforme o contexto de uso real esperado naquele dispositivo (ex.: mobile prioriza captura rápida via câmera; desktop prioriza leitura lado a lado de explicação e gráfico).

### 12.2 Desktop

Layout de três regiões completo (Seção 4.1). Workspace e Resultado podem exibir gráfico/Confidence Panel em coluna lateral persistente, permitindo referência cruzada sem scroll.

### 12.3 Tablet

Sidebar colapsa para um menu acessível por gesto/ícone; Workspace e Resultado adotam layout de coluna única com o gráfico/painel lateral tornando-se uma seção expansível inline, preservando a lógica de camadas da Seção 6.1. O modo de desenho (Seção 5.1) ganha destaque proporcional maior aqui, dado o uso comum de caneta em tablets.

### 12.4 Celular

Navegação principal migra para uma barra inferior (Home, Workspace, Dashboard, Histórico) — mais alcançável com o polegar. O Workspace prioriza o botão de captura por câmera como ação mais proeminente (reflexo do padrão de uso real: foto do caderno à noite, PRD Persona "Ana"). A tela de Resultado é estritamente de coluna única, com o gráfico exibido em largura total acima do passo a passo.

### 12.5 Monitores ultrawide

O conteúdo **nunca se estica para preencher toda a largura**: o corpo de leitura/explicação mantém o container máximo de 720px (Seção 2.5), centralizado, com o espaço lateral extra aproveitado para **contexto adicional persistente** (Learning Graph em miniatura, Confidence Panel, navegação de histórico da sessão) — nunca para simplesmente aumentar a fonte ou esticar cards, o que prejudicaria a leitura.

---

## 13. Fluxos Completos

### 13.1 Resolvendo uma equação

1. Aluno abre o Workspace, digita a equação via `MathInput`.
2. Pré-visualização confirma a expressão em tempo real.
3. Aluno confirma (ou o sistema avança automaticamente após uma pequena pausa de digitação, com opção de editar).
4. Tela de Resultado exibe a resposta e o `ConfidenceBadge` imediatamente.
5. Aluno expande o passo a passo; cada `StepCard` é lido em ordem.
6. Ao final, um `SuggestionCard` de exercício semelhante aparece.
7. O problema é salvo automaticamente no Histórico; o Learning Graph é atualizado silenciosamente em segundo plano.

### 13.2 Resolvendo uma integral

Idêntico ao fluxo 13.1, com duas diferenças de interface: (a) o `GraphCanvas` aparece com a região da integral visualmente destacada (sombreada) de forma sincronizada ao passo correspondente do passo a passo; (b) o `ConfidenceBadge`, quando a integral envolve alguma técnica com premissas (ex.: substituição, domínio de convergência), abre por padrão uma nota curta e visível de "premissa assumida" na Camada 1 (não escondida na Camada 4), por ser informação crítica de confiança nesse tipo de problema.

### 13.3 Enviando imagem

1. Aluno toca no botão de anexo no Workspace, escolhe câmera.
2. Captura a foto; um recorte assistido sugere a região do problema.
3. Estado de loading nomeado por etapas (Seção 10.4) é exibido.
4. A expressão reconhecida aparece na região de pré-visualização, editável no `MathInput` caso haja erro de reconhecimento.
5. Aluno confirma; o fluxo converge com 13.1 a partir daqui.

### 13.4 Conversando com a IA (Math Mentor)

1. Aluno abre o Mentor manualmente (ícone persistente) ou responde a uma manifestação proativa (Seção 7.2).
2. A conversa ocorre em um painel ancorado (não tela cheia), preservando o contexto do que estava sendo estudado visível ao fundo.
3. Respostas do Mentor referenciam explicitamente dados do Learning Graph/AI Memory quando pertinente (Seção 7.5), nunca genéricas.
4. O aluno pode fechar o painel a qualquer momento sem perder o estado da conversa (retomável).

### 13.5 Revendo histórico

1. Aluno acessa o Histórico completo pela Sidebar.
2. Lista filtrável por tópico/data/nível de confiança da resposta.
3. Ao abrir um item, a tela de Resultado original é reconstruída exatamente como estava (mesmo registro de Explain Like... usado da última vez).
4. Aluno pode reabrir a explicação, ou pedir ao Mentor um exercício semelhante diretamente a partir do item histórico.

### 13.6 Aprendendo um novo assunto

1. Aluno acessa Trilhas de Estudo ou clica em um nó não explorado do Learning Graph no Dashboard.
2. É apresentada uma sequência curta e progressiva de problemas, com dificuldade calibrada pelo Math Mentor.
3. Cada problema resolvido atualiza o nó em tempo real, visível como pequena animação de progresso no próprio mapa (reforço visual imediato de avanço).
4. Ao concluir a sequência, uma conquista de domínio (Seção 9.4) é apresentada, ancorada no fato real de progresso alcançado.

---

## 14. Benchmark

### 14.1 Symbolab

- **Onde eles pecam**: explicação passo a passo genérica e motor-cêntrica; paywall agressivo escondendo passos essenciais; densidade visual alta, com anúncios competindo por atenção.
- **Onde o MathMaster supera**: explicação adaptativa por registro (Explain Like...) sempre acessível no plano gratuito para o essencial; interface sem anúncios competindo com o conteúdo matemático; Confidence Engine, algo que o Symbolab simplesmente não possui.

### 14.2 Desmos

- **Onde eles se destacam**: excelente motor de gráficos interativos, extremamente polido para plotagem exploratória.
- **Onde o MathMaster supera**: o Desmos não resolve nem explica problemas — é uma calculadora gráfica, não um tutor. O MathMaster incorpora a mesma qualidade de interatividade gráfica (`GraphCanvas`, Seção 6) como *parte* de uma experiência de compreensão completa, não como o produto inteiro.

### 14.3 Wolfram Alpha

- **Onde eles se destacam**: rigor computacional e amplitude de domínio quase enciclopédica.
- **Onde o MathMaster supera**: Wolfram Alpha apresenta tudo com a mesma densidade técnica independentemente do usuário — não existe adaptação de registro nem noção de "quem está perguntando". O MathMaster iguala o rigor (mesmo motor de classe SymPy/NumPy/SciPy) mas adapta radicalmente a apresentação (Explain Like..., Learning Graph, Math Mentor) — rigor de especialista com legibilidade de iniciante, quando necessário.

### 14.4 Microsoft Math Solver

- **Onde eles se destacam**: gratuito, OCR razoável, integração ampla com o ecossistema Microsoft.
- **Onde o MathMaster supera**: ausência total de personalização, memória ou tutoria contínua no Math Solver — cada problema é uma ilha. O MathMaster constrói continuidade real (AI Memory, retomada de estudo, Learning Graph) que transforma uso pontual em hábito de estudo.

### 14.5 ChatGPT (uso genérico para matemática)

- **Onde ele se destaca**: conversação fluida, flexibilidade de linguagem natural, disponibilidade universal.
- **Onde o MathMaster supera**: ChatGPT (e LLMs de propósito geral) podem alucinar em cálculo simbólico complexo, e não expõem nenhum mecanismo de verificação determinística nem de confiança explicada — o usuário precisa confiar cegamente. O MathMaster nunca deixa a matemática por conta apenas do modelo de linguagem (ARCHITECTURE.md Seção 1.1); todo resultado é validado deterministicamente antes de qualquer texto ser gerado, e essa validação é visível e explicada (Confidence Engine) — uma garantia estrutural que uma conversa de chat genérica não pode oferecer.

### 14.6 Síntese comparativa

| Dimensão | Symbolab | Desmos | Wolfram Alpha | MS Math Solver | ChatGPT | **MathMaster** |
|---|---|---|---|---|---|---|
| Rigor matemático | Alto | N/A (gráficos) | Altíssimo | Médio | Variável/risco de alucinação | Alto, com verificação determinística |
| Explicação adaptada ao aluno | Não | N/A | Não | Parcial | Sim (mas sem verificação) | **Sim, com verificação** |
| Transparência de confiança | Não | N/A | Não | Não | Não | **Sim (Confidence Engine)** |
| Memória/continuidade | Não | Não | Não | Não | Limitada, sem estrutura pedagógica | **Sim (AI Memory + Learning Graph)** |
| Tutoria personalizada | Não | Não | Não | Não | Genérica | **Sim (Math Mentor)** |
| Gráficos interativos | Básico | Excelente | Bom | Básico | Não | **Bom, integrado à explicação** |
| Experiência sem anúncios/paywall agressivo | Não | Sim | Parcial | Sim | Sim | **Sim (freemium ético)** |

---

## 15. Futuro

### 15.1 IA multimodal em tempo real

Evoluir o Math Mentor para aceitar **voz e imagem simultaneamente em uma conversa contínua** — o aluno aponta a câmera para o caderno e pergunta em voz alta "por que eu errei aqui?", recebendo resposta falada e visual ao mesmo tempo, sem etapas separadas de "primeiro tire a foto, depois digite a pergunta".

### 15.2 Realidade aumentada para geometria e gráficos 3D

Um modo de **visualização em AR** (via câmera do celular) para sólidos geométricos, superfícies de funções de duas variáveis e interseções — permitindo que o aluno "gire ao redor" de um paraboloide ou de uma interseção de planos no espaço físico à sua frente, algo que nenhum concorrente atual oferece.

### 15.3 Reconhecimento de escrita evolutivo e pessoal

Um modelo de OCR que **aprende o estilo de caligrafia matemática do próprio aluno** ao longo do tempo (com consentimento e dentro dos limites de privacidade da AI Memory), melhorando a precisão de reconhecimento especificamente para aquele usuário a cada uso.

### 15.4 Tutor inteligente com "modo silencioso ativo"

Uma evolução do Math Mentor que observa (com consentimento explícito) o tempo gasto em cada etapa de um problema autoral do aluno (sem digitar a resposta) e intervém **apenas quando detecta hesitação genuína prolongada** — o mais próximo possível de um monitor humano sentado ao lado, que sabe a diferença entre "está pensando" e "está travado".

### 15.5 Aprendizado adaptativo generativo

Geração dinâmica de exercícios **customizados no ponto exato da lacuna do Learning Graph** de cada aluno (não de um banco fixo de questões), calibrados em dificuldade problema a problema com base no desempenho em tempo real — um banco de exercícios infinito e pessoal.

### 15.6 Visualizações 3D e simulações interativas

Extensão do `GraphCanvas` para superfícies 3D navegáveis, campos vetoriais e simulações (ex.: variação de parâmetros de uma equação diferencial em tempo real), preparando o terreno para o suporte a matemática avançada do roadmap do PRD.

### 15.7 Assistente por voz para estudo "mãos livres"

Um modo de estudo por voz para revisão (ex.: durante um deslocamento), no qual o Math Mentor faz perguntas de revisão espaçada em áudio e o aluno responde falando — estendendo o momento de estudo para além da tela.

### 15.8 Modo colaborativo em tempo real

Extensão futura do Workspace para **sessões compartilhadas** (aluno + colega, ou aluno + professor) vendo e editando a mesma expressão matemática simultaneamente, com o Math Mentor mediando de forma neutra quando solicitado — natural extensão do modo colaborativo em sala de aula previsto no PRD.

### 15.9 "Explicação em camadas contínuas" (evolução do Explain Like...)

Em vez de registros fixos e discretos, uma régua contínua de profundidade que o aluno arrasta em tempo real sobre a mesma explicação, vendo o texto se reescrever suavemente do registro mais simples ao mais rigoroso — uma evolução natural do Explain Like... quando a latência de geração da camada pedagógica permitir essa fluidez sem perda de qualidade percebida.

---

*Fim do documento.*
