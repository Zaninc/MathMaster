# MVP_SCOPE.md
## MathMaster — Escopo do MVP Técnico (V0)

| | |
|---|---|
| **Documento** | MVP Scope Definition |
| **Produto** | MathMaster |
| **Versão do documento** | 1.0 |
| **Status** | Draft para aprovação |
| **Autor** | CTO / Arquitetura de Software |
| **Data** | 2026-07-03 |
| **Classificação** | Confidencial — Uso interno |
| **Documentos relacionados** | [PRD.md](./PRD.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [UI_UX.md](./UI_UX.md) |

---

## 0. Como este documento se relaciona com os demais

O PRD.md, o ARCHITECTURE.md e o UI_UX.md descrevem a **visão completa** do MathMaster — incluindo Learning Graph, Math Mentor, Confidence Engine, AI Memory, gamificação e uma arquitetura de serviços preparada para escala. Essa visão continua sendo o destino do produto e **nenhuma linha desses documentos é invalidada por este aqui**.

Este documento define um marco **anterior e menor** ao "MVP" descrito na Seção 13 do PRD.md. Para evitar ambiguidade de nomenclatura, a partir de agora:

- **MVP Técnico / V0** (este documento) — a menor versão possível do produto que já funciona de ponta a ponta: digitar matemática, resolver, explicar, mostrar resultado, salvar histórico. Construível em poucos dias. **Sem** personalização, memória, gamificação ou multimodalidade.
- **MVP de Produto / V1.0** (PRD.md, Seção 13) — a primeira versão lançada publicamente, já incluindo versões iniciais de Learning Graph, Confidence Engine, AI Memory e Math Mentor.

O V0 existe para **validar o núcleo de valor** (resolução confiável + explicação clara) o mais rápido possível, com o mínimo de investimento em infraestrutura, antes de justificar a construção da arquitetura completa. Tudo o que for aprendido aqui informa a construção real do V1.0.

---

## 1. Objetivo do MVP

Construir, no menor tempo possível, uma aplicação que faça uma única coisa muito bem: **receber uma expressão matemática, resolvê-la corretamente e explicar o resultado de forma clara**, com um histórico simples do que já foi resolvido.

Critério de pronto: um usuário real consegue abrir o app, digitar um problema de matemática do ensino médio, ver a resposta certa com uma explicação legível, e voltar depois para ver o que já resolveu — sem nenhuma outra funcionalidade no caminho.

Este documento define o oposto do ARCHITECTURE.md em intenção: onde aquele documento otimiza para **escala futura**, este otimiza para **velocidade de construção e validação agora**. Ambos estão certos — em momentos diferentes.

---

## 2. Fora de Escopo (explicitamente removido do V0)

Cada item abaixo existe na visão do produto (PRD.md) e tem seu design definido (UI_UX.md) ou sua arquitetura prevista (ARCHITECTURE.md) — mas **nenhum deles é construído no V0**. Eles são adiados, não descartados.

| Removido do V0 | Onde está documentado para o futuro |
|---|---|
| Learning Graph | PRD.md §5.2/§11 (RF-09), ARCHITECTURE.md §6.2/§6.4/§21.2 |
| Math Mentor (proatividade, recomendação, celebração) | PRD.md §5.3, UI_UX.md §7 |
| AI Memory (padrões recorrentes, retomada de estudo) | PRD.md §5.6, ARCHITECTURE.md §6.2/§21.3 |
| Confidence Engine completo (métodos, justificativa detalhada) | PRD.md §5.4, ARCHITECTURE.md §8.4/§9.4 |
| Explain Like... dinâmico (múltiplos registros alternáveis) | PRD.md §5.5, UI_UX.md §6.1 |
| Gamificação (XP, níveis, conquistas, streaks, missões) | PRD.md §6, UI_UX.md §9 |
| Dashboard de aprendizado | UI_UX.md §8 |
| OCR / foto / upload de imagem ou PDF | PRD.md §5.1 (RF-02), ARCHITECTURE.md §12/§13 |
| Editor matemático estruturado (teclado visual, LaTeX) | ARCHITECTURE.md §11 |
| Desenho à mão livre | UI_UX.md §5.1 |
| AR, voz, multimodalidade | UI_UX.md §15 |
| Autenticação completa (login social, SSO, MFA) | ARCHITECTURE.md §7 |
| Trilhas de estudo por currículo | PRD.md §5 (RF-14) |
| Modo institucional / professor | PRD.md §6, ARCHITECTURE.md §21.7 |
| API pública / integrações | PRD.md §6, ARCHITECTURE.md §21.8 |
| Cache multi-camada, filas, eventos assíncronos | ARCHITECTURE.md §15/§20 |
| Arquitetura de microsserviços/monorepo completa | ARCHITECTURE.md §1/§18 |

**Regra de disciplina de escopo:** se uma ideia surgir durante a construção do V0 que não está na lista da Seção 3, ela vai para uma lista de "depois" e não entra no V0, mesmo que pareça pequena. Escopo cresce por mil pequenas exceções — o V0 não tem orçamento para nenhuma.

---

## 3. Escopo incluído no V0

### 3.1 Input matemático

- Um único campo de texto onde o usuário digita a expressão matemática usando notação padrão em texto simples (ex.: `x^2 - 4 = 0`, `integral de x^2 dx`, `derivada de sin(x)`).
- Sem editor visual estruturado, sem teclado matemático, sem reconhecimento de imagem. Apenas texto puro digitado.
- Validação mínima: se a expressão não puder ser interpretada, mostrar uma mensagem de erro simples e legível pedindo para reformular — sem diagnóstico inteligente de erro de digitação.

### 3.2 Engine matemática

- Motor simbólico determinístico (SymPy ou equivalente), chamado diretamente pelo backend — sem isolamento em serviço separado, sem sandboxing dedicado além da validação básica de entrada seguindo os mesmos princípios de segurança do ARCHITECTURE.md §16.1 (nunca avaliação de código arbitrário sobre a entrada do usuário).
- Cobertura funcional mínima:
  - **Equações**: resolução de equações do 1º e 2º grau, e sistemas lineares simples.
  - **Derivadas**: derivadas de funções simples (polinomiais, trigonométricas, exponenciais, logarítmicas) de uma variável.
  - **Integrais**: integrais indefinidas e definidas simples de uma variável, dos mesmos domínios de função.
  - **Simplificação**: simplificação de expressões algébricas.
- Fora dessa lista (sistemas não lineares, EDOs, séries, álgebra linear, estatística, matrizes) não é tratado no V0 — retorna mensagem clara de "este tipo de problema ainda não é suportado", nunca uma tentativa silenciosa e potencialmente incorreta.

### 3.3 Resultado

- **Resposta final**, sempre em destaque, sempre primeiro elemento visível.
- **Passos básicos de resolução**, quando o motor simbólico conseguir produzi-los de forma estruturada (ex.: SymPy expõe etapas de simplificação/resolução) — exibidos como uma lista simples e sequencial, sem `StepCard` interativo, sem numeração rica de conceitos, sem chips clicáveis.
- **Explicação simples em texto**: um template de texto fixo por tipo de operação (ex.: "Para resolver esta equação do 2º grau, aplicamos a fórmula de Bhaskara com a = _, b = _, c = _"), preenchido com os valores reais do problema. **Não é geração via LLM neste estágio** — é texto gerado por template determinístico a partir da estrutura de passos do motor simbólico. Isso elimina a dependência de um LLM Gateway inteiro para o V0 funcionar.
- Sem gráfico, sem indicador de confiança, sem conceitos matemáticos etiquetados, sem exercícios semelhantes, sem vídeos recomendados.

### 3.4 Interface mínima

Uma única tela, contendo apenas:
- Campo de input (Seção 3.1).
- Botão "Resolver".
- Área de resultado (Seção 3.3), exibida abaixo do campo após o clique.
- Uma lista simples de histórico (Seção 3.5) visível na mesma tela ou em uma segunda tela acessível por um único link — a decisão de ser a mesma tela ou uma segunda é de execução, não de escopo, mas em nenhum caso deve exigir mais de duas telas no total.

Sem sidebar, sem header de navegação complexo, sem dark mode obrigatório (pode nascer com um único tema), sem componentes de design system completo do UI_UX.md — o V0 usa estilização mínima e funcional, coerente com as cores/tipografia básicas definidas no UI_UX.md apenas como referência de bom gosto, não como sistema de tokens implementado.

### 3.5 Histórico simples

- Cada resolução salva: **expressão digitada, resultado final, data/hora**.
- Sem conta de usuário obrigatória no V0: histórico pode ser salvo em armazenamento local do navegador (ex.: local storage) **ou** em uma tabela simples de banco de dados associada a um identificador de sessão anônima — qualquer uma das duas abordagens é aceitável; a escolha fica a critério de quem implementa, com preferência pela opção mais rápida de construir.
- Sem edição, sem categorização, sem busca avançada, sem exportação — apenas uma lista cronológica simples, mais recente primeiro.
- Sem vínculo com Learning Graph ou AI Memory: o histórico do V0 é puramente uma lista, sem nenhuma interpretação sobre ela.

---

## 4. Forma técnica recomendada para o V0

Esta seção existe para deixar explícito que a simplicidade do escopo (Seção 3) também deve se refletir na simplicidade da construção — não faz sentido aplicar o estilo arquitetural do ARCHITECTURE.md a este marco.

- **Uma única aplicação**, sem separação em Core API + Math Engine + LLM Gateway + OCR Service. O motor simbólico é uma função chamada diretamente pelo backend da aplicação.
- **Um único banco de dados simples** (ou nem isso, se o histórico for local storage) — sem PostgreSQL com múltiplos schemas por módulo, sem Redis, sem object storage, sem vector store.
- **Sem autenticação completa** — não há login, plano, papel de usuário ou sessão persistente de conta.
- **Sem fila, sem eventos assíncronos, sem streaming** — a resposta é calculada e devolvida em uma única chamada síncrona.
- **Sem monorepo** — uma estrutura de pastas simples de frontend + backend é suficiente; a estrutura completa do ARCHITECTURE.md §18 só se justifica quando houver múltiplos serviços reais para organizar.

Essa simplicidade é temporária e deliberada — o modelo de dados e a separação de responsabilidades da Seção 3 já são desenhados de um jeito que **não contradiz** o caminho de evolução para a arquitetura completa (ex.: o conceito de "Problem + Solution" já existe implicitamente nos campos salvos no histórico), evitando retrabalho conceitual quando o V0 evoluir para o V1.0.

---

## 5. Regras de disciplina de escopo

- Não criar arquitetura de microsserviços, camadas de abstração ou contratos de API versionados neste estágio — isso pertence ao ARCHITECTURE.md e será aplicado quando o produto justificar.
- Não introduzir IA generativa (LLM) para explicação no V0 — usar texto template determinístico é suficiente para validar se a experiência de "resposta + explicação clara" já gera valor percebido, antes de investir em geração de linguagem natural.
- Não adicionar nenhuma feature da lista da Seção 2, mesmo em versão "simplificada" — uma versão simplificada de Learning Graph ainda é Learning Graph, e não pertence aqui.
- Não otimizar prematuramente para escala, custo de infraestrutura ou internacionalização — o V0 serve a um número pequeno de usuários de teste.
- Se um problema matemático fora da cobertura da Seção 3.2 aparecer durante testes, a resposta correta é "fora de escopo, mensagem de erro clara" — nunca uma tentativa de suporte parcial mal testado.

---

## 6. Critérios de sucesso do V0

O V0 é considerado bem-sucedido quando, com usuários reais de teste (mesmo que um grupo pequeno e informal):

- Um usuário consegue digitar um problema de matemática do ensino médio (equação, derivada ou integral simples) e obter a resposta correta em menos de alguns segundos.
- A explicação em texto é compreensível o suficiente para que o usuário relate ter entendido *como* chegou à resposta, não apenas *qual* é a resposta.
- O usuário consegue voltar ao app e encontrar o que resolveu anteriormente, sem precisar de instrução.
- Nenhuma resposta matemática incorreta é apresentada como correta dentro do escopo suportado (Seção 3.2) — precisão continua sendo inegociável mesmo no menor escopo possível.
- O tempo de construção do V0, do zero até este critério, é medido em **dias**, não semanas.

---

## 7. Definition of Done do V0

- [ ] Campo de input aceita expressão matemática em texto.
- [ ] Backend resolve equações (1º/2º grau, sistemas lineares simples), derivadas simples, integrais simples e simplificações.
- [ ] Resultado exibe resposta final, passos básicos (quando disponíveis) e explicação em texto template.
- [ ] Erros de entrada não suportada exibem mensagem clara, sem quebrar a aplicação.
- [ ] Histórico salva expressão, resultado e data, e é visível ao usuário.
- [ ] Aplicação funciona de ponta a ponta em um fluxo único, sem dependência de nenhum item listado na Seção 2.

---

## 8. Depois do V0

Ao validar os critérios da Seção 6, o caminho natural **não é adicionar tudo de uma vez** — é retomar o roadmap já definido no PRD.md (Seção 14), começando pelo escopo do **MVP de Produto / V1.0** (PRD.md, Seção 13), que reintroduz de forma gradual: OCR básico, Confidence Engine inicial, Learning Graph inicial, AI Memory inicial e Math Mentor inicial — nessa ordem de prioridade sugerida, e não como um salto direto de volta para a visão completa da arquitetura.

---

*Fim do documento.*
