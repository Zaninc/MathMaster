# ARCHITECTURE.md
## MathMaster — Documento de Arquitetura de Software (SAD)

| | |
|---|---|
| **Documento** | Software Architecture Document (SAD) |
| **Produto** | MathMaster |
| **Versão do documento** | 1.0 |
| **Status** | Draft para aprovação técnica |
| **Autor** | CTO / Arquitetura de Software |
| **Data** | 2026-07-03 |
| **Classificação** | Confidencial — Uso interno |
| **Documentos relacionados** | [PRD.md](./PRD.md) — Product Requirements Document |

> Este documento não contém código. Ele define decisões arquiteturais, contratos entre módulos, modelo de dados conceitual e racional técnico. Especificações de código, esquemas de API detalhados e diagramas de sequência formais serão produzidos em documentos técnicos subsequentes (ADRs específicos por módulo).

---

## Índice

1. Visão Geral da Arquitetura
2. Escolha das Tecnologias e Justificativas
3. Frontend
4. Backend
5. Comunicação Frontend ↔ Backend
6. Banco de Dados
7. Sistema de Autenticação
8. Motor Matemático
9. Sistema de IA (LLM)
10. Sistema de Gráficos
11. Editor Matemático
12. OCR Matemático
13. Upload de Imagens
14. Histórico
15. Sistema de Cache
16. Segurança
17. Escalabilidade
18. Estrutura Completa das Pastas
19. Fluxo de uma Requisição
20. Como Cada Módulo Conversa com os Demais
21. Como Facilitar Futuras Expansões

---

## 1. Visão Geral da Arquitetura

### 1.1 Princípio arquitetural central

O MathMaster é construído sobre um princípio inegociável, derivado diretamente do PRD: **a resposta matemática nunca pode ser gerada por um modelo de linguagem sem verificação determinística**. Isso implica uma arquitetura em **camadas de responsabilidade estritamente separadas**, onde a IA generativa nunca é a fonte de verdade do resultado — apenas da linguagem, da pedagogia e da personalização.

Essa restrição molda toda a arquitetura: o sistema é desenhado como um **pipeline de confiança**, no qual cada camada adiciona uma responsabilidade específica sobre um resultado que já foi matematicamente validado antes de qualquer texto ser gerado.

### 1.2 Estilo arquitetural

Adotamos um **monolito modular com serviços extraídos por perfil de carga**, não uma malha de microsserviços desde o dia um. Esta é uma decisão deliberada:

- Um monolito modular reduz custo operacional e latência de desenvolvimento no estágio de MVP, quando a equipe é pequena e a velocidade de iteração é o ativo mais valioso.
- No entanto, três componentes têm **perfis de carga e de risco fundamentalmente diferentes** do restante da aplicação e são extraídos como serviços independentes desde o início:
  - **Math Engine** (CPU-bound, precisa de isolamento/sandboxing, escalabilidade independente).
  - **OCR Service** (GPU/CPU-bound, modelo de inferência pesado, escalabilidade independente).
  - **LLM Gateway** (I/O-bound, dependente de provedor externo, precisa de fila, retry e controle de custo independente).
- Os demais domínios (autenticação, histórico, Learning Graph, AI Memory, Math Mentor, Confidence Engine) vivem inicialmente como **módulos internos bem isolados dentro do monolito de API**, com fronteiras de dados e contratos internos desenhados **como se já fossem serviços separados** — cada módulo possui seu próprio esquema de dados e só é acessado por API interna, nunca por acesso direto de outro módulo ao seu banco. Isso garante um **caminho de extração barato** para microsserviços reais quando a escala justificar (ver Seção 21).

### 1.3 Diagrama conceitual de alto nível

```
┌─────────────────────────────────────────────────────────────────────┐
│                            CLIENTE                                   │
│         Web App (Next.js/React)   |   App Mobile (futuro)            │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ HTTPS / REST + WebSocket (streaming)
┌───────────────────────────────▼───────────────────────────────────────┐
│                          API GATEWAY                                  │
│      Autenticação • Rate limiting • Roteamento • Observabilidade      │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────────┐
        ▼                        ▼                            ▼
┌───────────────┐       ┌─────────────────┐         ┌──────────────────┐
│  CORE API      │       │   MATH ENGINE    │         │   LLM GATEWAY     │
│  (Monólito     │◄─────►│  (Serviço        │◄───────►│  (Serviço          │
│  Modular)      │       │  isolado,        │         │  isolado,          │
│                │       │  sandboxed)      │         │  fila + cache)     │
│ - Auth         │       └─────────────────┘         └──────────────────┘
│ - Histórico    │                                              ▲
│ - Learning     │                                              │
│   Graph        │       ┌─────────────────┐                    │
│ - AI Memory    │◄─────►│   OCR SERVICE    │                    │
│ - Math Mentor  │       │ (inferência de    │                    │
│ - Confidence   │       │  imagem→LaTeX)    │                    │
│   Engine       │       └─────────────────┘                    │
└───────┬────────┘                                              │
        │ eventos assíncronos (bus interno)                     │
        ▼                                                       │
┌────────────────────────────────────────────────────────────────┘
│                     CAMADA DE DADOS
│  PostgreSQL (relacional) • Redis (cache/fila) • Vector Store (AI Memory)
│  Object Storage (imagens) • Graph model (Learning Graph)
└──────────────────────────────────────────────────────────────────
```

### 1.4 Os cinco domínios funcionais mapeados à arquitetura

| Domínio (PRD) | Componente arquitetural responsável |
|---|---|
| Resolução simbólica | **Math Engine** |
| Confidence Engine | Módulo **Confidence** dentro do Core API, consumindo metadados do Math Engine |
| Explicação / Explain Like... | **LLM Gateway** + módulo **Pedagogical Layer** no Core API |
| Learning Graph | Módulo **Learning Graph** no Core API + modelo de grafo na camada de dados |
| Math Mentor | Módulo **Math Mentor** no Core API, orquestrador que consulta Learning Graph + AI Memory |
| AI Memory | Módulo **AI Memory** no Core API + Vector Store para recall semântico |
| OCR | **OCR Service** |

---

## 2. Escolha das Tecnologias e Justificativas

### 2.1 Princípio de seleção: "tecnologia enfadonha por padrão, inovação onde ela gera vantagem competitiva real"

Tecnologias maduras e amplamente adotadas são escolhidas para tudo que é infraestrutura de commodity (banco relacional, cache, autenticação). Investimento de risco/inovação é reservado para onde o MathMaster de fato diferencia: o Math Engine, o Confidence Engine e a camada pedagógica.

### 2.2 Tabela de decisões

| Camada | Tecnologia escolhida | Justificativa |
|---|---|---|
| Frontend Web | **Next.js (React) + TypeScript** | Renderização híbrida (SSR/SSG/CSR) essencial para SEO em páginas de conteúdo educacional público, ecossistema maduro, mesma linguagem (TS) podendo ser compartilhada com contratos de API no backend via tipos gerados. |
| Estilização/UI | **Design system próprio sobre Tailwind CSS + Radix UI (headless)** | Velocidade de desenvolvimento com consistência visual, acessibilidade nativa (WCAG 2.1 AA — RNF-07) garantida por componentes headless auditados. |
| Renderização matemática | **KaTeX** | Renderização de LaTeX no cliente com desempenho muito superior ao MathJax para o caso de uso de alta frequência de renderização (cada passo de explicação), com fallback controlado para MathJax em notações raras não suportadas. |
| Editor matemático (input) | **Componente de math input baseado em teclado matemático virtual (padrão MathLive/MathQuill)** | Permite entrada estruturada (não texto livre ambíguo), gerando diretamente uma árvore sintática (AST) em vez de string LaTeX solta, reduzindo erros de interpretação antes mesmo de chegar ao Math Engine. |
| Backend — Core API | **Python + FastAPI** | Python é a linguagem nativa do ecossistema científico (SymPy, NumPy, SciPy), eliminando a necessidade de comunicação entre linguagens diferentes para o domínio mais crítico do produto. FastAPI oferece tipagem forte (Pydantic), performance assíncrona competitiva e geração automática de contratos OpenAPI, reduzindo drift entre documentação e implementação. |
| Backend — Math Engine | **Python (SymPy, NumPy, SciPy) isolado em processo/serviço próprio** | Ver Seção 8. Isolamento por perfil de carga (CPU-bound) e por superfície de risco (parsing/avaliação de expressões matemáticas exige sandboxing rígido). |
| Backend — OCR Service | **Serviço de inferência dedicado (modelo de reconhecimento óptico especializado em notação matemática, arquitetura tipo image-to-LaTeX)** | Modelos de OCR genérico (Tesseract, Vision APIs padrão) têm desempenho ruim em notação matemática (frações, expoentes, símbolos aninhados). Um modelo especializado, servido isoladamente, permite versionamento e upgrade independente do restante do sistema. |
| LLM / IA Generativa | **LLM Gateway com abstração de provedor, usando modelos de linguagem de última geração (ex.: família Claude) como provedor primário** | A camada pedagógica (explicações, Explain Like..., diagnóstico textual de erro, Math Mentor conversacional futuro) é desacoplada do provedor via um **gateway de abstração**, evitando lock-in e permitindo troca/roteamento entre modelos por custo, latência ou qualidade sem reescrever a camada pedagógica. |
| Banco relacional | **PostgreSQL** | Padrão-ouro para dados transacionais (usuários, assinaturas, histórico, sessões), suporte nativo a JSONB (flexibilidade para payloads semiestruturados de passos de resolução) e extensão **pgvector** disponível no mesmo motor. |
| Modelo de grafo (Learning Graph) | **Modelado sobre PostgreSQL (tabelas de nós e arestas + extensão Apache AGE quando necessário) no MVP; avaliação de Neo4j dedicado pós-escala** | Princípio de "tecnologia enfadonha primeiro": no volume do MVP, um grafo modelado relacionalmente evita operar um banco de dados adicional. A extração para um banco de grafo dedicado é um caminho de migração planejado (Seção 21), não uma reescrita. |
| Vector Store (AI Memory — recall semântico) | **pgvector (PostgreSQL) no MVP; avaliação de vector store dedicado (ex.: Pinecone/Weaviate) na escala institucional** | Mesma lógica de "menos peças móveis primeiro". Embeddings de erros recorrentes e contexto de estudo são armazenados e consultados por similaridade dentro do mesmo Postgres até que o volume justifique um serviço dedicado. |
| Cache / Fila / Sessão | **Redis** | Padrão de mercado para cache de baixa latência, armazenamento de sessão, rate limiting e filas leves (Redis Streams) para processamento assíncrono entre módulos. |
| Fila para jobs pesados (OCR, geração de explicação longa) | **Redis Streams no MVP; migração para RabbitMQ ou SQS gerenciado na escala institucional** | Jobs de OCR e geração de explicação são assíncronos por natureza (RNF-01 de latência é para o caminho síncrono; jobs pesados podem ser processados fora do request-response síncrono via streaming de atualização ao cliente). |
| Armazenamento de imagens | **Object Storage compatível com S3** | Padrão de mercado, custo previsível, suporte nativo a URLs assinadas temporárias (segurança no upload/download — Seção 13). |
| Autenticação | **OAuth2/OIDC (provedor gerenciado) + JWT de curta duração com refresh token rotativo** | Terceirizar a complexidade de autenticação (login social, recuperação de senha, MFA) para um provedor especializado reduz superfície de risco de segurança, permitindo à equipe focar no diferencial do produto. |
| Infraestrutura / Deploy | **Containers (Docker) orquestrados via serviço gerenciado de Kubernetes (ou equivalente serverless de contêineres) em nuvem pública** | Portabilidade entre nuvens, escalabilidade horizontal automática por serviço (RNF-03), consistência de ambiente entre dev/staging/produção. |
| Observabilidade | **Stack de logs estruturados + tracing distribuído + métricas (padrão OpenTelemetry)** | Requisito direto do RNF-09: rastreabilidade de cada resolução, essencial também para auditoria do Confidence Engine. |
| CDN | **CDN global para ativos estáticos e conteúdo cacheável** | Latência de carregamento inicial e distribuição de gráficos/imagens renderizadas. |

---

## 3. Frontend

### 3.1 Responsabilidades

- Captura de entrada multimodal (texto estruturado via editor matemático, upload de imagem, colagem).
- Renderização de explicações passo a passo, gráficos, painel do Confidence Engine e visualização do Learning Graph.
- Gerenciamento de estado de sessão de estudo (o que está sendo resolvido agora) e de estado de personalização (registro atual do Explain Like..., preferências do usuário).
- Streaming de respostas: a explicação pedagógica é exibida progressivamente (token a token ou passo a passo) para reduzir a percepção de latência, mesmo quando a geração completa leva alguns segundos.

### 3.2 Arquitetura interna do frontend

- **App Router (Next.js)** organizado por domínio de produto (resolução, histórico, perfil de aprendizado, trilhas), não por tipo técnico de arquivo — refletindo os módulos do PRD.
- **Camada de estado de servidor** (cache de dados vindos da API, invalidação e revalidação) separada da **camada de estado de UI local** (o que está aberto, o que está expandido no Confidence Engine, etc.).
- **Camada de renderização matemática isolada**: um único ponto de conversão de AST/LaTeX para renderização visual (KaTeX), reutilizado em todos os contextos (passo a passo, histórico, Learning Graph, gráficos com rótulos).
- **Design responsivo mobile-first**, já que a maior parte do uso real (fotografar exercício do caderno) acontece no celular, mesmo antes da existência de um app nativo.
- **Camada de acessibilidade transversal**: navegação por teclado completa no editor matemático, leitura de fórmulas por leitor de tela via anotações semânticas (MathML/aria), contraste validado (WCAG 2.1 AA).

### 3.3 Progressive Web App (PWA)

O frontend web é desenhado desde o início com capacidades de PWA (service worker, manifest), antecipando o requisito futuro de modo offline parcial (Roadmap v2.0), mesmo que a funcionalidade offline completa não seja construída no MVP.

---

## 4. Backend

### 4.1 Core API (monólito modular)

O Core API é o ponto de orquestração central. Ele **não executa matemática nem gera texto diretamente** — orquestra chamadas ao Math Engine, ao LLM Gateway e ao OCR Service, e é dono dos módulos de domínio:

- **Auth Module** — identidade, sessão, autorização por plano (free/premium/institucional).
- **Confidence Module** — interpreta os metadados de validação retornados pelo Math Engine e produz o payload de confiança exibido ao usuário.
- **Pedagogical Module** — monta o prompt/contexto enviado ao LLM Gateway (nível do usuário, registro do Explain Like..., histórico relevante da AI Memory) e formata a resposta recebida.
- **Learning Graph Module** — mantém e consulta o grafo de domínio conceitual por usuário.
- **AI Memory Module** — grava e consulta eventos longitudinais de estudo e padrões de erro recorrente.
- **Math Mentor Module** — orquestrador de personalização: consome Learning Graph + AI Memory para gerar recomendações e proatividade.
- **History Module** — persistência do histórico de problemas resolvidos.
- **Institutional Module** (pós-MVP) — contas de professor, turmas, agregação de Learning Graph coletivo.

### 4.2 Regra de fronteira entre módulos

Cada módulo é dono exclusivo do seu próprio esquema de dados. Nenhum módulo lê ou escreve diretamente na tabela de outro módulo — toda comunicação entre módulos ocorre por **chamada de função de interface pública do módulo (dentro do monólito) ou por evento assíncrono**, nunca por acesso direto ao banco. Essa é a regra que torna a futura extração para microsserviços uma mudança de infraestrutura, não uma reescrita de lógica de negócio.

### 4.3 Serviços externos ao monólito

- **Math Engine**: exposto como serviço HTTP/RPC interno, chamado de forma síncrona pelo Core API dentro do orçamento de latência definido em RNF-01.
- **LLM Gateway**: exposto como serviço HTTP interno com suporte a streaming (Server-Sent Events/WebSocket) repassado ao frontend.
- **OCR Service**: exposto como serviço HTTP interno, tipicamente chamado de forma assíncrona (job) quando a imagem é grande ou a fila está sob carga, com fallback síncrono para imagens simples.

---

## 5. Comunicação Frontend ↔ Backend

### 5.1 Protocolo principal

- **REST sobre HTTPS** para a maioria das operações (CRUD de histórico, perfil, configuração, consulta ao Learning Graph).
- **Streaming via Server-Sent Events (SSE)** para a entrega progressiva de explicações geradas pela camada pedagógica — escolhido em vez de WebSocket bidirecional pela simplicidade operacional, já que o fluxo é predominantemente unidirecional (servidor → cliente) nesse caso de uso.
- **WebSocket** reservado para funcionalidades futuras genuinamente bidirecionais e de baixa latência (ex.: modo colaborativo em sala de aula, tutor conversacional por voz).

### 5.2 Contrato de API

- Especificação **OpenAPI gerada automaticamente** a partir dos modelos tipados do backend (FastAPI/Pydantic), garantindo que o contrato nunca fique dessincronizado da implementação.
- Tipos TypeScript consumidos pelo frontend são **gerados a partir do OpenAPI**, eliminando duplicação manual de contratos entre as duas camadas.
- Versionamento de API explícito por prefixo (ex.: `/v1/`), permitindo evolução de contrato sem quebrar clientes antigos (importante já pensando na futura API pública para parceiros — RF-23).

### 5.3 Envelope de resposta padronizado

Toda resposta da API segue um envelope consistente contendo: dados, metadados de confiança (quando aplicável), identificador de rastreamento (trace id) e informações de paginação/streaming quando relevante — permitindo que o frontend trate erro, sucesso parcial e streaming de forma uniforme em todos os módulos.

### 5.4 Idempotência e retomada

Requisições de resolução de problema carregam um identificador de idempotência gerado no cliente, permitindo que reconexões após instabilidade de rede (comum em uso móvel) não dupliquem o processamento nem corrompam o estado da AI Memory.

---

## 6. Banco de Dados

### 6.1 Estratégia de persistência poliglota (mínima necessária)

| Armazenamento | Uso | Justificativa |
|---|---|---|
| **PostgreSQL (primário)** | Usuários, autenticação, assinaturas, histórico de problemas, metadados de sessão, Learning Graph (nós/arestas), embeddings (pgvector) da AI Memory | Fonte única de verdade transacional; consolida múltiplos padrões de acesso em um único motor no estágio de MVP, reduzindo custo operacional. |
| **Redis** | Cache de respostas frequentes, sessões ativas, filas leves, rate limiting | Baixíssima latência para dados efêmeros/voláteis. |
| **Object Storage (S3-compatible)** | Imagens enviadas pelo usuário, artefatos gerados (ex.: gráficos exportados) | Armazenamento de binários não pertence a um banco relacional; URLs assinadas garantem acesso controlado. |

### 6.2 Modelo de dados conceitual (entidades principais)

- **User** — identidade, plano, preferências (registro padrão de Explain Like..., idioma).
- **Problem** — problema submetido (entrada original, AST interpretada, domínio matemático).
- **Solution** — resultado do Math Engine (passos estruturados, forma canônica da resposta).
- **ConfidenceRecord** — método(s) de validação utilizados, score, justificativa — associado 1:1 a uma Solution.
- **Explanation** — texto gerado pela camada pedagógica para uma Solution, versionado por registro (Explain Like...) e por nível.
- **LearningGraphNode** — conceito matemático, com nível de domínio por usuário (relação N:N entre User e o catálogo global de conceitos).
- **LearningGraphEdge** — relação de pré-requisito/dependência entre dois conceitos (catálogo global, não por usuário).
- **AIMemoryEvent** — evento longitudinal (erro cometido, tópico praticado, sessão retomada), com embedding vetorial associado para recall semântico.
- **StudySession** — agrupamento de interações de uma sessão de estudo, usado pelo Math Mentor e pela retomada de estudo.
- **InstitutionalAccount / Classroom** (pós-MVP) — vínculo entre professor e alunos, para agregação de Learning Graph coletivo.

### 6.3 Separação lógica por módulo dentro do mesmo Postgres

Mesmo compartilhando o mesmo motor de banco no MVP, cada módulo opera em seu **próprio schema lógico** (namespace) dentro do PostgreSQL, com permissões de acesso restritas por módulo — preparando o terreno para uma eventual separação física em bancos distintos por serviço, sem redesenho do modelo de dados.

### 6.4 Catálogo global de conceitos (Learning Graph)

O grafo de pré-requisitos conceituais (`LearningGraphEdge`) é um **catálogo curado centralmente pela equipe pedagógica do MathMaster**, comum a todos os usuários; o que é individual por aluno é apenas o **nível de domínio** sobre cada nó desse catálogo. Isso permite atualizar e enriquecer o mapa de conceitos globalmente sem migrar dados por usuário.

---

## 7. Sistema de Autenticação

### 7.1 Modelo de identidade

- Autenticação via **e-mail/senha**, **login social (Google)** e, para contas institucionais (pós-MVP), **SSO via SAML/OIDC** integrado ao provedor de identidade da escola.
- **JWT de curta duração** (access token) + **refresh token rotativo de longa duração**, armazenado de forma segura (HttpOnly, Secure cookies no contexto web).
- Sessões ativas rastreadas em Redis, permitindo revogação imediata (ex.: logout remoto, suspeita de comprometimento de conta).

### 7.2 Autorização

- **Controle de acesso baseado em papel e plano** (RBAC leve): `guest`, `student_free`, `student_premium`, `teacher`, `institution_admin`.
- O **modo convidado** (RF-15) opera com um token de sessão temporário sem vínculo a identidade persistente, e explicitamente **não** persiste dados em Learning Graph ou AI Memory — apenas em cache de curta duração, descartado ao fim da sessão.
- Contas de menores de idade seguem fluxo de consentimento adequado (responsável legal), alinhado a LGPD/COPPA conforme o mercado de operação.

### 7.3 Proteção de conta

- Rate limiting de tentativas de login, detecção de padrões de força bruta, MFA opcional (e obrigatório para contas institucionais administrativas).

---

## 8. Motor Matemático

### 8.1 Papel no sistema

O Math Engine é a **única fonte de verdade matemática** do MathMaster (Seção 1.1). Ele resolve, simplifica, verifica e produz os passos estruturados de qualquer problema — nunca em formato de texto livre, mas como uma **estrutura de dados de passos** (operação aplicada, estado antes/depois, regra matemática usada), que só é traduzida em linguagem natural pela camada pedagógica.

### 8.2 Composição interna

- **SymPy** como motor simbólico principal (álgebra, cálculo, simplificação, resolução de equações/inequações, séries).
- **NumPy/SciPy** para componentes numéricos: avaliação de funções para plotagem, verificação numérica cruzada de soluções simbólicas (parte do mecanismo do Confidence Engine), estatística e álgebra linear numérica.
- **Camada de parsing segura**: toda expressão de entrada (vinda do editor matemático estruturado, nunca texto livre não estruturado) é convertida em uma AST validada antes de qualquer avaliação simbólica — nenhuma entrada do usuário é avaliada como código arbitrário.
- **Sandboxing de execução**: o processo de avaliação simbólica roda em ambiente isolado (contêiner com limites estritos de CPU/memória/tempo), prevenindo tanto abuso (expressões desenhadas para causar explosão computacional) quanto qualquer superfície de execução de código arbitrário.

### 8.3 Estratégia de multi-domínio

O Math Engine é organizado internamente por **módulos de domínio matemático independentes** (aritmética, álgebra, funções, trigonometria, cálculo, estatística, álgebra linear), cada um com seu próprio conjunto de estratégias de resolução, permitindo adicionar um novo domínio (ex.: equações diferenciais no roadmap futuro) sem tocar nos módulos existentes (RNF-10).

### 8.4 Verificação cruzada (input para o Confidence Engine)

Sempre que computacionalmente viável, o Math Engine aplica **mais de um método independente** para chegar à mesma resposta (ex.: resolução simbólica exata + verificação numérica por substituição) e reporta explicitamente:
- Quais métodos foram aplicados.
- Se houve concordância total, parcial ou divergência.
- Restrições de domínio identificadas e premissas assumidas na interpretação da entrada.

Esse relatório estruturado é o insumo bruto consumido pelo **Confidence Module** do Core API (Seção 4.1) para gerar o score e a justificativa exibidos ao usuário.

---

## 9. Sistema de IA (LLM)

### 9.1 Papel no sistema

A camada de IA generativa é responsável exclusivamente por:
- Traduzir os passos estruturados do Math Engine em linguagem natural, no registro escolhido (Explain Like...).
- Gerar diagnóstico textual do erro do usuário (a partir da comparação estrutural já feita entre a tentativa do usuário e a solução do Math Engine).
- Alimentar as recomendações conversacionais do Math Mentor.

Ela **nunca** decide se uma resposta matemática está correta — essa decisão é sempre um dado de entrada vindo do Math Engine/Confidence Engine.

### 9.2 LLM Gateway

- Camada de abstração única entre o Core API e qualquer provedor de modelo de linguagem, permitindo troca ou roteamento entre modelos por custo/latência/qualidade sem alterar o Pedagogical Module.
- Suporte nativo a **streaming de tokens**, repassado ao frontend via SSE (Seção 5.1).
- **Fila e controle de custo**: requisições são gerenciadas com timeout, retry controlado e circuit breaker; um orçamento de custo por usuário/plano é aplicado para conter o custo de inferência dentro da margem sustentável do freemium (RNF-12).
- **Cache de explicações**: combinações idênticas de (problema canônico + registro do Explain Like... + nível do usuário) têm sua explicação cacheada, evitando reprocessamento e reduzindo custo e latência (ver Seção 15).

### 9.3 Engenharia de contexto (não fine-tuning como dependência crítica no MVP)

O contexto enviado ao modelo em cada chamada é montado dinamicamente pelo Pedagogical Module a partir de:
- Os passos estruturados do Math Engine (fonte de verdade).
- O registro de explicação solicitado (Explain Like...).
- Sinal relevante da AI Memory (ex.: "este usuário já errou este tipo de operação antes").
- Nível estimado do usuário no Learning Graph para o conceito em questão.

Essa abordagem evita dependência de um modelo customizado/fine-tunado como pré-requisito de lançamento, permitindo lançar o MVP com modelos de propósito geral de última geração, guiados por engenharia de contexto disciplinada.

### 9.4 Guardrails

- Validação de que o texto gerado não contradiz o resultado do Math Engine (checagem automática pós-geração comparando menções numéricas/simbólicas no texto com o resultado canônico).
- Filtros de segurança de conteúdo padrão, com atenção redobrada por parte do público infantojuvenil do produto.

---

## 10. Sistema de Gráficos

### 10.1 Divisão de responsabilidade

- O **Math Engine** é responsável por calcular os dados a serem plotados (amostragem de pontos de uma função, domínio válido, pontos notáveis: raízes, extremos, assíntotas, descontinuidades).
- O **frontend** é responsável por toda a renderização visual e interatividade (zoom, pan, toggle de camadas como derivada/integral sobreposta), usando uma biblioteca de gráficos client-side de alta performance para renderização matemática (curvas suaves, múltiplas séries, anotações).

### 10.2 Justificativa da divisão

Calcular no backend garante que o gráfico reflita exatamente a mesma matemática validada pelo Confidence Engine (sem risco de uma segunda implementação divergente de avaliação de função no cliente); renderizar no cliente garante interatividade fluida sem round-trip ao servidor a cada pequena interação do usuário (zoom, arraste).

### 10.3 Casos avançados

Para visualizações que dependem de contexto pedagógico (ex.: destacar visualmente a região de uma integral definida, ou o ponto de tangência de uma derivada), os metadados de anotação também são calculados pelo Math Engine e apenas estilizados/posicionados pelo frontend.

---

## 11. Editor Matemático

### 11.1 Filosofia de design

Diferente de um campo de texto livre (que gera ambiguidade de interpretação — ex.: "1/2x" pode significar duas coisas diferentes), o editor matemático do MathMaster é um **teclado matemático estruturado**: o usuário monta a expressão através de blocos visuais (fração, expoente, raiz, matriz), e o editor mantém internamente uma **árvore sintática (AST) sempre não ambígua**, exibida visualmente como notação matemática tradicional (via KaTeX) em tempo real.

### 11.2 Saída do editor

O editor produz diretamente a AST estruturada consumida pelo Math Engine — eliminando uma etapa inteira de parsing de texto ambíguo do lado do backend para entradas digitadas manualmente (a ambiguidade real do sistema se concentra no OCR, tratado na Seção 12).

### 11.3 Reutilização

O mesmo componente de renderização usado no editor de entrada é reutilizado para exibir os passos de resolução, o histórico e o Learning Graph — um único "vocabulário visual matemático" em todo o produto.

---

## 12. OCR Matemático

### 12.1 Pipeline

1. **Pré-processamento de imagem**: correção de perspectiva, binarização, remoção de ruído, recorte da região de interesse.
2. **Reconhecimento estrutural**: modelo especializado em notação matemática (não OCR de texto genérico), que produz diretamente uma **representação estruturada (LaTeX/AST)**, preservando relações espaciais (numerador/denominador, base/expoente, índices de somatório etc.), que texto genérico OCR perde.
3. **Etapa de confirmação obrigatória (RF-03)**: o resultado reconhecido é sempre exibido ao usuário para confirmação/correção antes de ser enviado ao Math Engine — nenhuma resolução ocorre sobre uma interpretação de OCR não confirmada.
4. **Fallback de edição**: caso o reconhecimento esteja incorreto ou incompleto, o resultado é carregado diretamente no **editor matemático estruturado** (Seção 11) para correção manual assistida, em vez de forçar o usuário a redigitar do zero.

### 12.2 Isolamento como serviço

O OCR Service é servido isoladamente do Core API por ter um perfil de carga distinto (picos de uso após horário escolar, inferência potencialmente acelerada por GPU) e por ser o componente com maior probabilidade de evolução/substituição de modelo ao longo do tempo — isolá-lo minimiza o raio de impacto de upgrades de modelo.

### 12.3 Meta de qualidade

Alinhado ao RNF-04 do PRD: ≥95% de acerto em texto impresso, ≥85% em manuscrito, com monitoramento contínuo de taxa de correção manual pelo usuário como proxy de qualidade em produção (uma taxa alta de correções no mesmo tipo de símbolo indica necessidade de retreinamento/ajuste do modelo).

---

## 13. Upload de Imagens

### 13.1 Fluxo de upload

1. Cliente solicita uma **URL de upload assinada e de curta duração** diretamente ao Object Storage (evitando que o binário da imagem trafegue desnecessariamente pelo Core API).
2. Upload é feito diretamente do cliente para o Object Storage.
3. Após confirmação de upload bem-sucedido, o Core API é notificado (callback/evento) e enfileira o job de OCR.

### 13.2 Validações de segurança

- Restrição de tipo MIME e extensão (apenas formatos de imagem esperados).
- Limite de tamanho de arquivo.
- Verificação de conteúdo (scan básico) antes do processamento, prevenindo abuso do pipeline de OCR como vetor de upload malicioso.
- Imagens são armazenadas com **retenção limitada e configurável**: por padrão, a imagem original é descartada após a extração bem-sucedida da expressão matemática (apenas a expressão estruturada é retida no histórico), minimizando a superfície de dados sensíveis armazenados — ponto relevante para LGPD, já que fotos de cadernos podem inadvertidamente conter outras informações pessoais visíveis na página.

---

## 14. Histórico

### 14.1 Modelo

Cada problema resolvido gera um registro imutável de **Problem + Solution + ConfidenceRecord + Explanation(s)**, vinculado ao usuário (quando autenticado) e à sessão de estudo. Diferente da AI Memory (que é interpretativa e longitudinal — padrões, recorrências), o Histórico é a **fonte bruta e literal** de "o que foi resolvido, quando, e com qual resultado".

### 14.2 Relação com AI Memory e Learning Graph

O Histórico é o dado de origem a partir do qual eventos derivados são publicados (Seção 20) para atualizar a AI Memory (interpretação longitudinal) e o Learning Graph (nível de domínio por conceito) — o Histórico em si nunca é reescrito ou reinterpretado retroativamente; é a camada de auditoria e "verdade bruta" do que aconteceu.

### 14.3 Direito de exclusão

Em conformidade com RF-19/RNF-13, o usuário pode exportar ou apagar seu histórico; a exclusão é propagada como evento para os módulos derivados (AI Memory, Learning Graph), que devem recalcular ou remover as inferências associadas.

---

## 15. Sistema de Cache

### 15.1 Camadas de cache

| Camada | O que cacheia | TTL típico |
|---|---|---|
| **CDN** | Ativos estáticos do frontend, imagens públicas, páginas de conteúdo educacional (SSG) | Longo (dias) com invalidação por deploy |
| **Redis — cache de sessão** | Tokens de sessão, estado de modo convidado | Duração da sessão |
| **Redis — cache de resolução** | Resultado do Math Engine para uma expressão canônica idêntica já resolvida (independente de usuário) | Médio (horas/dias), já que a matemática de `x² - 4 = 0` não muda |
| **Redis — cache de explicação (LLM)** | Texto gerado para a combinação (problema canônico + registro Explain Like... + nível) | Médio/longo, com invalidação em caso de atualização do modelo/prompt |
| **Redis — rate limiting** | Contadores de uso por usuário/IP (modo convidado, proteção de abuso) | Curto (janelas deslizantes) |

### 15.2 Canonicalização como chave de cache

Uma etapa central do Math Engine é normalizar a expressão de entrada para uma **forma canônica** antes de resolver — isso permite que `2x + 2 = 4` e `2x+2=4` (mesma expressão, formatação diferente) compartilhem o mesmo resultado cacheado, aumentando significativamente a taxa de acerto de cache e reduzindo custo tanto de computação simbólica quanto de geração de explicação via LLM (impacto direto em RNF-12).

### 15.3 Invalidação

Cache de explicação é versionado por "versão de prompt/modelo pedagógico" — uma mudança na estratégia de explicação do Pedagogical Module invalida o cache relevante automaticamente por mudança de chave, nunca exigindo purga manual ampla.

---

## 16. Segurança

### 16.1 Superfícies de risco específicas do domínio

- **Avaliação de expressões matemáticas**: nunca usar avaliação genérica de código (ex.: `eval` irrestrito) sobre entrada do usuário. Toda expressão passa por parsing estruturado e avaliação dentro de um subconjunto seguro e sandboxed do Math Engine (Seção 8.2).
- **Upload de imagem**: validação de tipo/tamanho, descarte de metadados EXIF sensíveis, retenção mínima (Seção 13.2).
- **Custo de IA como vetor de abuso**: um usuário malicioso poderia tentar gerar volume excessivo de chamadas ao LLM Gateway; rate limiting e orçamento por plano mitigam tanto abuso quanto risco financeiro.

### 16.2 Segurança de dados

- Criptografia em trânsito (TLS) em todas as comunicações externas e internas entre serviços.
- Criptografia em repouso para dados sensíveis (banco de dados e object storage).
- Segredos e chaves de API geridos por um serviço dedicado de gestão de segredos, nunca em variáveis de ambiente versionadas.
- Dados de menores de idade recebem tratamento reforçado (minimização de dados, consentimento parental documentado, retenção mais curta).

### 16.3 Conformidade

- Arquitetura desenhada para suportar LGPD desde o design (privacy by design): direito de acesso, retificação, portabilidade e exclusão são operações de primeira classe em todos os módulos que armazenam dados pessoais (Histórico, Learning Graph, AI Memory).
- Preparação estrutural para GDPR/COPPA/FERPA na expansão internacional, sem redesenho de modelo de dados (os mesmos mecanismos de exclusão/exportação servem a múltiplos regimes regulatórios, com política de residência de dados regional configurável na infraestrutura).

### 16.4 Auditoria

Todo evento relevante (login, alteração de dados pessoais, exclusão de AI Memory, acesso administrativo a dados de usuário em contas institucionais) gera um registro de auditoria imutável, satisfazendo tanto requisitos de conformidade quanto o requisito de explicabilidade/rastreabilidade do Confidence Engine (RNF-09/RNF-14).

---

## 17. Escalabilidade

### 17.1 Escalabilidade horizontal por perfil de carga

- **Core API**: stateless, atrás de um balanceador de carga, escala horizontalmente por número de instâncias conforme tráfego HTTP.
- **Math Engine**: pool de workers CPU-bound, escalado independentemente por fila/profundidade de demanda — picos previsíveis (véspera de prova, horário pós-escola) são absorvidos por autoscaling baseado em métricas de fila, não apenas CPU.
- **OCR Service**: escalado independentemente, com possibilidade de uso de hardware acelerado dedicado, dissociado do ciclo de deploy do restante do sistema.
- **LLM Gateway**: escala por gestão de fila e paralelismo de chamadas ao provedor externo, com circuit breaker para proteger o restante do sistema caso o provedor de LLM apresente degradação.

### 17.2 Banco de dados

- **Réplicas de leitura** do PostgreSQL para consultas de alto volume e baixa criticidade de consistência (ex.: leitura do Learning Graph para exibição, dashboards institucionais futuros).
- **Particionamento futuro** do Histórico e da AI Memory por intervalo de tempo/usuário, antecipado no modelo de dados desde o início, mesmo que não implementado no MVP.

### 17.3 Absorção de picos sazonais (RNF-03)

O sistema é desenhado para lidar com o padrão de uso real do público-alvo: picos de 5 a 10x a média em vésperas de prova. A combinação de cache agressivo de resoluções/explicações comuns (Seção 15) com autoscaling independente do Math Engine e do LLM Gateway é a principal estratégia de absorção — evitando que a camada mais cara (IA generativa) seja o gargalo em momentos de pico.

### 17.4 Multi-região (preparação para expansão internacional)

A arquitetura não assume uma única região desde o design: identificadores, timestamps e política de residência de dados são desenhados para permitir implantação multi-região no roadmap de expansão internacional (v3.x do PRD), sem migração de esquema.

---

## 18. Estrutura Completa das Pastas

Estrutura de **monorepo**, escolhida para maximizar consistência de contratos entre frontend e backend e simplificar o compartilhamento de tipos/esquemas, mesmo com serviços fisicamente separados.

```
mathmaster/
├── apps/
│   ├── web/                        # Frontend Next.js (aplicação principal)
│   │   ├── app/                    # Rotas por domínio de produto
│   │   │   ├── solve/              # Fluxo de resolução de problema
│   │   │   ├── history/            # Histórico do usuário
│   │   │   ├── learning-graph/     # Visualização do mapa de progresso
│   │   │   ├── mentor/             # Interações com o Math Mentor
│   │   │   ├── auth/               # Login, cadastro, onboarding
│   │   │   └── institutional/      # (pós-MVP) Área do professor
│   │   ├── components/             # Componentes de UI reutilizáveis
│   │   │   ├── math-editor/        # Editor matemático estruturado
│   │   │   ├── math-render/        # Renderização KaTeX/gráficos
│   │   │   ├── confidence-panel/   # UI do Confidence Engine
│   │   │   └── explain-like/       # Seletor de registro de explicação
│   │   └── lib/                    # Clientes de API gerados, hooks, utils
│   │
│   └── mobile/                     # (futuro, v2.0) App nativo
│
├── services/
│   ├── core-api/                   # Monólito modular (FastAPI)
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── history/
│   │   │   ├── confidence/
│   │   │   ├── pedagogical/
│   │   │   ├── learning_graph/
│   │   │   ├── ai_memory/
│   │   │   ├── math_mentor/
│   │   │   └── institutional/      # (pós-MVP)
│   │   ├── events/                 # Contratos de eventos internos (bus)
│   │   └── gateway/                # Roteamento, auth middleware, rate limiting
│   │
│   ├── math-engine/                # Serviço isolado de resolução simbólica
│   │   ├── domains/                # arithmetic/, algebra/, calculus/, statistics/, linear_algebra/, trigonometry/
│   │   ├── validation/             # Verificação cruzada (Confidence input)
│   │   └── sandbox/                # Isolamento de execução
│   │
│   ├── llm-gateway/                 # Abstração de provedor de IA generativa
│   │   ├── providers/              # Adaptadores por provedor
│   │   ├── prompt-templates/       # Templates por Explain Like... e por módulo
│   │   └── cache/
│   │
│   └── ocr-service/                 # Reconhecimento de expressões matemáticas
│       ├── preprocessing/
│       ├── recognition/
│       └── model-artifacts/
│
├── packages/                        # Código compartilhado entre apps/serviços
│   ├── math-ast-schema/             # Definição do formato de AST matemático compartilhado
│   ├── api-types/                   # Tipos gerados a partir do OpenAPI
│   ├── ui-kit/                      # Design system (tokens, componentes base)
│   └── event-contracts/             # Esquemas de eventos versionados
│
├── infra/
│   ├── terraform/                   # Infraestrutura como código
│   ├── kubernetes/                  # Manifestos de orquestração por serviço
│   └── observability/               # Dashboards, alertas, configuração de tracing
│
├── docs/
│   ├── PRD.md
│   ├── BUSINESS.md
│   ├── ARCHITECTURE.md
│   └── adr/                         # Architecture Decision Records individuais
│
└── scripts/                         # Automação de build, migração e seed de dados
```

---

## 19. Fluxo de uma Requisição

### 19.1 Cenário: usuário resolve um problema digitado, no registro padrão de explicação

1. **Cliente (Web App)** monta a AST da expressão via editor matemático estruturado e envia `POST /v1/problems/solve` ao **API Gateway**, com identificador de idempotência e token de sessão.
2. **API Gateway** autentica a requisição, aplica rate limiting e roteia ao **Core API**.
3. **Core API (History Module)** persiste o registro inicial do `Problem` e gera um `trace_id` para observabilidade ponta a ponta.
4. **Core API** chama o **Math Engine** de forma síncrona, enviando a AST.
5. **Math Engine** identifica o domínio matemático, resolve simbolicamente, executa verificação cruzada quando aplicável, e retorna: passos estruturados, resultado canônico, e o relatório de validação (métodos usados, concordância, restrições de domínio).
6. **Core API (Confidence Module)** processa o relatório de validação e gera o payload de confiança (score + justificativa estruturada).
7. **Core API (History Module)** persiste a `Solution` e o `ConfidenceRecord`, vinculados ao `Problem`.
8. **Core API (Pedagogical Module)** monta o contexto (passos estruturados + registro Explain Like... padrão + nível do usuário vindo do Learning Graph + sinal relevante da AI Memory) e chama o **LLM Gateway**.
9. **LLM Gateway** verifica cache de explicação; em caso de miss, chama o provedor de modelo de linguagem com streaming habilitado.
10. **Core API** repassa o streaming da explicação ao cliente via **SSE**, permitindo que o usuário comece a ler antes da geração completa.
11. Ao concluir a geração, **Core API (Pedagogical Module)** persiste a `Explanation` final associada à `Solution`.
12. **Core API** publica um evento assíncrono `ProblemSolved` no barramento interno (Seção 20).
13. **Consumidores assíncronos** do evento (Learning Graph Module, AI Memory Module) atualizam, em paralelo e fora do caminho crítico de resposta ao usuário: o nível de domínio do conceito envolvido e o registro longitudinal de estudo.
14. **Cliente** recebe a resposta final consolidada (passos, gráfico se aplicável, painel de confiança, explicação completa) e a interface é atualizada — o usuário pode então alternar o registro do Explain Like..., o que dispara uma nova chamada mais leve reaproveitando os passos e a validação já computados (repete apenas a partir do passo 8, sem tocar novamente no Math Engine).

### 19.2 Orçamento de latência por etapa (referência ao RNF-01)

| Etapa | Orçamento alvo (problema simples) |
|---|---|
| Autenticação + roteamento | < 50ms |
| Math Engine (resolução + validação cruzada) | < 500ms |
| Confidence Module (processamento) | < 50ms |
| Primeiro token da explicação (streaming) | < 900ms |
| **Total até início de exibição útil ao usuário** | **< 1.5s (p95)** |

---

## 20. Como Cada Módulo Conversa com os Demais

### 20.1 Dois canais de comunicação, escolhidos por propósito

- **Chamada síncrona (request/response)**: usada quando o caminho crítico da experiência do usuário depende diretamente do resultado (ex.: Core API → Math Engine, Core API → LLM Gateway).
- **Evento assíncrono (publish/subscribe via barramento interno)**: usado para efeitos colaterais que **não devem bloquear** a resposta ao usuário e que podem ser processados com leve atraso (ex.: atualização do Learning Graph, gravação na AI Memory, analytics).

### 20.2 Eventos centrais do sistema

| Evento | Publicado por | Consumido por |
|---|---|---|
| `ProblemSolved` | Core API (History Module) | Learning Graph Module, AI Memory Module, Analytics |
| `UserAttemptEvaluated` | Core API (History Module, após diagnóstico de erro) | Learning Graph Module (ajuste de domínio), AI Memory Module (registro de padrão de erro), Math Mentor Module |
| `StudySessionResumed` | Core API (AI Memory Module) | Math Mentor Module (para gerar recomendação de retomada) |
| `RecurringMistakeDetected` | AI Memory Module | Math Mentor Module (para gerar intervenção proativa) |
| `LearningGraphNodeUpdated` | Learning Graph Module | Math Mentor Module (recalibrar recomendação), Institutional Module (agregação de turma, pós-MVP) |
| `UserDataDeletionRequested` | Core API (Auth/Privacy Module) | History, Learning Graph, AI Memory (cada um executa sua própria rotina de exclusão/anonimização) |

### 20.3 Por que eventos e não chamadas diretas entre módulos de domínio

Se o Learning Graph Module chamasse diretamente o AI Memory Module (e vice-versa) de forma síncrona, os módulos se tornariam fortemente acoplados e qualquer lentidão em um degradaria o outro. Publicar eventos a partir de fatos já consumados (um problema foi resolvido, uma tentativa foi avaliada) mantém os módulos de personalização **desacoplados entre si e do caminho crítico de resposta**, e é exatamente o padrão que permite escalar e evoluir Learning Graph, AI Memory e Math Mentor de forma independente (inclusive extraindo-os como serviços próprios no futuro, sem alterar quem publica os eventos).

### 20.4 Contrato de eventos

Todo evento segue um esquema versionado (armazenado em `packages/event-contracts`), com campo de versão explícito — permitindo que consumidores evoluam sua lógica de processamento sem exigir coordenação de deploy simultâneo com o publicador.

---

## 21. Como Facilitar Futuras Expansões

### 21.1 Caminho de extração de módulos para microsserviços

Como cada módulo do Core API já possui fronteira de dados isolada e só se comunica por API interna/eventos (Seção 4.2, Seção 20), extrair, por exemplo, o **Learning Graph Module** ou o **AI Memory Module** para um serviço fisicamente separado no futuro é uma mudança de **infraestrutura e deployment**, não de lógica de negócio ou modelo de dados. O critério de decisão para extrair um módulo é objetivo: quando seu perfil de carga, time de deploy independente, ou necessidade de escala diverge suficientemente do restante do monólito.

### 21.2 Evolução do Learning Graph para banco de grafo dedicado

O modelo de nós/arestas já é desenhado desde o MVP como se fosse um grafo (Seção 6.4), mesmo armazenado em PostgreSQL. A migração para um banco de grafo dedicado (ex.: Neo4j), quando consultas de travessia profunda (ex.: "todos os pré-requisitos transitivos de um conceito, com pesos de força de relação") se tornarem um gargalo, é uma migração de **motor de armazenamento**, não de modelo conceitual.

### 21.3 Evolução da AI Memory para vector store dedicado

Da mesma forma, o uso de `pgvector` no MVP para recall semântico é substituível por um vector store dedicado quando o volume de embeddings justificar, sem alterar a interface pública do AI Memory Module consumida pelo resto do sistema.

### 21.4 Novos domínios matemáticos

Adicionar um novo domínio ao Math Engine (ex.: equações diferenciais, álgebra abstrata) segue um contrato de **plugin de domínio**: cada domínio expõe um conjunto padronizado de capacidades (resolver, verificar, explicar estrutura de passos) e é registrado no roteador de domínios do Math Engine — o restante do sistema (Confidence Engine, camada pedagógica, Learning Graph) já sabe consumir qualquer domínio que siga esse contrato, sem alterações.

### 21.5 Novos registros de explicação (Explain Like...)

Um novo registro de explicação é adicionado como um novo **template de prompt** no LLM Gateway, sem qualquer alteração no Math Engine, no Confidence Engine ou no restante do Core API — a arquitetura já trata o registro como um parâmetro de entrada da camada pedagógica.

### 21.6 Novos provedores de LLM

Trocar ou adicionar um provedor de modelo de linguagem é uma mudança isolada em `services/llm-gateway/providers/`, sem impacto em nenhum outro módulo, dado o desacoplamento estabelecido na Seção 9.2.

### 21.7 Expansão institucional (B2B)

O `Institutional Module` foi antecipado desde o modelo de dados (Seção 6.2: `InstitutionalAccount`/`Classroom`) e desde os eventos (`LearningGraphNodeUpdated` já previsto como consumido por agregação de turma), de forma que a construção do dashboard de professor (Roadmap v2.1 do PRD) é predominantemente um trabalho de **consumo de dados já existentes**, não de reengenharia dos módulos centrais.

### 21.8 API pública para parceiros

O versionamento de contrato de API (Seção 5.2) e o desacoplamento do Confidence Engine como módulo próprio preparam diretamente a abertura de uma **API pública documentada** (Roadmap v3.0 do PRD/RF-23): expor os módulos de resolução, confiança e explicação a parceiros é, em grande parte, uma decisão de exposição de contratos já existentes sob autenticação de parceiro (API key/OAuth client credentials), não uma nova camada de sistema.

### 21.9 Internacionalização

Textos de interface, templates de prompt da camada pedagógica e o catálogo de conceitos do Learning Graph são desenhados desde o início como **conteúdo localizável** (chaves de tradução, templates parametrizados por idioma), evitando que a expansão internacional (Roadmap v3.x) exija reescrever lógica — apenas adicionar conteúdo localizado.

---

*Fim do documento.*
