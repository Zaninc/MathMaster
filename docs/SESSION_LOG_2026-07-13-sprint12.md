# SESSION_LOG_2026-07-13-sprint12.md
## MathMaster — Registro de Sessão

| | |
|---|---|
| **Data** | 2026-07-13 |
| **Produto** | MathMaster |
| **Escopo da sessão** | Sprint 12 do MVP Técnico (V0) — Cálculo (derivada, integral, limite), novo domínio `calculus/` |

---

## 1. O que foi implementado hoje

Novo domínio `backend/app/math_engine/calculus/` (antes um placeholder vazio): derivada de primeira ordem, integral indefinida, integral definida e limite bilateral.

### 1.1 Sintaxe pública (nova)

```
derivada(expr, var)                        # derivada primeira, simbólica
integral(expr, var)                        # indefinida — "+ C" só na apresentação
integral(expr, var, inferior, superior)    # definida — distinguida por nº de argumentos, igual a circunferencia(...)
limite(expr, var, ponto)                   # bilateral — ver 1.2
```

Mesma fronteira já usada por `analytic_geometry/`: sintaxe de chamada nomeada e explícita, nunca notação algébrica livre (`d/dx`, `∫...dx`, `lim_{x->0}`) — isso exigiria gramática nova, reservada ao futuro Parser Inteligente, e `"->"`/`">"` colidiriam com o roteador de equações (`_INEQUALITY_PATTERN`).

### 1.2 Decisões de escopo tomadas (auditoria aprovada antes da implementação)

- **Cálculo entra na cascata de `math_engine/dispatcher.py` ANTES de `functions`/`trigonometry`/`logarithms`/`equations`**: essas áreas decidem por `.search()` livre no texto inteiro (ex. `sin(` em qualquer posição) — uma chamada como `integral(sin(x), x)` seria roubada por `trigonometry` se checado depois. Confirmado empiricamente via smoke test.
- **Convenção do produto `log`=base10/`ln`=natural sempre aplicada** ao corpo de qualquer operação de cálculo — diferente de `functions/`, que só aplica a convenção às 4 formas canônicas por um motivo de escopo específico daquela área.
- **"+ C" da integral indefinida é só apresentação**: `integrals.py` devolve um valor SymPy puro; a string é montada em `dispatcher.py`.
- **Limites são bilaterais por padrão**: `limits.py` calcula os dois lados e compara explicitamente (`sympy.limit()` não avisa quando diverge ou oscila). Limites laterais ficam fora do escopo desta versão.
- **Rejeição explícita de resultados não avaliados/divergentes/indefinidos**: `Integral(...)` (ou subclasse, ex. `NonElementaryIntegral`) não resolvida, `oo`/`-oo`/`zoo`/`nan` em integral definida, `AccumBounds`/`zoo`/`nan`/lados discordantes em limite — todos viram `ExpressionError` claro, nunca o repr cru do SymPy.
- **Ajuste pós-smoke-test**: a primeira versão de `limits.py` expunha o repr interno do SymPy nas mensagens de erro (`"lado esquerdo = AccumBounds(-1, 1)"`). Corrigido para três mensagens distintas e limpas — oscilação ("...não existe porque a expressão oscila."), indefinido genérico ("...não existe.") e lados válidos mas diferentes ("...não existe (os limites laterais são diferentes).") — nenhuma delas imprime um valor calculado, só a entrada do usuário (`expr`/`symbol`/`point`).

### 1.3 Verificação de compatibilidade com o formatter (Sprint 7.2)

Saída sempre rotulada (`"Derivada: ..."`, `"Integral: ..."`, `"Integral definida: ..."`, `"Limite: ..."`) — contém `:`, então `is_pure_expression_shape()` a rejeita e ela passa **intocada** por `format_result()`, só `render_math()` (superscript de expoentes, `√`, etc.) atua — confirmado empiricamente, mesmo padrão de `functions/`/`trigonometry/`. Nenhuma mudança em `formatter/classify.py`/`pipeline.py`/`render_sets.py` foi necessária.

`log(` nativo do SymPy que sobrevive na saída (ex. derivada de `log(x)`) é renomeado para `ln(` dentro do próprio `calculus/dispatcher.py`, sem tocar `formatter/pipeline.py` — mesma técnica de `logarithms/dispatcher.py`/`functions/dispatcher.py`.

---

## 2. Arquivos criados e modificados

### 2.1 Novo

| Arquivo | Responsabilidade |
|---|---|
| `calculus/derivatives.py` | `compute_derivative()` — `sympy.diff`, primeira ordem |
| `calculus/limits.py` | `compute_limit()` — bilateral, oscilação/divergência/indefinição tratadas explicitamente |
| `calculus/integrals.py` | `compute_indefinite_integral()`, `compute_definite_integral()` — rejeita `Integral` não resolvida e resultados divergentes |
| `calculus/dispatcher.py` | `is_calculus_domain_expression()`, `solve_calculus_text()` — parsing estrutural da sintaxe de chamada, roteamento por nome de operação, montagem da string rotulada |
| `tests/math_engine/test_calculus.py` | 14 testes (ver §3) |

### 2.2 Modificado

| Arquivo | Mudança |
|---|---|
| `math_engine/dispatcher.py` | + import de `calculus.dispatcher`, + branch antes de `functions` |
| `functions/dispatcher.py` | `_RESERVED_FUNCTION_NAMES` + `derivada`, `integral`, `limite` |

### 2.3 Não alterado

`PRD.md`/`ARCHITECTURE.md` — já mencionavam "cálculo diferencial e integral introdutório"/"cálculo" genericamente entre os domínios do Math Engine desde antes desta sprint, sem afirmação desatualizada que precisasse de correção (mesmo caso do `ARCHITECTURE.md` §8.3 na Sprint 11). `safe_parsing.py` (whitelist do sandbox intocada — `diff`/`integrate`/`limit` nunca são expostos ao `eval`, são chamados diretamente em Python depois que `calculus/dispatcher.py` já isolou os fragmentos de texto). `formatter/*`, `main.py`, `history.py`, `schemas.py` (API pública inalterada). `algebra/`, `equations/`, `trigonometry/`, `logarithms/`, `analytic_geometry/` (nenhuma mudança interna, só passaram a ser verificados depois de `calculus/` na cascata).

---

## 3. Testes executados

### 3.1 `tests/math_engine/test_calculus.py` (14 testes novos)

Derivada de polinômio; derivada de `log(x)` usando a convenção base10; integral indefinida de polinômio (com `+ C`) e de `sin(x)`; integral definida; limite removível; limite no infinito; limite com lados divergentes (mensagem sem repr interno); limite oscilante (mensagem sem repr interno); integral sem forma fechada (`x**x`) rejeitada; integral definida divergente (`1/x` em `[-1,1]`) rejeitada; ordem da cascata (`integral(sin(x), x)` não é roubado por `trigonometry`); contagem de argumentos errada; nome reservado não é roubado por `functions/`.

### 3.2 Suíte completa

**403/403 testes passando** (389 anteriores + 14 novos), zero regressão — confirmado em duas rodadas (implementação inicial e após o ajuste de mensagens de `limits.py`).

### 3.3 Smoke test via API real (`uvicorn` + `curl`)

Duas rodadas. Primeira: os 4 tipos de operação com sucesso (incl. `integral(sin(x), x)` para validar a ordem da cascata), 6 casos de erro (todos **HTTP 400**, nunca 500) incl. limite divergente/oscilante, integral sem forma fechada, integral definida divergente, nome reservado colidindo com `functions/`, contagem de argumentos errada; regressão cruzada (`sin(x)+1` continua roteado para `trigonometry`); `/history` confirmando que só os casos de sucesso foram persistidos. Segunda rodada, focada no ajuste de mensagens: confirmado que a resposta ao cliente não expõe mais `"AccumBounds"` nem os valores calculados dos lados esquerdo/direito. Servidor encerrado ao final das duas rodadas.

---

## 4. Limitações intencionais (documentadas, não são bugs)

- Derivadas de primeira ordem apenas — sem ordens superiores, sem derivadas parciais.
- Cálculo de uma única variável, como o resto do motor.
- Limites laterais explícitos fora do escopo — só o bilateral é exposto.
- Divergência de integral definida (imprópria ou por singularidade dentro do intervalo) tratada de forma unificada — o mesmo conjunto de resultados (`oo`/`-oo`/`zoo`/`nan`) cobre os dois casos, sem distinção especial.
- Sem notação algébrica livre (`d/dx`, `∫...dx`, `lim_{x->0}`) — reservado ao Parser Inteligente.
- Sem passos de resolução detalhados — consistente com todo o resto do motor.

---

## 5. Estado atual do projeto

- **Motor matemático**: `algebra/`, `equations/`, `functions/`, `trigonometry/`, `logarithms/`, `analytic_geometry/` (retas + cônicas), `calculus/` (**esta sessão**) implementados. `parser/` tem `normalize.py` (Sprint Parser). `matrices/` segue como placeholder vazio.
- **API pública**: inalterada (`POST /solve`, `GET /history`, `GET /health`, `GET /ready`).
- **Frontend**: inalterado.
- **Testes**: 403 testes automatizados (pytest), CI (GitHub Actions) e pip-audit já estabelecidos desde o Hardening II/III.
- **Commit**: ainda não realizado — aguardando sugestão de mensagem e aprovação explícita do Theo.

## 6. Objetivo da próxima etapa

Sugestão de commit da Sprint 12 (aguardando aprovação). Depois disso, próxima área pendente no roadmap da Fase 1 (Motor Matemático): `matrices/` (complexos e matrizes) — a única área de domínio ainda não implementada — a confirmar com o Theo.
