# SESSION_LOG_2026-07-12-sprint-parser.md
## MathMaster — Registro de Sessão

| | |
|---|---|
| **Data** | 2026-07-12 |
| **Produto** | MathMaster |
| **Escopo da sessão** | Sprint Parser — entrada matemática mais natural (Unicode, aliases em português, potência/multiplicação naturais) sem quebrar segurança, contratos ou resultados já validados |

---

## 0. Processo

Sessão dividida em duas fases: (1) auditoria completa (20 pontos analisados, com verificação empírica direta contra `solve_expression()`/`safe_parse_expr()`, não suposição sobre o código) + plano em camadas, apresentado e aprovado sem implementação; (2) 5 decisões de ambiguidade fechadas via `AskUserQuestion` antes de codar (escopo obrigatório+desejável junto; `x2`/`x1` corrigidos e rejeitados por ambiguidade; `xy` passa a ser rejeitado, não mais produto implícito silencioso; `f(2)=...` e `log(100,10)` seguem fora de escopo); implementação em etapas pequenas, cada uma testada isoladamente antes de avançar. Nenhum commit foi feito nesta sessão — fica pendente de aprovação explícita da mensagem.

---

## 1. Diagnóstico (resumo da auditoria)

Achado central: a "multiplicação implícita" que já existia (`2x`, `xy`, `abc`) não vinha de um recurso pensado para o MathMaster — vinha da transformação `split_symbols` do SymPy (embutida em `implicit_multiplication_application`), cujo comportamento real é quebrar todo identificador de múltiplas letras não reconhecido, letra a letra, e multiplicar. Confirmado empiricamente que isso fazia aliases em português produzirem **respostas matematicamente erradas e silenciosas**: `sen(x)` → `e*n*s*x` (sem erro nenhum). Achado secundário: identificadores terminados em dígito (`x2`, `x1`) já falhavam hoje, mas por um efeito colateral não documentado — a whitelist de segurança do Hardening III (`_SAFE_GLOBAL_DICT`) não incluía `Number`, que o próprio `split_symbols` precisa internamente para esses casos, produzindo um `NameError` genérico em vez de uma rejeição deliberada. Nenhum sobrescrito Unicode, raiz Unicode, operador Unicode ou alias em português funcionava antes desta sprint — 100% do escopo obrigatório era código novo. O relatório completo (20 pontos, classificação obrigatório/desejável/avançado/fora de escopo, arquitetura em 8 camadas) foi apresentado antes da implementação e não é repetido aqui.

---

## 2. O que foi implementado

### Etapa 1 — Correção da whitelist (`Number`) + camada de rejeição de ambiguidade
`Number` adicionado a `_REQUIRED_CONSTRUCTORS` em `safe_parsing.py` (fecha o efeito colateral do Hardening III). Nova `_reject_ambiguous_identifiers()`: qualquer identificador de 2+ letras que não seja uma função/constante conhecida (nem esteja no `local_dict` daquela chamada específica) é rejeitado com `ExpressionError` explícita, ANTES do SymPy ver o texto — substitui o comportamento anterior de "quebra letra a letra e multiplica" por uma rejeição limpa. `local_dict` (já usado por cada dispatcher de domínio) é o mecanismo de isenção por chamada — sem precisar tocar nos 6 dispatchers existentes.

### Etapa 2 — `cbrt` correto
Whitelist ganhou `cbrt`. Descoberta durante a implementação (não estava no plano original): `sympy.cbrt(-8)` sozinho devolve a raiz complexa principal (`2*(-1)**(1/3)`), não `-2` — matematicamente errado para o que um estudante espera. Wrapper `_cbrt()` usa `sympy.real_root` quando o argumento é um número literal (dá `-2`) e mantém `cbrt` simbólico quando não é (evita uma `Piecewise` feia para `∛x`).

### Etapa 3 — `math_engine/parser/normalize.py` (novo)
Preenche o placeholder `parser/` do roadmap. `normalize_expression()` compõe, nesta ordem: (1) `sen²(x)` → `sen(x)**2` (bracket-matching real, preserva o nome do alias para a etapa 5 trocar depois); (2) `π`→`pi`, `×÷−≤≥≠`→ASCII; (3) `√`/`∛` atômico ou entre parênteses → `sqrt(...)`/`cbrt(...)`; (4) sobrescrito genérico sobre átomo ou grupo entre parênteses → `**n` (cobre `x²`, `(x+1)²` e também `sin(x)²`/`sqrt(x)²` de graça, sem regra extra — inserir `**n` no lugar do sobrescrito já produz o resultado certo por precedência normal de operadores, sem precisar reconstruir a "base"); (5) `sen/tg/raiz` → `sin/tan/sqrt`, só na forma de chamada (`\bsen\(`, nunca substring). Puramente textual (regex + um bracket-matcher pontual para o caso 1), nunca importa SymPy. Idempotente por construção — todo padrão de saída deixa de casar com o regex de origem.

### Etapa 4 — Integração no dispatcher
`normalize_expression()` roda no topo de `math_engine/dispatcher.py:solve_expression()`, antes de qualquer `is_*_domain_expression()` — necessário porque os roteadores de domínio decidem por regex sobre o texto bruto (`sen(x)` só vira trigonometria depois de virar `sin(x)`).

### Etapa 5 — Nome de parâmetro de função
`functions/dispatcher.py`: o nome declarado em `nome(variavel)=...` agora entra no `local_dict` do parse do corpo, mesmo padrão já usado por `trigonometry/` para `tau` — sem isso, um parâmetro de função com mais de uma letra (nunca testado antes, mas sempre sintaticamente aceito pelo regex de definição) seria incorretamente rejeitado pela nova camada de ambiguidade.

### Etapa 6 — `main.py`
Descoberta durante a implementação (não estava no plano original, confirmada empiricamente antes de codar): `formatter/safe_parse.py:guess_symbol()` usa `\w` do Python, que é Unicode-aware e trata `²` como caractere alfanumérico — `guess_symbol("x²-4=0")` enxergava a variável como `"x²"`, não `"x"`, quebrando a rotulagem `x₁ = -2, x₂ = 2` para qualquer entrada com sobrescrito Unicode. Corrigido calculando `normalize_expression(request.expression)` uma vez em `main.py` e passando esse texto (não o original) para `format_result()`; `request.expression` continua intocado para `add_entry()`/`SolveResponse` (histórico e resposta sempre mostram exatamente o que o usuário digitou).

---

## 3. Arquivos criados

`backend/app/math_engine/parser/normalize.py`, `backend/tests/math_engine/test_normalize.py`, `docs/SESSION_LOG_2026-07-12-sprint-parser.md`.

## 4. Arquivos modificados

`backend/app/math_engine/safe_parsing.py` (`Number`, `cbrt`/`_cbrt`, `_reject_ambiguous_identifiers`), `backend/app/math_engine/parser/__init__.py` (deixa de ser placeholder vazio), `backend/app/math_engine/dispatcher.py` (chama `normalize_expression`), `backend/app/math_engine/functions/dispatcher.py` (`local_dict` com o nome do parâmetro), `backend/app/math_engine/__init__.py` (re-exporta `normalize_expression`), `backend/app/main.py` (normaliza antes de `format_result`), `backend/tests/math_engine/test_safe_parsing.py` (casos de ambiguidade + `cbrt`), `backend/tests/fixtures/regression_cases.py` (novos `EXACT_CASES`/`ERROR_CASES`), `backend/tests/test_api.py` (smoke de Unicode + histórico), `ARCHITECTURE.md` (§8.2).

---

## 5. Testes executados

**349/349 testes pytest aprovados** (232 pré-existentes + 117 novos: 77 unitários de `normalize.py`, mais casos de ambiguidade/`cbrt` em `test_safe_parsing.py`, novos casos exatos/erro em `regression_cases.py`, 3 novos smoke tests de API), cobertura de linha **91%** (idêntica à baseline, não regrediu). Todos os 232 testes pré-existentes continuam produzindo saída byte a byte idêntica — nenhuma asserção existente foi alterada, só adicionadas.

Smoke test manual via `uvicorn` real + `curl` com payload UTF-8 explícito (não inline, para evitar mangling de codepage do shell): `x²-4=0` → `x₁ = -2, x₂ = 2`; `3√2` → `3*√2`; `sen(x)**2 + cos(x)**2` → identidade trigonométrica; `raiz(16)` → `4`; `xy` → rejeitado com `ExpressionError`; `/history` confirmado mostrando a expressão Unicode original, não a normalizada.

`pip-audit` não pôde rodar nesta máquina (falha de encoding do `pip_api` ao decodificar `pip --version`, causada pelo acento no nome da pasta do usuário do Windows — ambiente, não código; nenhuma dependência foi tocada nesta sprint).

---

## 6. Regressões encontradas

**Nenhuma.** Os 232 testes da suíte de compatibilidade (Sprints 4-11 + Hardenings) continuam idênticos. Dois comportamentos mudaram deliberadamente, ambos por decisão explícita do Theo (§7 da auditoria) e sem nenhum teste existente dependendo do comportamento anterior (confirmado por varredura de toda a suíte antes de implementar): `xy`/`abc`-style agora rejeitam em vez de virar produto de letras; `x2`/`x1` agora rejeitam com mensagem clara em vez de um erro genérico.

---

## 7. Riscos conhecidos, deixados fora do escopo (deliberado)

- **`log(100,10)` (forma de 2 argumentos)**: continua não suportado — decisão explícita do Theo, a convenção `log()=base10` já cobre o caso de uso.
- **`f(2)=x²+3x` (mistura definição+avaliação)**: continua rejeitado — construto genuinamente ambíguo, decisão explícita de não adivinhar.
- **Frontend**: `frontend/app/page.tsx` não foi tocado, conforme instrução — `<input>` continua enviando o texto cru; toda a normalização é só no backend.
- **Nomes de alias em maiúscula/mista** (`SEN`, `Tg`): não suportado, fora do que foi pedido — mesma lista fechada e sensível a caixa dos exemplos originais.
- **`pip-audit`**: não confirmado nesta sessão pelo problema de ambiente acima — recomendado rodar via CI (`.github/workflows/backend-tests.yml`, job `security-audit`) antes do próximo push, já que nenhuma dependência mudou.

---

## 8. Estado atual do projeto

- Normalização Unicode (sobrescritos, √/∛, π, operadores de comparação) e aliases em português (`sen`/`tg`/`raiz`) funcionando de ponta a ponta via `/solve`.
- Potência natural (`x²`, `(x+1)²`, `sen²(x)`) e multiplicação combinada (`2π`, `3√2`) funcionando.
- Camada de ambiguidade rejeita explicitamente identificadores de múltiplas letras não reconhecidos — nunca mais "adivinha" nem produz resposta matematicamente errada em silêncio.
- `safe_parse_expr` continua sendo o único ponto de entrada seguro para o SymPy, agora com uma camada adicional de rejeição, não removida nem enfraquecida.
- Histórico e resposta da API continuam preservando a expressão original exatamente como digitada, incluindo Unicode.
- 349 testes, 91% de cobertura.
- Nenhum commit/push realizado nesta sessão — aguardando aprovação explícita da mensagem de commit.

## 9. Objetivo da próxima sprint

A definir com Theo — candidatos: Cálculo (próximo item "natural" do roadmap principal), ou os itens de risco registrados no Hardening III §7 (pool de processos recicláveis, limite de memória por SO, multi-worker com storage compartilhado) que seguem em aberto.
