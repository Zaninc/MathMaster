# SESSION_LOG_2026-07-10-sprint10.md
## MathMaster — Registro de Sessão

| | |
|---|---|
| **Data** | 2026-07-10 |
| **Produto** | MathMaster |
| **Escopo da sessão** | Sprint 10 do MVP Técnico (V0) — Geometria Analítica I (retas), novo módulo `analytic_geometry/` |

---

## 0. Reordenação de roadmap (registrada explicitamente)

O `SESSION_LOG_2026-07-08-sprint9.md` (§6) e `ARCHITECTURE.md`/`PRD.md` (antes desta sessão) apontavam **Cálculo** como próxima área do Math Engine. Theo redefiniu explicitamente a prioridade no planejamento desta sprint: **Sprint 10 = Geometria Analítica I (retas) → Sprint 11 = Geometria Analítica II (cônicas: circunferência, parábola, elipse, hipérbole) → Hardening II (pytest + GitHub Actions) → Parser Inteligente → Cálculo.** `ARCHITECTURE.md` §8.3 e `PRD.md` (RF-04, §13.2) foram atualizados nesta sessão para refletir geometria analítica e logaritmos/exponenciais na lista de domínios do Math Engine (a lista estava desatualizada desde a Sprint 8/9).

---

## 1. O que foi implementado hoje

Novo módulo `backend/app/math_engine/analytic_geometry/` (retas): distância entre dois pontos, ponto médio, coeficiente angular, equação da reta (por dois pontos ou por ponto + coeficiente angular), classificação básica (horizontal/vertical/oblíqua crescente/oblíqua decrescente), interceptos, e relação entre duas retas (paralelas/perpendiculares/coincidentes/concorrentes).

### 1.1 Sintaxe pública (nova, sem precedente no projeto)

Retas são **sempre** definidas por dois pontos ou por um ponto + coeficiente angular — nunca por uma equação livre digitada pelo usuário (fora de escopo, reservado ao Parser Inteligente). Coordenadas aceitam inteiros, racionais, raízes e constantes exatas (`pi`, etc.) via SymPy; variáveis livres em coordenadas (ex. `(a,b)`) são rejeitadas explicitamente.

```
distancia((x1,y1),(x2,y2))
ponto_medio((x1,y1),(x2,y2))
coeficiente_angular((x1,y1),(x2,y2))
reta((x1,y1),(x2,y2))
reta_m((x,y), m)
relacao_retas([(x1,y1),(x2,y2)],[(x3,y3),(x4,y4)])
```

`reta_m` (em vez de uma segunda forma de `reta(...)`) evita ambiguidade estrutural entre "dois pontos" e "ponto + coeficiente angular" — decisão de Theo na aprovação do plano.

### 1.2 Fórmula unificada para a equação geral (sem ramificação vertical/horizontal)

`line_from_points()` usa `a = y2-y1, b = x1-x2, c = -(a*x1 + b*y1)` — essa forma já produz a reta vertical (`x1==x2`) e a reta horizontal (`y1==y2`) corretamente sem nenhum `if` especial, porque é a equação geral da reta por dois pontos expandida diretamente. `slope()` é a única função que retorna `None` como sinal interno (reta vertical); quem chama decide se isso é erro (`coeficiente_angular()`, no dispatcher) ou um caso legítimo a classificar (`reta()`).

### 1.3 Normalização da equação geral

`_reduced()` (`lines.py`) reduz `(a,b,c)` para inteiros primos entre si com o primeiro coeficiente não-nulo positivo, **somente quando os três são racionais** — coeficientes irracionais (`sqrt`, `pi`) são deixados como o SymPy simplificou, sem tentativa de normalização de escala. Sem essa redução, `reta((0,0),(2,4))` mostraria `4*x - 2*y = 0` em vez de `2*x - y = 0`.

### 1.4 Relação entre duas retas via cross-multiplication

`classify_relation()` (`classification.py`) nunca divide diretamente por um coeficiente que possa ser zero: paralelismo é `a1*b2 - a2*b1 == 0`; coincidência (dado paralelismo) usa uma razão `k` calculada a partir do coeficiente não-nulo de cada reta (`a` ou `b`) e testa `c2 - k*c1 == 0`; perpendicularidade é `a1*a2 + b1*b2 == 0`. Testado explicitamente o caso horizontal×vertical (perpendiculares apesar de coeficiente angular indefinido em uma delas).

### 1.5 Símbolos ∥/⊥ só na camada de apresentação (decisão de Theo)

`analytic_geometry/classification.py` produz somente os rótulos semânticos em português (`"Paralelas"`, `"Perpendiculares"`, `"Coincidentes"`, `"Concorrentes (não perpendiculares)"`) — nunca os símbolos Unicode diretamente. `app/formatter/unicode_math.py` ganhou `replace_geometry_relations()` (substituição literal por palavra, mesmo padrão das demais funções do módulo), acionada em `renderer.py` depois de todas as outras substituições cosméticas já existentes (Sprint 7.3).

### 1.6 Risco descoberto e corrigido durante a implementação: colisão com o formatter de shape (Sprint 7.2)

`distancia(...)`, `ponto_medio(...)` e `coeficiente_angular(...)` originalmente retornariam valores "nus" (ex. `"5"`, `"(5/2, 4)"`). Verificado empiricamente que `"(5/2, 4)"` bate no whitelist de `is_pure_expression_shape()` (`app/formatter/classify.py`) — a string seria re-sympificada como uma tupla Python inteira por `format_result()`, arriscando uma representação diferente da pretendida. Corrigido rotulando as três saídas (`"Distância: 5"`, `"Ponto médio: (5/2, 4)"`, `"Coeficiente angular: 4/3"`), o mesmo padrão defensivo (sempre incluir `:`) que todo outro dispatcher do projeto já usa nas suas strings compostas — confirma, mais uma vez, a prática de verificar empiricamente a compatibilidade com o formatter em vez de assumir (mesmo hábito reforçado na Sprint 9).

---

## 2. Arquivos criados e modificados

### 2.1 Novo — `backend/app/math_engine/analytic_geometry/`

| Arquivo | Responsabilidade |
|---|---|
| `__init__.py` | vazio, convenção padrão de todas as áreas |
| `points.py` | `Point`, `split_top_level()`, `parse_point()`, `parse_point_pair()`, `parse_point_and_scalar()`, `parse_point_pair_list()`, `parse_two_lines()` — parsing por regex/varredura de parênteses + sympify por coordenada isolada |
| `distance.py` | `distance_between_points()` |
| `midpoint.py` | `midpoint()` |
| `lines.py` | `LineEquation`, `slope()`, `line_from_points()`, `line_from_point_slope()`, `x_intercept()`, `y_intercept()` |
| `classification.py` | constantes de kind (linha e relação) + `label_for()`, `classify_line()`, `classify_relation()` |
| `render.py` | `render_line_block()`, `render_relation_block()` — montagem do bloco composto final; renomeado de "formatter.py" (rascunho do plano) para evitar colisão de responsabilidade com `app/formatter/` |
| `dispatcher.py` | `is_analytic_geometry_domain_expression()`, `solve_analytic_geometry_text()` |

### 2.2 Modificado

| Arquivo | Mudança |
|---|---|
| `math_engine/dispatcher.py` | + import e branch `is_analytic_geometry_domain_expression` → `solve_analytic_geometry_text`, inserido **antes** de `is_function_domain_expression` (ordem: geometria → funções → trigonometria → logaritmos → equações → álgebra) |
| `functions/dispatcher.py` | `_RESERVED_FUNCTION_NAMES` ganhou `distancia`, `ponto_medio`, `coeficiente_angular`, `reta`, `reta_m`, `relacao_retas` — mesma ambiguidade estrutural já documentada para `sin/cos/log/ln/exp/sqrt` (Sprint 7/7.1) |
| `formatter/unicode_math.py` | + `replace_geometry_relations()` |
| `formatter/renderer.py` | `render_math()` passa a chamar `replace_geometry_relations()` como último passo |
| `ARCHITECTURE.md` §8.3 | lista de domínios do Math Engine atualizada (+ geometria analítica, + logaritmos/exponenciais, que já existiam no código mas não constavam na lista) |
| `PRD.md` RF-04, §13.2 | idem |

### 2.3 Não alterado

`algebra/`, `equations/`, `trigonometry/`, `logarithms/`, `functions/classification.py`/`domain.py`/`evaluate.py`/`roots.py`/`intercepts.py`/`logexp.py`/`vertex.py`/`modular.py`/`rational.py`, `errors.py`, `log_convention.py`, `formatter/classify.py`/`pipeline.py`/`expr_clean.py`/`render_roots.py`/`render_sets.py`/`safe_parse.py`, `main.py`, `history.py`, schema público (`SolveRequest`/`SolveResponse`/`HistoryItem`).

---

## 3. Testes executados

### 3.1 Validação isolada (script descartável, removido após uso)

34 casos via `solve_expression()` + `format_result()` + `render_math()` direto, 100% aprovados (os 2 "falhos" da primeira rodada eram sintaxe `^` em vez de `**` no próprio script de teste, não uma regressão — confirmado manualmente com `f(x) = x**2` e `x**2 - 4 = 0`):
- Distância (genérica, pontos coincidentes, coordenadas negativas/fracionárias, `sqrt`)
- Ponto médio (genérico, resultado fracionário, com `pi`)
- Coeficiente angular (crescente, decrescente, horizontal, vertical → `ExpressionError`)
- `reta(...)` oblíqua/vertical/horizontal/pela origem, com equação geral e reduzida corretas
- `reta_m(...)`
- Interceptos (oblíqua com ambos, horizontal sem intercepto x, vertical sem intercepto y)
- `relacao_retas(...)`: paralelas, perpendiculares (incluindo horizontal×vertical), coincidentes, concorrentes não perpendiculares
- Pontos idênticos passados a `reta(...)` → `ExpressionError`
- Entrada malformada (parêntese desbalanceado, coordenada não numérica, variável livre) → `ExpressionError` claro
- 6 casos de regressão cross-domain (`sin(x)=1/2`, `f(x)=x**2`, `log(100)`, `ln(x)=2`, `2+2`, `x**2-4=0`)

Mesmo `UnicodeEncodeError` de console (`cp1252`) já documentado nas Sprints 8/9 ao imprimir `√`/`π` — resolvido com `PYTHONIOENCODING=utf-8`, não é bug de código.

### 3.2 Smoke test via API real (`uvicorn` + `curl`)

Servidor subido via `.venv/Scripts/python.exe -m uvicorn app.main:app` (ambiente do projeto, distinto do Python global do sistema — anotado para a próxima sessão). `POST /solve` testado com `distancia`, `ponto_medio`, `reta`, `relacao_retas` (caso perpendicular, confirmando `⊥` no JSON de resposta) e o caso de erro (`reta` com pontos coincidentes → HTTP 400, `detail` com a mensagem em português). Regressão via API confirmada (`log(100)`, `sin(x)=1/2`). Servidor encerrado ao final.

### 3.3 `/history`

`GET /history` conferido após as chamadas de geometria: as 4 resoluções bem-sucedidas aparecem, mais recente primeiro, schema intacto, acentos e `⊥` preservados. A chamada que gerou `ExpressionError` (pontos coincidentes) corretamente **não** foi adicionada ao histórico — mesmo comportamento de todas as outras áreas (erro nunca chega a `add_entry()` em `main.py`).

---

## 4. Limitações intencionais (documentadas, não são bugs)

- Sem gráficos/plotagem.
- Sem geometria espacial (3D).
- Sem parser inteligente — retas só via pontos/coeficiente angular, nunca equação livre digitada.
- Sem cônicas (circunferência, parábola, elipse, hipérbole) — reservado para a Sprint 11.
- Sem inequações geométricas (semiplanos).
- Sem polígonos/área de triângulo/3 ou mais pontos.
- Sem coordenadas com variáveis livres (geometria paramétrica) — só literais numéricos/simbólicos concretos.
- `reta_m(...)` nunca produz reta vertical por construção (coeficiente angular sempre definido nessa operação) — reta vertical só é alcançável via `reta(P1, P2)` com `x1 == x2`.

---

## 5. Preparação para a Sprint 11 (Geometria Analítica II — cônicas)

- `points.py` (`parse_point`/`parse_point_list`) reaproveitável sem alteração para centro de circunferência, vértice/foco de parábola, focos de elipse/hipérbole.
- `distance.py` (`distance_between_points`) é a base direta da equação da circunferência (raio = distância centro↔ponto) e das definições foco-diretriz/soma de distâncias das cônicas.
- Padrão de `classification.py` (constantes + `label_for` + `classify_X`) deve ser **estendido no mesmo arquivo** com `CIRCUNFERENCIA`, `PARABOLA`, `ELIPSE`, `HIPERBOLE`, em vez de um `classification.py` por curva.
- Padrão de `dispatcher.py` (regex por palavra-chave + if/elif) só precisa de novos branches (`circunferencia(...)`, `parabola(...)`, `elipse(...)`, `hiperbole(...)`) e novos termos em `_CALL_PATTERN` — sem mudança no dispatcher central.
- Padrão de `render.py` (bloco composto rotulado) generaliza direto para cônicas.
- `lines.py` (coeficiente angular, paralelismo/perpendicularidade) reaproveitável para retas tangentes e eixos de simetria.
- Fronteira explícita: esta sprint só trata 1º grau (retas); Sprint 11 introduz 2º grau como extensão, não como refatoração do formato de saída de `reta()`.

---

## 6. Estado atual do projeto

- **Motor matemático**: `algebra/` (Sprint 4), `equations/` (Sprint 5), `functions/` (Sprint 6, estendida 7.1 e 9), `trigonometry/` (Sprint 7), `logarithms/` (Sprint 8), `analytic_geometry/` (Sprint 10, novo) implementados. `calculus/`, `matrices/`, `parser/` seguem como placeholders vazios.
- **API pública**: inalterada (`POST /solve`, `GET /history`, `GET /health`).
- **Frontend**: inalterado.
- **Ainda sem testes automatizados**: validação manual (script descartável + curl), mesmo padrão desde a Sprint 6 — decisão explícita de Theo nesta sprint de **não** introduzir pytest agora; pytest e GitHub Actions ficam reservados para o Hardening II (depois da Sprint 11).
- **Roadmap**: ver §0 desta sessão — Geometria Analítica I concluída; próxima é Geometria Analítica II (cônicas).

## 7. Objetivo da próxima sprint

Sprint 11 — Geometria Analítica II (cônicas: circunferência, parábola, elipse, hipérbole), estendendo `analytic_geometry/` conforme §5 acima.
