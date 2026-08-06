# SESSION LOG — 2026-08-05 — Sprint V2.10: Passo a Passo de Derivadas

## Escopo

Expandir a infraestrutura de passo a passo (V2.9/V2.9.1) para derivadas — regra da
potência para polinômios de uma variável (constantes, `x^n`, coeficiente·`x^n`, somas e
diferenças desses termos) e a linearidade da derivada da soma. Camada puramente didática,
não um resolvedor novo: o resultado do `/solve` continua exatamente igual. Fora de
escopo: produto, quociente, cadeia, funções transcendentais, implícita, paramétrica,
parcial — reservado para versões futuras.

## Arquitetura reutilizada da V2.9/V2.9.1

Novo `backend/app/math_engine/steps/derivatives.py`. **Nunca um segundo motor de
derivadas**: todo valor final mostrado — inclusive o de cada termo isolado — vem de
`calculus/derivatives.py:compute_derivative` (o MESMO `sympy.diff` que o `/solve` já
chama); o módulo só decide como fatiar esse cálculo único numa sequência ensinável.
`title_segments`/`MixedMathText` (Hotfix V2.9.1a) reaproveitados sem alteração para
títulos que embutem o termo sendo derivado (ex. "Derivando 4x⁴ pela regra da potência").

## Como o dispatcher decide que é derivada

`calculus/dispatcher.py` ganhou 2 funções aditivas e não-destrutivas:
`is_derivative_call` (restrita à operação `derivada`, nunca `integral`/`limite`) e
`parse_derivative_call` (reaproveita o parser `_CALL_PATTERN`/`_split_top_level_args`/
`_parse_variable`/`_parse_fragment` já existente — nenhuma regex nova).
`steps/dispatcher.py` checa `is_derivative_call` ANTES da exclusão geral de domínio de
cálculo (que ainda rejeita `integral`/`limite` — grupo restante nessa exclusão até a
V2.10.1 acrescentar integrais indefinidas).

## Seleção de método / classificação de termo

Cada termo do polinômio (já expandido, `as_ordered_terms()` — grau decrescente, mesma
convenção de leitura "ax²+bx+c" do resto do produto) é classificado como
`(coeficiente, expoente)` via `as_independent(symbol, as_Add=False)`. Fora desse formato
(função transcendental, produto/quociente entre variáveis, expoente negativo/fracionário)
→ `ExpressionError` amigável ANTES de gerar qualquer passo — `/solve` continua calculando
normalmente (motor de cálculo 100% intocado).

Regra da potência com coeficiente (`coeff·x^n`, coeff≠1, n≥2) mostra DOIS passos: a
multiplicação não-simplificada (`3*7*x**2`, string montada manualmente — o printer do
SymPy reordena fatores negativos de forma imprevisível num `Mul` não avaliado, mesmo
problema já documentado em `quadratic_equations._bhaskara_steps`) e depois o valor
simplificado.

## Exemplos validados (rodados de ponta a ponta)

| Entrada | Passos |
| --- | --- |
| `d/dx(7)` | "A derivada de uma constante é zero" → `0` |
| `d/dx(x⁵)` | "Derivando x⁵ pela regra da potência" → `5x⁴` |
| `d/dx(7x³)` | `3*7*x**2` (não-simplificado) → "Simplificando" → `21x²` |
| `d/dx(x²+3x)` | Função original → linearidade → `2x` → `3` → Somando → `2x+3` |
| `d/dx(4x⁴+2x²-8x+5)` | 9 passos, grau decrescente → `16x³+4x-8` (bate com `/solve`) |
| `d/dx(sin(x))` | Erro amigável; `/solve` continua devolvendo `cos(x)` |

## Bug real encontrado durante o desenvolvimento

`sympy.Add.make_args()` devolve os termos numa ordem interna ARBITRÁRIA (ex. constante
antes do termo de maior grau) — trocado por `as_ordered_terms()` (grau decrescente),
confirmado empiricamente antes de escrever os testes.

## Resultados dos testes

- `pytest`: **1086 passed** (23 novos: `test_steps_derivatives.py` + casos em
  `test_api_steps.py`).
- `vitest`: **899 passed** (14 novos, cobrindo a renderização KaTeX de `derivada(...)`
  via o pipeline `to-latex.ts` já existente — **zero componente de frontend alterado**,
  confirmado que `derivada(expr, x)` já renderiza `\frac{d}{dx}(...)` via o
  `productHandler` de sprints de cálculo anteriores).
- `tsc --noEmit`/`eslint`/`next build`: limpos.

## Validação visual

Confirmado no navegador real: `d/dx(4x⁴+2x²-8x+5)` produz os 9 passos esperados,
`d/dx(sin(x))` mostra o erro amigável sem quebrar a tela, resultado principal (`/solve`)
sempre intacto.

## Limitações conhecidas

Só polinômios de uma variável com expoente inteiro ≥ 0 — produto/quociente/cadeia,
funções transcendentais, derivadas implícitas/paramétricas/parciais ficam para versões
futuras (V2.10.x).

## Estado atual

Commit `71cbdff` ("feat(steps): add step-by-step resolution for derivatives (Sprint
V2.10)"), pushed `fb02adf..71cbdff`. Autorização explícita do Theo ("pode commitar e dar
push").
