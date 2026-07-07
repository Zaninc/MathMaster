# SESSION_LOG_2026-07-07-sprint7.md
## MathMaster — Registro de Sessão

| | |
|---|---|
| **Data** | 2026-07-07 |
| **Produto** | MathMaster |
| **Escopo da sessão** | Sprint 7 do MVP Técnico (V0) — módulo funcional de Trigonometria |

---

## 1. O que foi implementado hoje

Implementado o módulo funcional da área `trigonometry/` dentro da arquitetura do Math Engine estabelecida nas Sprints 4-6 (placeholder vazio até então). Cobertura: seno, cosseno, tangente e suas inversas (`asin`/`acos`/`atan`), valores notáveis (`pi/6`, `pi/4`, `pi/3`, `pi/2`, `2*pi`, `3*pi/4`, `tau`), simplificação trigonométrica geral, identidades trigonométricas fundamentais (que colapsam para uma constante) e equações trigonométricas básicas de uma incógnita.

A ordem de prioridade do dispatcher central passou a ser `functions → trigonometry → equations → algebra` (nova ramificação de trigonometria inserida entre funções e equações, conforme pedido). Uma equação trigonométrica como `sin(x) = 1/2` é interceptada pela própria área de trigonometria — nunca chega ao `equations/dispatcher` genérico — e resolvida via `solveset(domain=S.Reals)`, retornando o conjunto de solução periódico nativo do SymPy (ex.: `Union(ImageSet(Lambda(_n, 2*_n*pi + pi/6), Integers), ...)`).

Para expressões trigonométricas sem `=`, o resultado é sempre `trigsimp(simplify(expr))` (ou a variante de valor notável/inversa); a classificação (`classification.py`) só decide o rótulo `"Tipo:"` exibido, nunca deixa de simplificar — por isso `2*sin(x)*cos(x)` → `sin(2*x)` e `sin(x)/cos(x)` → `tan(x)` continuam sendo simplificados normalmente mesmo rotulados como "expressão trigonométrica" (geral), e não como "identidade fundamental" (reservado para os casos que colapsam para uma constante, ex. `sin(x)**2+cos(x)**2` → `1`).

### 1.1 Duas descobertas técnicas que exigiram ajuste de rota durante a implementação

- **`tau` não é reconhecido nativamente pelo `parse_expr`** (vira `Symbol("tau")` solto, não `2*pi`) — confirmado empiricamente antes da implementação. Resolvido com `local_dict={"tau": 2*pi}` nos dois pontos de parsing da área (`dispatcher.py` e `equations.py`), com comentário no código explicando o motivo.
- **`asin`/`acos`/`atan` de argumentos notáveis (ex.: `asin(1/2)`) são avaliados eagerly pelo SymPy para `pi/6` assim que a expressão é montada**, fazendo o próprio nó `asin` desaparecer da árvore antes da classificação rodar. Checar `expr.has(asin, acos, atan)` falhava silenciosamente nesses casos (classificava como "valor notável" em vez de "trigonometria inversa"). Corrigido detectando a chamada inversa a partir do **texto de origem** (`mentions_inverse_trig()`, regex sobre a string, não sobre a árvore), documentado com um comentário em `inverse.py`.

## 2. Arquivos criados e modificados

### 2.1 Novo — `backend/app/math_engine/trigonometry/`

| Arquivo | Responsabilidade |
|---|---|
| `dispatcher.py` | `is_trigonometry_domain_expression()` (detecção via regex de chamada `sin/cos/tan/asin/acos/atan(`), `solve_trigonometry_text()` — decide equação vs. expressão, parse com `local_dict` do `tau`, orquestra os demais módulos |
| `classification.py` | `classify_trig_expression()` — decide entre trigonometria inversa / valor notável / identidade fundamental / expressão geral |
| `values.py` | `evaluate_notable_value()` — avaliação de expressão numérica pura (delega ao `simplify` nativo, que já resolve os ângulos notáveis) |
| `simplify.py` | `simplify_trig()` — `trigsimp(simplify(expr))`, usado tanto pela detecção de identidade quanto pelo caso geral |
| `identities.py` | `is_fundamental_identity()` — usa `simplify.py` para checar se uma expressão simbólica colapsa para uma constante |
| `equations.py` | `solve_trig_equation()` — parse da equação (`convert_equals_signs` + `local_dict` do `tau`), validação de uma incógnita só, `solveset(domain=S.Reals)` |
| `inverse.py` | `mentions_inverse_trig()` (detecção via texto), `validate_inverse_domain()` (checa `[-1,1]` para `asin`/`acos` quando o argumento é numérico), `evaluate_inverse()` |

`trigonometry/__init__.py` já existia vazio desde a Sprint 4 (placeholder); não precisou de conteúdo.

### 2.2 Modificado

- `backend/app/math_engine/dispatcher.py` — adicionado `if is_trigonometry_domain_expression(...)` entre a checagem de funções e a de equações já existentes. Nenhuma outra linha alterada.
- `backend/app/math_engine/functions/dispatcher.py` — **ajuste necessário, fora do escopo inicialmente previsto**: o regex de definição de função da Sprint 6 (`nome(var) = expr`) casava sintaticamente com `sin(x) = 1/2`, roubando a prioridade de `functions/` sobre `trigonometry/` e produzindo um erro incorreto ("Funções de grau 0..."). Corrigido com uma lista de nomes reservados (`sin`, `cos`, `tan`, `asin`, `acos`, `atan`) que `looks_like_function_definition()` agora rejeita como nome de função definida pelo usuário — descoberto e corrigido durante a validação isolada desta sprint, antes de qualquer commit.

### 2.3 Frontend / API pública

Nenhuma alteração — `SolveRequest`/`SolveResponse`/`HistoryItem` e os três endpoints (`/health`, `/solve`, `/history`) permanecem idênticos.

---

## 3. Testes executados

### 3.1 Validação isolada (script descartável, removido após uso)

37 casos via `solve_expression()` direto, todos corretos após as duas correções da seção 1.1:
- 26 casos de compatibilidade (Sprints 1-6): idênticos aos resultados anteriores, sem nenhuma regressão.
- 14 casos novos de trigonometria:
  - `sin(pi/6)`, `cos(pi/3)`, `tan(pi/4)`, `sin(pi/2)`, `cos(pi)`, `sin(2*pi)`, `cos(3*pi/4)`, `sin(tau)` → valores notáveis exatos
  - `asin(1/2)` → `pi/6`, `acos(1)` → `0`, `atan(1)` → `pi/4` → classificados corretamente como "trigonometria inversa"
  - `sin(x)**2+cos(x)**2` → `1` (identidade trigonométrica fundamental)
  - `2*sin(x)*cos(x)` → `sin(2*x)`, `sin(x)/cos(x)` → `tan(x)` (expressão trigonométrica, simplificação geral)
- 3 equações trigonométricas: `sin(x) = 1/2`, `cos(x) = 0`, `tan(x) = 1` → conjuntos de solução periódicos corretos via `solveset`
- 2 casos de erro esperado: `asin(2)`, `acos(-2)` → `ExpressionError` de domínio `[-1, 1]`

### 3.2 Smoke test via API real (`uvicorn` + `curl`)

14 casos repetidos via `POST /solve` real (compatibilidade + novos + equações + erro de domínio), resultados idênticos à validação isolada, incluindo o erro de domínio retornado como HTTP 400. `GET /history` conferido ao final: 13 resoluções bem-sucedidas aparecem corretamente, mais recente primeiro, schema intacto (a chamada com erro de domínio corretamente não gerou entrada no histórico).

---

## 4. Estado atual do projeto

- **Motor matemático**: `algebra/` (Sprint 4), `equations/` (Sprint 5), `functions/` (Sprint 6) e `trigonometry/` (Sprint 7, completo: classificação, valores notáveis, simplificação, identidades fundamentais, equações básicas, inversas) implementados. `logarithms/`, `calculus/`, `matrices/`, `parser/` seguem como placeholders vazios.
- **API pública**: inalterada.
- **Frontend**: inalterado.
- **Ainda sem**: `sec`/`csc`/`cot`, funções hiperbólicas, graus/conversão grau↔radiano, Lei dos Senos/Cossenos, resolução de triângulos, logaritmos, exponenciais, derivadas, integrais, gráficos (todos explicitamente fora de escopo desta sprint), equações trigonométricas com mais de uma incógnita ou sistemas, passos pedagógicos para nenhuma área.
- **Limitação conhecida, corrigida na Sprint 7.1**: `f(x) = sin(x)` (Sprint 6) sem chamada de avaliação levantava `ExpressionError` na classificação de `functions/` (`Poly(sin(x), x)` falhava) — resolvido pela Sprint 7.1 (ver seção 6 abaixo), que introduziu a classificação "função transcendente".
- **Ainda sem testes automatizados**: validação manual (script descartável + curl), como nas sprints anteriores. Permanece assim após a Sprint 7.1.

---

## 5. Objetivo original da Sprint 8 (antes do hardening)

Implementar a área de Logaritmos/Exponenciais (`backend/app/math_engine/logarithms/`), seguindo o mesmo padrão arquitetural (operações isoladas + dispatcher de área), sem alterar a API pública além do estritamente necessário. Atenção redobrada na ordem de detecção do dispatcher central, dado o precedente desta sprint (colisão sintática entre `functions/` e nomes de função reservados de outras áreas).

---

## 6. Sprint 7.1 — Hardening pós-auditoria (2026-07-08)

Antes de iniciar a Sprint 8, foi conduzida uma auditoria técnica completa das Sprints 1-7 (arquitetura, dispatcher, compatibilidade, performance, segurança, organização, código morto, dívida técnica, escalabilidade). A auditoria confirmou **zero regressão** em todo o histórico do projeto, mas encontrou 3 problemas reais que foram corrigidos nesta sprint pontual de hardening — sem adicionar nenhuma funcionalidade nova, sem tocar em frontend/API pública/comportamento já correto.

### 6.1 Problemas encontrados e como foram resolvidos

**1. `functions/classification.py` falhava para corpos de função transcendentes.**
`f(x) = sin(x)`, `f(x) = log(x)`, `f(x) = exp(x)`, `f(x) = sqrt(x)` (sem chamada de avaliação) levantavam `ExpressionError: Não foi possível classificar a função`, porque `Poly(expr, symbol)` não sabe representar corpos não-polinomiais e o `except Exception` genérico convertia qualquer falha em erro. Confirmado empiricamente que `Poly()` levanta `sympy.polys.polyerrors.PolynomialError` de forma uniforme para os 4 casos.
**Correção:** o `except` foi estreitado para capturar especificamente `PolynomialError`, retornando um novo tipo de classificação (`TRANSCENDENTE`, rótulo "função transcendente") em vez de erro. Qualquer outra exceção continua virando `ExpressionError` exatamente como antes. `domain.py`, `roots.py` e `vertex.py` já tratam esse novo tipo automaticamente pelos próprios ramos `else`/condicionais existentes — nenhuma mudança foi necessária neles (confirmado: `solve()` e a avaliação em x=0 já funcionavam sem erro para os 4 corpos, apenas a classificação estava barrando o caminho).

**2. Colisão sintática `nome(var) = expr` entre `functions/` e outras áreas.**
O regex de definição de função (`functions/dispatcher.py`) não distingue "definir uma função chamada X" de "chamar uma função matemática conhecida seguida de uma equação/comparação". A Sprint 7 já havia corrigido isso para `sin`/`cos`/`tan`/`asin`/`acos`/`atan`; a auditoria confirmou ao vivo que `sqrt(x) = 2`, `log(x) = 5`, `ln(x) = 3`, `exp(x) = 1` caíam todos incorretamente em `functions/`, com o mesmo erro errado ("Funções de grau 0...").
**Correção:** `_RESERVED_FUNCTION_NAMES` foi ampliado para incluir `log`, `ln`, `exp`, `sqrt`, com um comentário explícito documentando que esta é uma lista mantida manualmente — não existe uma alternativa estrutural simples sem introduzir o Parser Inteligente (Sprint 11); confirmado que `sqrt` nem é uma classe `Function` do SymPy (é uma função Python comum), então uma checagem reflexiva genérica ainda precisaria de casos especiais. Após a correção, essas quatro expressões passam a cair no fallback correto (`equations/`, que rejeita com um erro honesto de "não foi possível determinar o grau da equação" em vez do erro enganoso anterior).

**3. Inequações trigonométricas retornavam um resultado enganoso.**
`sin(x) > 0`, `tan(x) >= 1`, `cos(x) < sin(x)` não levantavam erro — caíam no branch de "expressão genérica" de `trigonometry/dispatcher.py` e voltavam inalteradas, rotuladas como `"Tipo: expressão trigonométrica"`, como se fossem um resultado válido.
**Correção:** adicionada uma checagem de inequação (mesmo padrão regex já usado em `equations/dispatcher.py`) no início de `solve_trigonometry_text`, levantando `ExpressionError` explícita ("Inequações trigonométricas ainda não fazem parte do escopo desta versão.") antes de qualquer tentativa de parsing/simplificação.

### 6.2 Compatibilidade

Os ~40 casos de compatibilidade das Sprints 1-7 foram re-executados na validação isolada e via smoke test (`uvicorn` + `curl`) desta sprint — todos idênticos, incluindo o erro de domínio de `asin(2)`/`acos(-2)` (não regressivo). `GET /history` conferido: apenas as chamadas bem-sucedidas geram entrada, schema intacto.

### 6.3 Limitações que permanecem intencionais (não corrigidas nesta sprint)

- O denylist de nomes reservados em `functions/dispatcher.py` continua sendo mantido manualmente — qualquer área futura com sintaxe `nome(...)` pode colidir de novo e precisar estender essa lista. Resolver isso estruturalmente (gramática que distingue definição de uso) é trabalho reservado para o Parser Inteligente (Sprint 11).
- O domínio real de funções transcendentes (ex.: `log(x)` deveria excluir `x <= 0`; `f(x) = log(x)` hoje reporta `Domínio: ℝ` e `Intercepto em y: (0, zoo)`) não é calculado — permanece `ℝ` por simplificação deliberada. Calcular isso corretamente é funcionalidade nova, fora do escopo de hardening.
- Inequações trigonométricas continuam **não suportadas** — esta sprint só tornou a rejeição explícita e honesta, não adicionou suporte a elas.
- Os demais itens "⚠ pode melhorar" da auditoria (duplicação de regex entre `equations/`/`functions/`/`trigonometry/`, recomputação redundante em `functions/rational.py`, ausência de testes automatizados, inconsistência de nomenclatura entre áreas, módulos de `algebra/` nunca invocados) permanecem como estavam — fora do escopo desta sprint pontual.

### 6.4 Objetivo da Sprint 8 (mantido)

Implementar a área de Logaritmos/Exponenciais (`backend/app/math_engine/logarithms/`), agora com a colisão de nomes já coberta pelo denylist ampliado e com `functions/` já classificando corpos transcendentes sem erro — os dois riscos que a auditoria havia identificado como mais prováveis de se repetir na Sprint 8 já estão neutralizados.

---

## 7. Sprint 7.2 — Output Formatting & UX (2026-07-07)

Nova camada de apresentação, `backend/app/formatter/` (pacote irmão de `math_engine/`, não aninhado nele), inserida em um único ponto de `main.py` entre `solve_expression()` e a montagem de `SolveResponse`. `math_engine/`, o dispatcher central, `solve_expression` e a API pública permanecem com diff zero.

Arquitetura **classification-first**: `classify.py` decide, via regex estrutural, a qual de quatro formas conhecidas a string bruta pertence (intervalo/união, `FiniteSet`, lista `x = ...`, expressão pura) **antes** de qualquer tentativa de parsing; `pipeline.py` só despacha para o formatter específico daquela forma. Qualquer ambiguidade ou falha de parsing devolve a string original intocada. Blocos de texto composto (`"Tipo: ...; Domínio: ...; ..."`, saída de `functions/`/`trigonometry/`) foram deixados **totalmente intocados** por decisão explícita — tratados como "texto comum", não como uma quinta forma a reconstruir.

Resultado: raízes múltiplas passam a vir ordenadas (parte real, depois imaginária) e indexadas com subscrito unicode (`x₁ = -2, x₂ = 2`); `Interval`/`Union` do SymPy viram notação matemática convencional (`Interval.open(3, oo)` → `(3, ∞)`); `FiniteSet` de equações modulares ganha rótulo de variável quando possível (`{-2, 4}` → `x₁ = -2, x₂ = 4`); expressões algébricas passam por uma bateria restrita e segura de simplificação (`radsimp`, `trigsimp`, `factor`, e `cancel` só quando a expressão já é uma fração).

Duas regressões reais foram encontradas e corrigidas durante os testes, antes de qualquer commit: `sympify("{a, b}")` retorna um `set` nativo do Python (não `FiniteSet` do SymPy) — corrigido parseando cada elemento individualmente dentro das chaves; e `simplify()`/`cancel()`/`sqrtdenest()` desfatoravam `(x-1)*(x+1)` → `x**2-1` (mais curto, porém contradiz a prioridade "fatorar primeiro" de `algebra/dispatcher.py` desde a Sprint 4) — corrigido restringindo a bateria de simplificação a funções que nunca expandem um produto já fatorado.

Validado com `solve_expression` direto (19+ casos cobrindo as 7 áreas) e via API real (`uvicorn` + `curl` em `/solve` e `/history`), zero regressão matemática.

## 8. Sprint 7.3 — Mathematical Renderer (2026-07-07)

Segunda camada dentro de `backend/app/formatter/`, rodando **depois** de `format_result()` (Sprint 7.2): um passe cosmético final de substituição Unicode por token, sem KaTeX, sem conversão para decimal, sem tocar em `math_engine/`, `solve_expression`, dispatcher ou API pública.

### 8.1 Arquivos novos

| Arquivo | Responsabilidade |
|---|---|
| `unicode_math.py` | Funções puras e isoladas de substituição por regex: `superscript_exponents` (`**N` → sobrescrito Unicode, dígito a dígito, qualquer quantidade de dígitos), `render_sqrt` (`sqrt(ATOM)` → `√ATOM` só para argumento atômico), `replace_constants` (`pi`/`tau`/`oo` → `π`/`τ`/`∞`), `replace_comparisons` (`<=`/`>=`/`!=` → `≤`/`≥`/`≠`), `replace_imaginary_unit` (`I` → `i`) |
| `renderer.py` | `render_math(text)` — orquestra as funções acima em ordem fixa, dentro de um `try/except` que devolve o texto original em qualquer falha inesperada |

`__init__.py` passou a exportar `render_math` além de `format_result`. `main.py`: uma linha alterada — `result = render_math(format_result(request.expression, raw_result))`.

### 8.2 Decisões de arquitetura confirmadas com Theo antes da implementação

- **Aplicação universal, não só nas formas classificadas pela 7.2**: o renderer roda sobre a string inteira, inclusive dentro dos blocos `"Tipo: ...; ..."` que a 7.2 deixou intocados — porque são trocas de token sem necessidade de entender a estrutura (diferente da reconstrução da 7.2, que exigia parsing real). Por isso `asin(1/2)` → `"Tipo: trigonometria inversa; Resultado: pi/6"` (7.2, intocado) passa a virar `"...Resultado: π/6"` (7.3).
- **Expoentes multi-dígito**: cada dígito é traduzido individualmente pela tabela Unicode de sobrescritos — `x**10` → `x¹⁰`, `x**123` → `x¹²³`, `1/x**2` (SymPy: `x**(-2)`) → `x⁻²`.
- **Unidade imaginária**: `I` → `i` apenas troca a letra (`\bI\b`, fronteira de palavra — nunca casa dentro de `Interval`). `2*I` → `2*i`; colapsar para `2i` foi explicitamente adiado para uma sprint futura.
- **`sqrt()` com constantes nomeadas**: `sqrt(pi)` → `√π`, `sqrt(tau)` → `√τ`, `sqrt(E)` → `√E` funcionam pelo mesmo regex genérico de "argumento atômico" (identificador ou inteiro) usado para `sqrt(x)`/`sqrt(2)` — sem caso especial. Argumentos compostos (`sqrt(x+1)`, `sqrt(2*x)`, `sqrt(x**2-4)`) permanecem intocados: decidir parênteses corretos para um argumento composto a partir da string, sem AST, não é seguro.

### 8.3 Bug evitado antes de qualquer teste rodar

Um único regex de expoente com parêntese opcional (`\*\*\(?(-?\d+)\)?`) teria "engolido" parênteses não relacionados — ex.: `(x**2)` viraria `(x²` (parêntese de fechamento perdido), pois o `\)?` opcional casaria com qualquer `)` seguinte, mesmo um que fechasse um grupo externo sem relação com o expoente. Corrigido com dois padrões distintos e ancorados: `\*\*\((-\d+)\)` (negativo, exige `-` dentro dos parênteses — a única forma que o SymPy realmente produz) e `\*\*(\d+)\b` (positivo, nunca tem parênteses).

Também identificada uma dependência de ordem não óbvia: `render_sqrt()` precisa rodar **antes** de `replace_constants()` — se `pi`/`tau` já tivessem virado `π`/`τ`, o regex de argumento atômico do `sqrt` (que exige um identificador ASCII) deixaria de casar, e `sqrt(pi)` ficaria preso como `sqrt(π)` em vez de `√π`. Documentado em comentário no código e no docstring de `render_sqrt`.

### 8.4 Testes executados

25 casos unitários de `unicode_math`/`render_math` isolados (expoentes de 1 a 3+ dígitos, expoente negativo, `sqrt` atômico vs. composto, constantes, complexos, comparações, idempotência sobre saída já formatada pela 7.2 como `(3, ∞)`) + 21 casos reais via `solve_expression` → `format_result` → `render_math` cobrindo álgebra, equações reais/complexas, inequações, valor absoluto, sistemas, funções, trigonometria — zero regressão matemática, só apresentação mudou. Smoke test final via API real (`uvicorn` + `curl` em `/solve` e `/history`), servidor encerrado limpo.

### 8.5 Limitações intencionais (documentadas, não são bugs)

- `sqrt(x + 1)`, `sqrt(2*x)`, `sqrt(x**2 - 4)` continuam como `sqrt(...)` — argumento composto fora de escopo.
- `sqrt(sqrt(2))` (raiz aninhada, caso raro neste domínio) pode ficar parcialmente convertido (`sqrt(√2)`) — ainda correto, só estilisticamente inconsistente.
- Expoentes não inteiros (`x**(1/2)`, `x**n` simbólico) não viram sobrescrito.
- `<=`/`>=`/`!=` não têm nenhum caso real para exercitar hoje (inequações já viram notação de intervalo na 7.2) — incluído como rede de segurança futura.
- `2*I` não colapsa para `2i` nesta sprint (decisão explícita, adiada).

---

## 9. Sprint 8 — Módulo de Logaritmos e Exponenciais (2026-07-07)

Novo pacote `backend/app/math_engine/logarithms/`, seguindo exatamente o padrão arquitetural das demais áreas (operações isoladas + `dispatcher.py` de área), inserido no dispatcher central entre `trigonometry/` e `equations/`. Sprint planejada em quatro rodadas de revisão com Theo antes da implementação (plano técnico completo aprovado com ajustes de escopo a cada rodada — ver `C:\Users\THÉO\.claude\plans\reactive-twirling-aho.md`).

### 9.1 Decisão oficial e permanente do produto

A convenção do MathMaster para logaritmos e exponenciais fica definida como **regra permanente**, prevalecendo sobre o comportamento padrão do SymPy (onde `log(x)` bare é natural):

- `log(x)` = logaritmo decimal (base 10)
- `ln(x)` = logaritmo natural (base e)
- `exp(x)` = eˣ

Imposta via um `local_dict` de `parse_expr` (`{"log": lambda x: sympy_log(x, 10), "ln": sympy_log}`), duplicado em `dispatcher.py` e `equations.py` seguindo o mesmo padrão de duplicação já usado entre `trigonometry/dispatcher.py` e `trigonometry/equations.py`. `exp` não precisa de override — já resolve nativamente para `sympy.exp` via o namespace padrão do `parse_expr`.

### 9.2 Arquivos novos

| Arquivo | Responsabilidade |
|---|---|
| `classification.py` | `AVALIACAO`/`IDENTIDADE`/`GERAL` + `classify_log_expression`/`label_for`, espelhando `trigonometry/classification.py` |
| `evaluate.py` | Avaliação de expressões sem incógnita (`log(100)`, `ln(E)`, `exp(0)`) |
| `simplify.py` | `simplify_log` — simplificação genérica com incógnita |
| `identities.py` | Detecção de identidades (expressão com símbolo livre que colapsa para constante) |
| `domain.py` | `validate_log_domain` — validação de domínio para argumento **literal** (ver §9.3) |
| `equations.py` | `solve_log_equation` — equações logarítmicas e exponenciais (base `e` e base literal arbitrária, ver §9.4) |
| `dispatcher.py` | `is_logarithm_domain_expression`/`solve_logarithm_text`, `_LOCAL_DICT`, roteamento |

`__init__.py` permanece vazio (mesmo padrão de `trigonometry/__init__.py`). `math_engine/dispatcher.py`: um import + um branch novo, ordem `functions → trigonometry → logarithms → equations → algebra`. Nenhuma outra mudança em `main.py`, `functions/`, `trigonometry/`, `equations/`, `algebra/` ou no schema público.

### 9.3 Descobertas técnicas que exigiram ajuste de rota durante a implementação

Três comportamentos do SymPy só foram descobertos empiricamente durante a implementação (testados isoladamente antes de codar cada peça), e cada um exigiu um ajuste de design em relação ao plano inicial:

1. **`log(0)`/`log(-5, 10)` não levantam exceção nativamente.** `log(0)` resolve para `zoo` na própria construção do nó; `log(-5, 10)` reescreve o argumento em termos complexos (`log(5) + I*pi`) já no parse, perdendo o sinal original antes de qualquer checagem sobre a árvore já construída conseguir enxergá-lo. **Ajuste:** `validate_log_domain` roda sobre o **texto original** da expressão (regex `log|ln` + literal numérico), antes do parse — mesma necessidade que já havia levado `trigonometry/inverse.py` a detectar `asin`/`acos` via regex no texto-fonte em vez de inspecionar a árvore avaliada.
2. **`log(exp(x))` não colapsa para `x` com `simplify()`/`logcombine()` puros** (SymPy é conservador sobre a periodicidade complexa de `exp` sem assumir `x` real), mas **`exp(log(x))` já colapsa** (direção sem essa ambiguidade). **Ajuste:** `simplify_log` combina `simplify(powdenest(logcombine(expr, force=True), force=True))` — validado contra os 4 casos de identidade/simplificação antes de escrever o arquivo final.
3. **`log(x, 10)` nunca sobrevive como nó "log de base 10" na árvore** — o SymPy expande imediatamente para `log(x)/log(10)` (dois nós de log natural). Consequência: qualquer `log(` que sobreviva no resultado final é sempre log natural do SymPy — nunca o nosso `log` de base 10. **Ajuste:** um passo final de renomeação (`\blog(?=\() → ln`) é aplicado ao resultado antes de devolver, tanto para expressões simples quanto para equações — propagando a convenção também para a saída, não só para a entrada (com o efeito colateral correto de `log(x)` simbólico exibir `ln(x)/ln(10)`, a forma pedagogicamente padrão).

### 9.4 Equações exponenciais de base literal arbitrária

Suporte confirmado para `a**x = b` (ex.: `2**x = 8`, `10**x = 1000`, `5**x = 125`), restrito a base **literal**, positiva e diferente de 1 — decisão de escopo tomada junto com Theo durante a revisão do plano. Detecção via `_EXP_LITERAL_BASE_PATTERN` (regex que só casa base numérica seguida de `**` e expoente iniciado por identificador/parêntese — `x**2` e `2**3` não casam, então potências comuns de `algebra/`/`equations/` continuam intocadas). Base simbólica (`a**x = b` com `a` incógnita) fica fora do escopo **estruturalmente**: o regex de detecção não casa base não-numérica, então esses casos nem chegam a ser roteados para `logarithms/` — continuam caindo no fallback de `equations/`/`algebra/` como antes, comportamento inalterado. Validação de base (`> 0` e `≠ 1`) roda em `equations.py` sobre os nós `Pow` da equação já parseada, antes de chamar `solve()`.

### 9.5 Bug de integração encontrado e corrigido no smoke test (fora do escopo original do plano)

Durante o smoke test via API real, `exp(x) = 8` retornou `"x = log(8)"` em vez de `"x = ln(8)"` — a renomeação de §9.3 item 3 funcionava na chamada direta a `solve_expression()`, mas era desfeita pelo `formatter/` da Sprint 7.2. Causa: o resultado de uma equação (`"x = ..."`, sem o wrapper `"Tipo: ...; ..."`) bate no formato de "assignment shape" do `format_result()`, que faz `sympify()` no valor para reordenar/relabelar raízes — e o SymPy só tem **um** nome de impressão (`"log"`) para logaritmo natural, então `sympify("ln(8)")` retorna e reimprime `"log(8)"`, apagando a renomeação. Resultados com o wrapper `"Tipo: ...; ..."` não sofrem esse problema (o formatter devolve esse formato intocado, sem re-parsear).

Apresentadas três opções a Theo (patch mínimo no formatter / aceitar como limitação documentada / redesenhar a saída de `equations.py` para escapar do reformatador); **aprovado o patch mínimo**. Alteração feita, fora do escopo originalmente aprovado no plano ("nenhuma mudança em `formatter/`"), mas necessária para não violar a convenção oficial de §9.1 na saída real da API:

- `backend/app/formatter/pipeline.py`: nova constante `_NATURAL_LOG_PATTERN` + helper `_rename_natural_log`, aplicado ao final de `_format_assignment_list` (todos os `return`) e `_format_pure_expression`. Nenhum outro arquivo do formatter tocado. Mudança segura e isolada: nenhuma outra área do `math_engine` produz `"log("` em sua saída hoje (confirmado por busca completa na árvore antes de implementar `logarithms/`), então a substituição é um no-op garantido para todo o resto do pipeline.

Revalidado após o patch: `exp(x) = 8` → `"x = ln(8)"` correto; re-executada a amostra de smoke test completa (avaliação, domínio inválido, identidade, expressão simbólica geral, equação log, equação exponencial base `e`, equação exponencial base literal, regressão cross-domain trigonometria/funções/equações) — todos corretos, zero regressão.

### 9.6 Testes executados

29 casos via script descartável chamando `solve_expression()` diretamente (24 obrigatórios do plano + 5 adicionais de regressão cross-domain) — 100% aprovados após a correção de dois erros no próprio script de teste (não no código: um `UnicodeEncodeError` de console ao imprimir `ℝ`, e uma conta errada em `2*x+3=7`, que dá `x=2` e não `x=1`). 19 casos adicionais de regressão cross-domain (`algebra/`, `equations/` linear/quadrática/polinomial/sistema/inequação/valor absoluto, `functions/` classificação e avaliação — incluindo os dois corpos transcendentes que a Sprint 7.1 já havia corrigido preventivamente —, `trigonometry/` valor notável/equação/inversa/inequação rejeitada) confirmando zero regressão nas Sprints 1–7.1. Smoke test via API real (`uvicorn` + `curl`) em `/solve` e `/history`: schema intacto, só chamadas bem-sucedidas geram entrada (o erro 400 de domínio inválido não aparece no histórico), servidor encerrado limpo em ambas as rodadas (antes e depois do patch de §9.5).

### 9.7 Limitações intencionais (documentadas, não são bugs)

- `log(x, base)` com base customizada (dois argumentos) não suportado.
- Equações exponenciais de base **simbólica** (`a**x = b` com `a` incógnita) fora do escopo — ver §9.4.
- Domínio de `log`/`ln` só é validado para argumento numérico **literal**; símbolo livre não tem sinal verificado — `# TODO` em `domain.py` aponta isso para uma sprint futura dedicada a domínios (mesma limitação já aceita para `functions/` transcendentes desde a Sprint 7.1).
- Sem inequações logarítmicas/exponenciais (mesmo padrão de exclusão já usado para inequações trigonométricas na 7.1).
- Sem renderização Unicode especial para `log₁₀`/`ln` em `formatter/unicode_math.py` nesta sprint.

### 9.8 Roadmap futuro — TODO de escopo (documentação apenas, não implementado nesta sprint)

`logarithms/` é responsável **apenas** por operações matemáticas (avaliação, simplificação, identidades, equações, validação de domínio literal). Análise completa de função logarítmica/exponencial como tipos próprios de `functions/classification.py` — domínio, imagem, assíntotas, monotonicidade, interceptos e raízes, no formato:

```
f(x) = log(x)  →  Tipo: função logarítmica; Domínio: (0, +∞); Imagem: ℝ; Raiz: x=1;
                   Intercepto em y: inexistente; Assíntota vertical: x=0; Monotonicidade: crescente

f(x) = exp(x)  →  Tipo: função exponencial; Domínio: ℝ; Imagem: (0, +∞); Raiz: nenhuma;
                   Intercepto em y: (0, 1); Assíntota horizontal: y=0; Monotonicidade: crescente
```

fica para uma sprint futura dedicada, mantendo a separação arquitetural já existente entre operações (`logarithms/`) e análise de funções (`functions/`).

---

*Fim do documento.*
