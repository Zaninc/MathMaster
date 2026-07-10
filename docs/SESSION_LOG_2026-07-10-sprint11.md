# SESSION_LOG_2026-07-10-sprint11.md
## MathMaster — Registro de Sessão

| | |
|---|---|
| **Data** | 2026-07-10 |
| **Produto** | MathMaster |
| **Escopo da sessão** | Sprint 11 do MVP Técnico (V0) — Geometria Analítica II (cônicas), extensão do módulo `analytic_geometry/` (Sprint 10) |

---

## 1. O que foi implementado hoje

`backend/app/math_engine/analytic_geometry/` ganhou as quatro cônicas clássicas — circunferência, parábola, elipse, hipérbole — **sem criar um novo domínio**: mesmo pacote, mesmo `dispatcher.py` central inalterado (só o branch já existente de `is_analytic_geometry_domain_expression`/`solve_analytic_geometry_text`).

### 1.1 Sintaxe pública (nova)

```
circunferencia((x,y), r)          # centro + raio
circunferencia((x,y), (x,y))      # centro + ponto pertencente à curva
parabola((x,y), (x,y))            # vértice + foco
elipse((x,y), a, b)               # centro + semieixo maior + semieixo menor
hiperbole((x,y), a, b)            # centro + semieixo real (transverso) + semieixo imaginário (conjugado)
```

Mesma fronteira da Sprint 10: sempre parâmetros literais (centro/vértice/foco/semieixos), nunca uma equação geral digitada livremente — isso continua reservado ao Parser Inteligente.

### 1.2 Decisões de escopo tomadas durante a implementação

- **Elipse e hipérbole sem parâmetro de orientação**: a sintaxe pública não informa se o eixo maior/transverso é horizontal ou vertical. Convenção adotada (documentada em `ellipse.py`/`hyperbola.py`): eixo maior/transverso sempre paralelo ao eixo x. Nenhuma rotação de eixos é suportada (decisão obrigatória do plano), então essa convenção é a única forma de manter a API de 3 argumentos sem ambiguidade.
- **Parábola rejeita eixo diagonal explicitamente**: `parabola_from_vertex_focus()` levanta `ExpressionError` se vértice e foco não compartilham nem a mesma abscissa nem a mesma ordenada — ao invés de silenciosamente assumir um eixo errado. Sem rotação de eixos é decisão obrigatória do plano; esta validação é a forma de honrá-la sem produzir um resultado matematicamente incorreto.
- **`parabola.py` reaproveita as constantes `HORIZONTAL`/`VERTICAL` já existentes em `classification.py`** (mesmo valor de string, usadas por `classify_line()` para retas) em vez de redefinir constantes equivalentes — só não passam por `label_for()` (que retornaria "reta horizontal", errado para o campo "Eixo:" de uma parábola); o valor bruto da constante ("horizontal"/"vertical") já é o texto correto para esse campo.
- **`points.py` estendido, não recriado**: dois parsers novos e estreitos, cada um cobrindo exatamente uma forma — `parse_point_and_point_or_scalar()` (2º argumento de `circunferencia(...)`: ponto OU escalar, decidido pelo prefixo `"("`) e `parse_point_and_two_scalars()` (centro + dois semieixos de elipse/hipérbole). Mesmo padrão de `parse_point_and_scalar()` já existente para `reta_m`.
- **`classification.py` estendido no mesmo arquivo** (não um arquivo por curva): quatro novas constantes de kind (`CIRCUNFERENCIA`, `PARABOLA`, `ELIPSE`, `HIPERBOLE`) + entradas em `_LABELS`, exatamente como planejado ao fim da Sprint 10.
- **`render.py` estendido no mesmo arquivo**: `render_circle_block()`, `render_parabola_block()`, `render_ellipse_block()`, `render_hyperbola_block()`, todos produzindo o mesmo formato `"Tipo: ...; Campo: valor; ..."` já usado por `render_line_block()`/`render_relation_block()`.
- **`circle_equation()` retorna `(lado_esquerdo, lado_direito)` já expandidos**, não uma string pronta — quem monta a string final (`"lhs = rhs"`) é `render.py`, mesma separação de responsabilidade que `lines.py`/`render.py` já tinham (módulo de cálculo nunca formata texto).
- **`functions/dispatcher.py`**: `_RESERVED_FUNCTION_NAMES` ganhou `circunferencia`, `parabola`, `elipse`, `hiperbole` — mesma ambiguidade estrutural já documentada para `sin/cos/log/ln/exp/sqrt` (Sprint 7/7.1) e para as operações de reta (Sprint 10): `"parabola(x) = x**2"` colidiria com a sintaxe de definição de função sem essa entrada na denylist.

### 1.3 Verificação empírica de compatibilidade com o formatter (Sprint 7.2)

Todos os blocos novos são estruturalmente idênticos ao de `reta(...)` (rótulos + `;` + `:`), já comprovado seguro na Sprint 10 contra `is_pure_expression_shape()`/`is_assignment_shape()` — confirmado de novo empiricamente nesta sessão (não apenas assumido): nenhuma das 12 saídas de sucesso testadas foi tocada por `format_result()`, só por `render_math()` (superscript de expoentes, `√`, etc.), igual às retas.

---

## 2. Arquivos criados e modificados

### 2.1 Novo — dentro de `backend/app/math_engine/analytic_geometry/`

| Arquivo | Responsabilidade |
|---|---|
| `circle.py` | `Circle`, `circle_from_center_radius()`, `circle_from_center_point()`, `circle_equation()` |
| `parabola.py` | `Parabola`, `parabola_from_vertex_focus()`, `parabola_axis()`, `parabola_directrix()` |
| `ellipse.py` | `Ellipse`, `ellipse_from_axes()`, `ellipse_focuses()`, `ellipse_eccentricity()` |
| `hyperbola.py` | `Hyperbola`, `hyperbola_from_axes()`, `hyperbola_focuses()`, `hyperbola_asymptotes()`, `hyperbola_eccentricity()` |

### 2.2 Modificado

| Arquivo | Mudança |
|---|---|
| `analytic_geometry/points.py` | + `parse_point_and_point_or_scalar()`, + `parse_point_and_two_scalars()` |
| `analytic_geometry/classification.py` | + `CIRCUNFERENCIA`/`PARABOLA`/`ELIPSE`/`HIPERBOLE` + labels |
| `analytic_geometry/render.py` | + `render_circle_block()`, `render_parabola_block()`, `render_ellipse_block()`, `render_hyperbola_block()` |
| `analytic_geometry/dispatcher.py` | + import das 4 cônicas, + 4 novos nomes em `_CALL_PATTERN`, + 4 novos branches |
| `functions/dispatcher.py` | `_RESERVED_FUNCTION_NAMES` + `circunferencia`, `parabola`, `elipse`, `hiperbole` |
| `PRD.md` §13.2 | "geometria analítica (retas; cônicas em iteração futura)" → "geometria analítica (retas e as quatro cônicas — circunferência, parábola, elipse, hipérbole)" |

### 2.3 Não alterado

`math_engine/dispatcher.py` (nenhum novo import/branch — a extensão inteira acontece dentro do branch já existente de `analytic_geometry/`), `lines.py`, `midpoint.py`, `distance.py` (só reaproveitados), `algebra/`, `equations/`, `trigonometry/`, `logarithms/`, `functions/classification.py`/`domain.py`/etc., `errors.py`, `log_convention.py`, todo `app/formatter/` (nenhuma substituição Unicode nova precisou ser adicionada — as cônicas não introduzem símbolo especial além dos já cobertos: `²`, `√`), `main.py`, `history.py`, schema público, `ARCHITECTURE.md` (§8.3 já era genérico o bastante, sem menção explícita a "retas" que precisasse de atualização), RF-04 do `PRD.md` (idem).

---

## 3. Testes executados

### 3.1 Validação isolada (script descartável, removido após uso)

20 casos via `solve_expression()` + `format_result()` + `render_math()` direto, 100% conforme o esperado:

- Circunferência: centro+raio, centro não-origem, centro+ponto (raio derivado por `distance_between_points`), raio zero → `ExpressionError`.
- Parábola: eixo vertical, eixo horizontal, foco=vértice → erro, foco fora dos eixos coordenados (diagonal) → erro.
- Elipse: caso simples, centro deslocado com resultado irracional (`√21`), semieixo menor ≥ maior → erro explícito.
- Hipérbole: caso simples, centro deslocado com resultado irracional (`√17`), semieixo negativo → erro.
- Regressão cross-domain: `reta(...)`, `reta_m(...)`, `log(100)`, `ln(E)`, `sin(x)=1/2`, `f(x)=x**2`, `x**2-4=0` — todos inalterados.

Valores conferidos manualmente: `circunferencia((0,0),5)` → `x² + y² = 25`; `hiperbole((0,0),4,3)` → focos `(±5,0)`, assíntotas `y=±3x/4`, excentricidade `5/4`; `elipse((1,2),10,4)` → `c=2√21`, excentricidade `√21/5`.

### 3.2 Smoke test via API real (`uvicorn` + `curl`)

Servidor subido via `.venv/Scripts/python.exe -m uvicorn app.main:app` (ambiente do projeto). `POST /solve` testado com `circunferencia`, `parabola`, `elipse`, `hiperbole` (sucesso) e `circunferencia((0,0),0)` (raio zero → **HTTP 400**, `detail` com a mensagem em português). Regressão via API confirmada com `log(100)`. Servidor encerrado ao final.

### 3.3 `/history`

`GET /history` conferido após as chamadas de sucesso: as 4 resoluções de cônicas + a de regressão aparecem, mais recente primeiro, schema intacto, acentos e símbolos (`²`, `√`) preservados. A chamada de raio zero (`ExpressionError`) corretamente **não** foi adicionada ao histórico.

---

## 4. Limitações intencionais (documentadas, não são bugs)

- Sem rotação de eixos: elipse/hipérbole sempre com eixo maior/transverso paralelo a x; parábola com vértice/foco na diagonal é rejeitada explicitamente em vez de assumida.
- Sem parser inteligente: cônicas só via centro/vértice + parâmetros literais, nunca equação geral digitada.
- Sem geometria espacial (3D).
- Sem gráficos/plotagem.
- Sem interseção entre cônicas, nem entre cônica e reta.
- Sem animações.

---

## 5. Estado atual do projeto

- **Motor matemático**: `algebra/` (Sprint 4), `equations/` (Sprint 5), `functions/` (Sprint 6, estendida 7.1 e 9), `trigonometry/` (Sprint 7), `logarithms/` (Sprint 8), `analytic_geometry/` (Sprint 10 — retas; **Sprint 11 — cônicas, esta sessão**) implementados. `calculus/`, `matrices/`, `parser/` seguem como placeholders vazios.
- **API pública**: inalterada (`POST /solve`, `GET /history`, `GET /health`).
- **Frontend**: inalterado.
- **Ainda sem testes automatizados**: validação manual (script descartável + curl), mesmo padrão desde a Sprint 6 — pytest e GitHub Actions seguem reservados para o Hardening II, próxima etapa do roadmap.
- **Roadmap**: Geometria Analítica II concluída. Próxima etapa: Hardening II (pytest + GitHub Actions) → Parser Inteligente → Cálculo.

## 6. Objetivo da próxima sprint

Hardening II — introduzir pytest (cobrindo todas as áreas do Math Engine implementadas até aqui) e GitHub Actions (CI), antes de avançar para o Parser Inteligente.
