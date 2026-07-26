# Session Log — 2026-07-26 — Sprint V2.6: Motor de Polinômios Avançados

## Escopo

Sete operações de manipulação simbólica de polinômios: `fatorar`, `expandir`, `simplificar`,
`grau`, `coeficientes`, `raízes` (aliases `raizes`) e `divisão` (alias `divisao`). Diferente das
equações (`equations/`), o foco não é resolver "expr = 0" — é transformar/analisar/manipular um
polinômio já dado. Renderização KaTeX completa (preview, resultado, histórico, exemplos,
biblioteca de fórmulas), 7 teclas novas, 4 exemplos (3 na calculadora, 1 na Home), 2 fórmulas
novas na Biblioteca (as demais pedidas — produto notável, diferença de quadrados, cubo perfeito —
já existiam desde a Sprint 4), exploração contextual (`isPolynomialOperation()`). Contrato do
`/solve` intocado (`{expression, result, approx}`).

## Arquitetura

**`backend/app/math_engine/polynomials/`** — pacote novo, seguindo o mesmo padrão de
`calculus/`/`matrix/`/`complex/` (sintaxe própria por chamada nomeada, nunca notação algébrica
livre):

- `parsing.py` — tabela de nomes canônicos ASCII + aliases acentuados (`CANONICAL_OPERATIONS`:
  `raizes`/`raízes` e `divisao`/`divisão` mapeiam para o mesmo canônico), `_CALL_PATTERN`
  ancorado nas duas pontas (mesmo padrão de `calculus/dispatcher.py` — a chamada precisa ser a
  expressão INTEIRA, nunca composta com outra operação), extração de argumentos por
  bracket-counting (`split_top_level_args`, só usado por `divisao(a, b)`) e parse seguro do(s)
  fragmento(s) (`parse_polynomial_fragment`, reaproveita `safe_parse_expr`/`extract_safe_symbols`
  — sem `log_convention.py`, escopo puramente algébrico).
- `validation.py` — `resolve_polynomial_symbol` (uma única variável; sem símbolo livre nenhum,
  ex. `grau(7)`, usa `x` por convenção; mais de uma letra livre é rejeitado com mensagem
  explícita) e `as_polynomial` (`sympy.Poly(expr, symbol)`, traduz `PolynomialError` nativo do
  SymPy para uma mensagem amigável — cobre `1/x`, `sin(x)`, `sqrt(x)`, expoente fracionário/etc.).
- `evaluator.py` — `factor_polynomial`/`expand_polynomial` **reaproveitam 100%** de
  `algebra/factor.py`/`algebra/expand.py` (zero lógica de SymPy duplicada, regra explícita da
  sprint); `simplify_polynomial` usa `cancel()` (não `simplify()` genérico — determinístico,
  cancela o MDC entre numerador/denominador); `polynomial_degree`/`polynomial_coefficients`/
  `polynomial_roots`/`polynomial_division` são operações novas desta área.
- `formatter.py` — nunca devolve `Poly(...)`/repr() do SymPy. `format_roots` reaproveita o MESMO
  vocabulário "var = valor" que `equations/quadratic.py` já produz (passa intocado pelo
  formatter compartilhado, que já sabe ordenar por (Re, Im) e numerar com subscrito Unicode).
  `format_division` reaproveita o padrão "Rótulo: valor; Rótulo: valor" que `calculus/` já usa.
  `format_coefficients` usa colchetes (`"[1, 2, 0, -5]"` — fora da whitelist de caracteres do
  formatter compartilhado, nunca reinterpretado). `format_expanded` — ver "Bug real encontrado"
  abaixo.
- `dispatcher.py` — `is_polynomial_domain_expression`/`solve_polynomial_text`, orquestra tudo.

**Posição na cascata** (`math_engine/dispatcher.py`): `analytic_geometry` → `summation` →
`matrix` → `complex` → **`polynomials`** → `calculus` → `functions` → `trigonometry` →
`logarithms` → `equations` → `algebra` — mesmo motivo de `calculus`: o argumento de
`fatorar(...)`/`raizes(...)`/etc. pode conter livremente `sin(`, `log(`, `=` etc., que essas
áreas roubariam por regex/`.search()` livre se checadas antes.

### Bug real encontrado e corrigido: `expandir(...)` sendo desfeito pelo formatter compartilhado

`format_result`/`expr_clean.py:clean_expr` (camada de apresentação compartilhada por TODAS as
áreas do motor) aplica uma bateria de simplificadores "seguros" sobre qualquer resultado
classificado como "expressão pura" e prefere a representação MAIS CURTA — `factor` está nessa
bateria. Confirmado empiricamente durante o desenvolvimento: `expandir((x+2)³)` devolvia
`(x - 3)`... na verdade `(x + 2)³` SEM expandir, porque `clean_expr` re-fatorava
`x³+6x²+12x+8` de volta para `(x+2)³` (mais curto) — desfazendo silenciosamente o próprio
propósito da operação. Nenhuma outra das sete operações sofre disso (`fatorar` é idempotente sob
`factor()`; `simplificar`/`grau`/`coeficientes`/`raízes`/`divisão` já bypassam o formatter
compartilhado por outros motivos). Corrigido com um rótulo dedicado — `format_expanded` devolve
`"Expandido: {expr}"` (mesmo padrão "Rótulo: valor" de `calculus/dispatcher.py`) — a string
contém `":"`, que o formatter compartilhado já reconhece e deixa INTOCADA, sem precisar alterar
`expr_clean.py` (código cross-cutting usado por todas as áreas). Coberto por teste de regressão
dedicado em `test_polynomials.py`.

## O que foi implementado

1. Backend: `polynomials/{__init__,parsing,validation,evaluator,formatter,dispatcher}.py` +
   integração na cascata raiz (`math_engine/dispatcher.py`).
2. Frontend KaTeX (`lib/math/to-latex.ts`): `POLYNOMIAL_OPERATION_LATEX` (`\operatorname{}` para
   as sete operações no Tier 1; Tier 2/preview já cobre isso genericamente, sem mudança); caso
   dedicado para `ArrayNode` achatado (`coeficientes(...)` devolve `"[1, 2, 0, -5]"`, sintaxe de
   array válida do mathjs — sem o caso dedicado, o serializer default do mathjs desenha QUALQUER
   array como matriz COLUNA, errado para uma lista horizontal; matriz literal, sempre array de
   arrays, continua 100% pelo caminho default). `"Expandido: ..."`/`"Quociente: ...; Resto: ..."`
   já são reconhecidos pelo padrão "Rótulo: valor" existente; `raízes` já é a forma de lista de
   igualdades existente — nenhuma mudança adicional foi necessária para essas duas formas.
3. Teclado (`data/keyboard.ts`): 7 teclas novas na aba Álgebra, depois de "Sistema linear" —
   sempre inserem a forma ASCII (`raizes`/`divisao`, nunca acentuada: a forma acentuada cai fora
   de `SAFE_CHARSET` do Tier 1 do preview, mesmo motivo documentado para "traço" no Motor de
   Matrizes; o backend aceita as duas grafias igualmente).
4. Exemplos (`data/examples.ts`): 3 na calculadora (`fatorar(x²-9)`, `expandir((x+2)³)`,
   `raízes(x³-6x²+11x-6)`); 1 na Home, substituindo `transpose([[1,2,3],[4,5,6]])` (matriz já
   tinha 5 outros exemplos ali — motor continua 100% suportado, só parou de ocupar espaço).
5. Exploração (`data/connections.ts`): `isPolynomialOperation()` + branch em
   `getCalculatorExplorations` (posicionado logo depois de `isComplex`, mesma posição do
   backend).
6. Biblioteca de Fórmulas (`data/formulas.ts`): 2 fórmulas novas em "algebra" — "Grau de um
   polinômio" e "Relação entre fatoração e raízes" (as outras três pedidas no escopo — produto
   notável, diferença de quadrados, cubo perfeito — já existiam desde a Sprint 4, sem
   duplicação).

## Sintaxes aceitas

| Operação | Sintaxe | Alias |
| --- | --- | --- |
| Fatorar | `fatorar(expr)` | — |
| Expandir | `expandir(expr)` | — |
| Simplificar | `simplificar(expr)` | — |
| Grau | `grau(expr)` | — |
| Coeficientes | `coeficientes(expr)` | — |
| Raízes | `raizes(expr)` | `raízes(expr)` |
| Divisão | `divisao(dividendo, divisor)` | `divisão(dividendo, divisor)` |

## Exemplos validados (contra o `/solve` real, via `TestClient`/HTTP)

| Entrada | Saída |
| --- | --- |
| `fatorar(x²-9)` | `(x - 3)(x + 3)` |
| `fatorar(x²+5x+6)` | `(x + 2)(x + 3)` |
| `fatorar(x³-1)` | `(x - 1)(x² + x + 1)` |
| `expandir((x+2)³)` | `Expandido: x³ + 6x² + 12x + 8` |
| `expandir((x+1)^6)` | `Expandido: x⁶ + 6x⁵ + 15x⁴ + 20x³ + 15x² + 6x + 1` |
| `simplificar((x²-1)/(x-1))` | `x + 1` |
| `simplificar((x²+2x+x²)/2)` | `x² + x` |
| `grau(x⁸+x)` | `8` |
| `grau(0)` | `-∞` (convenção do SymPy, `Poly(0,x).degree() == -oo`) |
| `coeficientes(x⁴+2x²-7)` | `[1, 0, 2, 0, -7]` |
| `raízes(x²+1)` | `x₁ = -i, x₂ = i` |
| `raízes(x³-6x²+11x-6)` | `x₁ = 1, x₂ = 2, x₃ = 3` |
| `divisão(x³-1,x-1)` | `Quociente: x² + x + 1; Resto: 0` |
| `divisao(x⁴-1,x²+1)` | `Quociente: x² - 1; Resto: 0` |

## Limitações conhecidas

- Não implementado nesta versão (fora de escopo, explicitamente reservado para uma V2.6.x
  futura): teorema do resto, teorema das raízes racionais, Briot-Ruffini, interpolação,
  polinômios ortogonais, frações parciais, séries de Taylor.
- `grau`/`coeficientes`/`raízes`/`divisão` só são definidos para um polinômio de UMA variável —
  mais de uma letra livre é rejeitado com mensagem explícita (`"Esta operação só é suportada
  para polinômios de uma única variável..."`), nunca "adivinhado".
- `fatorar`/`grau` sobre um corpo com identidade trigonométrica reconhecível pelo SymPy (ex.
  `fatorar(sin(x)**2 - 1)`) segue o comportamento NATIVO do `sympy.factor()`/`Poly()` (pode
  colapsar via identidade, ou rejeitar como não-polinomial) — nenhum tratamento especial foi
  adicionado, mesmo escopo de `algebra/factor.py` desde a Sprint 4.
- Validação visual interativa no navegador real (clicar nas teclas, digitar na calculadora) não
  foi possível nesta sessão — extensão Claude in Chrome não conectada (mesma limitação já
  registrada em sprints anteriores). Validado por alternativa equivalente: servidores reais
  (`uvicorn`/`next dev`) subidos localmente, chamadas HTTP diretas ao `/solve` confirmando os 14
  casos acima ponta a ponta, e `curl` confirmando que `/formulas`, `/` (Home) e `/calculadora`
  renderizam o conteúdo novo (fórmulas, exemplos) no HTML servido.

## Objetivo da próxima sprint

Conforme o roadmap (`[[mathmaster-roadmap-and-architecture]]`): parser inteligente e explicações
determinísticas seguem como próximos itens da Fase 1. As extensões de polinômios não
implementadas nesta sprint (Briot-Ruffini, teorema das raízes racionais, frações parciais, etc.)
ficam disponíveis como candidatas a uma V2.6.x futura, sem exigir refatoração do pacote atual.
