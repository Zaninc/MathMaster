# SESSION_LOG_2026-07-05-sprint5.md
## MathMaster — Registro de Sessão

| | |
|---|---|
| **Data** | 2026-07-05 |
| **Produto** | MathMaster |
| **Escopo da sessão** | Sprint 5 do MVP Técnico (V0) — primeiro módulo funcional de Equações |

---

## 1. O que foi implementado hoje

Implementado o módulo funcional da área `equations/` dentro da arquitetura do Math Engine estabelecida na Sprint 4 (que já continha o placeholder vazio). Cobertura final: equações do 1º grau, do 2º grau, polinomiais de grau ≥ 3, equações com valor absoluto (`Abs()`), inequações lineares e polinomiais básicas (todas via `solve()`/`solveset()`, sem passos ainda), soluções complexas quando aplicável, e sistemas lineares gerais (N incógnitas, não só 2). Explicitamente fora de escopo (módulos próprios em sprints futuras): equações/inequações trigonométricas, logarítmicas e exponenciais.

A sprint evoluiu em três rodadas, cada uma validada e testada antes da próxima, a pedido explícito:
1. Versão inicial: 1º/2º grau + sistemas de 2 incógnitas.
2. Extensão 1: polinomiais de grau ≥ 3, soluções complexas, sistemas lineares gerais (N incógnitas, via `linsolve`).
3. Extensão 2 (final): inequações básicas (`inequalities.py`) e equações com valor absoluto (`absolute.py`).

Nenhuma reestruturação foi necessária em nenhuma rodada — cada extensão só adicionou módulo(s) novo(s) e ajustou o dispatcher de área, conforme a arquitetura prevista desde a Sprint 4.

`math_engine/dispatcher.py` (arquivo compartilhado) ganhou uma única ramificação nova: se a expressão parece pertencer ao domínio de equações/inequações (`is_equation_domain_expression()` — contém `=` fora de `==`/`<=`/`>=`/`!=`, **ou** contém `<`, `>`, `<=`, `>=`), delega inteiramente para `equations.dispatcher`; caso contrário, segue **exatamente** o caminho de antes (`parse_expr` + `algebra.dispatcher`), sem nenhuma alteração de comportamento.

## 2. Arquivos criados e modificados

### 2.1 Novo — `backend/app/math_engine/equations/`

| Arquivo | Responsabilidade |
|---|---|
| `dispatcher.py` | `looks_like_equation()`, `looks_like_inequality()` e `is_equation_domain_expression()` (detecção via regex); `solve_equation_text()` — se for inequação, resolve isolado via `inequalities.py`; senão faz split em `;`/`\n` (múltiplas equações → `systems.py`), parse com `convert_equals_signs`, checa `Abs()` (→ `absolute.py`) e por fim roteia por grau: 1 → linear, 2 → quadratic, ≥3 → polynomial, outro → `ExpressionError` |
| `linear.py` | `solve_linear()` — equações do 1º grau via `sympy.solve()` |
| `quadratic.py` | `solve_quadratic()` — equações do 2º grau via `sympy.solve()`. Isolado em módulo próprio propositalmente, para que a Bhaskara passo a passo (sprint futura de explicações) possa ser adicionada aqui sem reestruturar nada |
| `polynomial.py` | `solve_polynomial()`: equações polinomiais de grau ≥ 3 via `sympy.solve()`. Não requer código especial para raízes complexas — `solve()` já retorna `I`/`-I` etc. naturalmente quando não há raízes reais suficientes |
| `systems.py` | `solve_linear_system()` — sistemas lineares com N incógnitas, via `sympy.linsolve()` (lida melhor com sistemas retangulares e representa sistema sem solução como conjunto vazio, do que o `solve()` usado na primeira versão) |
| `inequalities.py` | **Novo (extensão final)** — `solve_inequality()`: inequações lineares e polinomiais básicas de uma incógnita, via `sympy.solveset(..., domain=S.Reals)`, retornando um `Interval`/`Union` (ex.: `Interval.open(3, oo)`) |
| `absolute.py` | **Novo (extensão final)** — `solve_absolute_equation()`: equações com `Abs()` (ex.: `Abs(x-3) = 5`), via `sympy.solveset(..., domain=S.Reals)`, retornando um conjunto finito (ex.: `{-2, 8}`). `sympy.solve()` puro falha nesses casos (`NotImplementedError`, pois não sabe que `x` é real) — `solveset` com `domain=S.Reals` resolve isso sem precisar redeclarar o símbolo com `real=True` |

`equations/__init__.py` já existia vazio desde a Sprint 4 (placeholder); não precisou de conteúdo.

### 2.2 Modificado

`backend/app/math_engine/dispatcher.py` — o `if looks_like_equation(...)` da primeira versão foi generalizado para `if is_equation_domain_expression(...)` (equação **ou** inequação), para acomodar a extensão final. O caminho `else` (álgebra) continua byte-a-byte idêntico ao original.

### 2.3 Frontend / API pública

Nenhuma alteração — `SolveRequest`/`SolveResponse`/`HistoryItem` e os três endpoints (`/health`, `/solve`, `/history`) permanecem idênticos.

---

## 3. Testes executados

### 3.1 Validação isolada (scripts descartáveis, removidos após uso)

Rodada em três etapas (uma por versão da sprint), todas 100% corretas:

**Rodada 1 (`_validate_sprint5.py`)** — 9/9 casos via `solve_expression()` direto:
- 4 casos de compatibilidade (Sprints 1-4): `2+2`, `x**2-4`, `diff(x**2,x)`, `integrate(x**2,x)` — **saída idêntica à anterior**.
- 4 casos novos obrigatórios: `2*x+5=17` → `x = 6`; `3*x-9=0` → `x = 3`; `x**2-5*x+6=0` → `x = 2, x = 3`; `x + y = 5; x - y = 1` → `x = 3, y = 2`.
- 1 caso extra: mesmo sistema separado por `\n` em vez de `;` → mesmo resultado (engine aceita ambos os delimitadores).

**Rodada 2 (`_validate_sprint5b.py`)** — repete os 9 casos acima (idênticos) e adiciona 4 novos:
- `x**2 + 1 = 0` → `x = -I, x = I` (raízes complexas de uma quadrática, comportamento nativo do `solve()`)
- `x**3 - 6*x**2 + 11*x - 6 = 0` → `x = 1, x = 2, x = 3` (cúbica fatorável)
- `x**4 - 1 = 0` → `x = -1, x = 1, x = -I, x = I` (quártica, mistura raízes reais e complexas)
- `x + y + z = 6; x - y + z = 2; x + y - z = 0` → `x = 1, y = 2, z = 3` (sistema linear de 3 incógnitas, antes só testado com 2)

**Rodada 3 (`_validate_sprint5c.py`, final)** — repete os 13 casos acima (todos idênticos) e adiciona 5 novos:
- `x + 2 > 5` → `Interval.open(3, oo)`
- `x**2 - 4 > 0` → `Union(Interval.open(-oo, -2), Interval.open(2, oo))`
- `2*x - 4 <= 0` → `Interval(-oo, 2)`
- `Abs(x - 3) = 5` → `{-2, 8}`
- `Abs(2*x + 1) = 7` → `{-4, 3}`

Total: 18/18 casos corretos na validação final.

### 3.2 Smoke test via API real (`uvicorn` + `curl`)

Todos os 18 casos repetidos via `POST /solve` real, na rodada final — resultados idênticos à validação isolada. `GET /history` conferido ao final: 16 resoluções (as 18 chamadas, 2 repetidas de rodadas anteriores) aparecem corretamente, mais recente primeiro, sem quebrar o schema existente (`HistoryItem` continua só `expression`/`result`/`timestamp`).

---

## 4. Limitação conhecida (documentada, não corrigida nesta sprint)

A interface atual usa um único `<input type="text">` (Sprint 2) — **uma linha só**, onde `Enter` submete o formulário. Isso significa que um sistema digitado em **múltiplas linhas** (como no exemplo do enunciado da sprint) **não é alcançável pela UI hoje**, embora a engine já suporte esse formato (`\n` como separador, testado via API).

Alternativa que **já funciona sem tocar no frontend**: separar as equações por `;` na mesma linha (ex.: `x + y = 5; x - y = 1`), testado e funcionando de ponta a ponta via `/solve`.

Resolver essa limitação de UI (textarea, ou múltiplos campos, ou editor estruturado) fica para uma sprint de frontend futura (Fase 5 do roadmap) — está fora do escopo desta sprint, que era exclusivamente de motor.

---

## 5. Estado atual do projeto

- **Motor matemático**: `algebra/` (Sprint 4) e `equations/` (Sprint 5, completo: linear + quadratic + polynomial + systems + inequalities + absolute) implementados. `functions/`, `trigonometry/`, `logarithms/`, `calculus/`, `matrices/`, `parser/` seguem como placeholders vazios.
- **API pública**: inalterada.
- **Frontend**: inalterado.
- **Ainda sem**: Bhaskara passo a passo (só `solve()`/`solveset()` direto por enquanto), explicações de qualquer tipo, sistemas não-lineares (a `systems.py` usa `linsolve`, exclusivo para sistemas **lineares**), inequações/equações trigonométricas, logarítmicas ou exponenciais (módulos próprios em sprints futuras), IA, e qualquer forma de a UI enviar múltiplas equações de fato (só via API/curl por enquanto).
- **Ainda sem testes automatizados**: validação manual (script descartável + curl), como nas sprints anteriores.

---

## 6. Objetivo da Sprint 6

Implementar a área de Funções (`backend/app/math_engine/functions/`), seguindo o mesmo padrão arquitetural (operações isoladas + dispatcher de área), sem alterar a API pública além do estritamente necessário.

---

*Fim do documento.*
