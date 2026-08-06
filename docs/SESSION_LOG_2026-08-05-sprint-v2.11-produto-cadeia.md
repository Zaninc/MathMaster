# SESSION LOG — 2026-08-05 — Sprint V2.11: Passo a Passo de Regra do Produto e Regra da Cadeia

## Escopo

Estender o passo a passo de derivadas (V2.10 → V2.11) para dois casos que a
regra da potência simples não cobre: **regra do produto** — `(fg)' = f'g +
fg'` — para `x²·sin(x)`, `(x+1)(x²+3)`, `x·exp(x)`; e **regra da cadeia** —
`(f(g(x)))' = f'(g(x))·g'(x)` — para `(x²+1)³`, `(3x+2)⁵`, `sin(x²)`,
`cos(3x)`, `exp(x²)`; e a combinação das duas — `(x²+1)³·sin(x)`. Fora de
escopo: quociente, derivada implícita, logarítmica, parcial, hiperbólicas,
vetorial, paramétrica — reservado para V2.11.x futuras.

## Arquitetura reutilizada da V2.9/V2.10/V2.10.1/V2.10.2

**Nenhum componente novo, nenhum resolvedor paralelo.** Novo
`backend/app/math_engine/steps/advanced_derivatives.py`. Todo valor final
mostrado — inclusive o de cada fator/parte isolada — vem de
`calculus/derivatives.py:compute_derivative`, o MESMO `sympy.diff` que o
`/solve` e a V2.10 já usam. `derivatives.py` (V2.10) permanece 100%
intocado; o novo módulo só entra em cena quando o dispatcher decide que a
expressão exige produto/cadeia.

## Como o dispatcher decide entre V2.10 e V2.11

`advanced_derivatives.is_product_or_chain_shape(expr, symbol)` analisa a
**árvore SymPy original, nunca expandida**: `expr.is_Mul` com exatamente
dois fatores não numéricos dependendo da variável (produto, com
`as_numer_denom()[1] == 1` — `x/sin(x)` tem denominador `sin(x)`, é
quociente, fora de escopo); `Pow` de base composta com expoente inteiro
≥2, ou `sin`/`cos`/`exp` de um argumento que não é a própria variável
isolada (`sin(x²)`, nunca `sin(x)` — trivial, sem cadeia de verdade), para
a cadeia. `steps/dispatcher.py` chama essa checagem logo depois de
confirmar `is_derivative_call` e ANTES de decidir entre `derivatives.py` e
`advanced_derivatives.py`.

**Decisão-chave**: essa checagem acontece sobre a expressão ORIGINAL, nunca
sobre a expandida — `(x+1)(x²+3)`, `(x²+1)³` e `(3x+2)⁵` TAMBÉM se
expandem para polinômios simples que `derivatives.py` (V2.10) saberia
"resolver" por linearidade da soma, mas o objetivo desta sprint é ENSINAR
a regra do produto/cadeia nesses casos, não escondê-la atrás da expansão.

## Regra do produto

Passos fixos: "Identificando um produto" (`f=..., g=...`) →
"Aplicando a regra do produto" (fórmula genérica, em notação de Leibniz —
`derivada(f*g, x)=derivada(f, x)*g+f*derivada(g, x)`, não notação de
prima, que o mathjs não parseia) → derivada de cada fator (um passo
único via `compute_derivative` para fatores triviais; os passos completos
da cadeia embutidos quando um fator exige cadeia, ex. `(x²+1)³·sin(x)`) →
"Substituindo" (concatenação manual `f'*g+f*g'`, sempre com parênteses ao
redor de qualquer termo que seja uma soma — mesma lição da V2.10.2) →
"Simplificando" (valor final real).

## Regra da cadeia

Passos fixos: "Identificando função composta" (`u=interna, y=externa(u)`)
→ "Derivando a externa" (`n*u**(n-1)` para potência; `cos(u)`/`-sin(u)`/
`exp(u)` para trig/exp) → "Derivando a interna" (`compute_derivative` da
parte interna) → "Aplicando a regra da cadeia". Para potência, um passo
extra "Simplificando" reordena a forma bruta da regra (`3*(x²+1)²*2*x` →
`6*x*(x²+1)²`) — para trig/exp, o valor já canônico do motor real É a
aplicação da cadeia, sem precisar de um passo redundante mostrando a
mesma string duas vezes.

## Bug evitado por verificação empírica prévia (nunca chegou a existir em produção)

Antes de escrever qualquer código, testei via `node`/mathjs se os símbolos
auxiliares `u`, `f`, `g`, `y` colidiam com unidades embutidas do mathjs
(mesmo problema já visto com `b`/bel e `C`/coulomb nas Sprints
V2.9.1a/V2.10.1). `u`/`f`/`y` renderizam limpos; `g` colide (unidade
"grama", `\mathrm{g}` em vez de itálico) — corrigido com a MESMA técnica
de 1 linha em `productHandler` (`to-latex.ts`) já usada para `b`/`C`.
Verificado também que a fórmula genérica do produto
(`derivada(f*g,x)=derivada(f,x)*g+f*derivada(g,x)`) passa pelo pipeline
real (`valueToLatex`, que reconhece "lista de igualdades" e por isso
processa cada lado separadamente) antes de decidir usá-la.

## Exemplos validados (pytest + navegador real)

| Entrada | Passos |
| --- | --- |
| `d/dx(x²·sin(x))` | 7 passos — Identificando produto → f'=2x → g'=cos(x) → Substituindo → `x²cos(x)+2xsin(x)` |
| `d/dx((x+1)(x²+3))` | Regra do produto genuína, nunca escondida pela expansão polinomial |
| `d/dx((x²+1)³)` | 6 passos — u=x²+1, y=u³ → 3u² → 2x → `3(x²+1)²·2x` → `6x(x²+1)²` |
| `d/dx(sin(x²))`/`cos(3x)`/`exp(x²)` | Cadeia trig/exp, colapsando direto no valor final canônico |
| `d/dx((x²+1)³·sin(x))` | Produto + cadeia combinados, 11 passos, sem colisão de títulos |
| `d/dx(x/sin(x))` | Mensagem amigável; `/solve` continua devolvendo `-x·cos(x)/sin(x)²+1/sin(x)` |

Validado no navegador real: os 4 cenários acima (produto, cadeia,
combinado, quociente rejeitado) renderizam exatamente como especificado,
incluindo `f`/`g`/`u`/`y` em itálico correto.

## Resultados dos testes

- `pytest`: **1173 passed** (20 novos em `test_steps_advanced_derivatives.py`
  + 9 novos em `test_api_steps.py`), zero regressões — confirmado que
  nenhuma derivada polinomial simples da V2.10 foi desviada para o novo
  módulo.
- `vitest`: **913 passed** (1 falha conhecida/pré-existente em
  `FormulasReference.test.tsx`, não relacionada a esta sprint, confirmada
  14/14 passando isolada). Zero componente de produto do frontend
  alterado além da correção pontual do símbolo `g`.
- `tsc --noEmit`/`eslint`/`next build`: limpos, 15 rotas.

## Limitações conhecidas

Mesmo escopo do ticket: quociente, derivada implícita, logarítmica,
parcial, hiperbólicas, vetorial e paramétrica ficam para V2.11.x futuras
— todas caem na mensagem amigável, nunca em erro interno. Produto restrito
a exatamente 2 fatores sem coeficiente numérico; potência composta
restrita a expoente inteiro ≥2.

## Estado atual

Commit `d7cc311` ("feat(steps): add step-by-step resolution for product
and chain rules (Sprint V2.11)"), pushed `01e1bf5..d7cc311`. Autorização
explícita do Theo ("commite e de push alem de atualizar o session log e o
readme") — pediu os três na mesma mensagem.
