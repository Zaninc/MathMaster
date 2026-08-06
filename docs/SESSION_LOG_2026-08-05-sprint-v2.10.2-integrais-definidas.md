# SESSION LOG — 2026-08-05 — Sprint V2.10.2: Passo a Passo de Integrais Definidas

## Escopo

Estender o passo a passo (V2.9 → V2.9.1 → V2.10 → V2.10.1) para integrais DEFINIDAS —
o Teorema Fundamental do Cálculo aplicado sobre a mesma regra da potência das integrais
indefinidas: constantes, `x^n`, coeficiente·`x^n`, somas e diferenças, polinômios
completos. Casos especiais: limites iguais (intervalo de comprimento nulo → 0) e limites
invertidos (área orientada, resultado com sinal preservado, NUNCA valor absoluto). Fora de
escopo: substituição, integração por partes, integrais impróprias/infinitas,
trigonométricas/exponenciais/logaritmos, múltiplas, área entre curvas, integrais
numéricas — mesma mensagem amigável de sempre, `/solve` nunca afetado.

## Arquitetura reutilizada da V2.9/V2.9.1/V2.10/V2.10.1

**Nenhum componente novo, nenhum resolvedor paralelo.** Novo
`backend/app/math_engine/steps/definite_integrals.py`, mas o núcleo — encontrar a
primitiva F(x) pela regra da potência — foi extraído de `steps/integrals.py` para uma
função pública compartilhada, `find_primitive_steps`, chamada identicamente pelo caminho
indefinido (que ainda anexa "+ C") e pelo definido (que anexa os passos do TFC no lugar).
O valor numérico final de cada exemplo vem sempre de
`calculus/integrals.py:compute_definite_integral`, o MESMO motor que `/solve` já chama —
o passo a passo nunca pode divergir do resultado real.

## Como o dispatcher decide que é integral definida

`calculus/dispatcher.py` ganhou `is_definite_integral_call` e `parse_definite_integral_call`,
irmãs de `is_indefinite_integral_call`/`parse_integral_call` (V2.10.1) — mesmo
`_CALL_PATTERN`/`_split_top_level_args`, mas exigindo EXATAMENTE 4 argumentos (`expr, var,
inferior, superior`) em vez de 2. Mutuamente exclusivas por contagem de argumentos, sem
regex frágil. `steps/dispatcher.py` roteia para o novo módulo antes da exclusão geral de
cálculo.

## Como o Teorema Fundamental foi implementado

Depois de `find_primitive_steps` devolver F(x), três passos fixos são anexados:
"Aplicando o Teorema Fundamental do Cálculo" (`F(b)-F(a)`, usando a notação de função
`F(...)` — que o mathjs já renderiza via seu fallback genérico `\mathrm{F}(...)`, sem
exigir nenhum componente novo), "Substituindo os limites" (substituição textual do símbolo
pelo valor do limite, sempre entre parênteses) e "Calculando" (o valor real, via
`compute_definite_integral`).

## Como o "+ C" foi evitado

`find_primitive_steps` nunca inclui "+ C" — esse passo só existe na função chamadora
indefinida (`generate_integral_steps`). O caminho definido chama a função compartilhada e
para por aí; estruturalmente impossível vazar "+ C".

## Um bug real pego durante o desenvolvimento

A primeira versão de `_substitute_bound_text` concatenava `f"{upper_text}-{lower_text}"`
sem parênteses ao redor da substituição do limite inferior. Para primitivas com 2+ termos
e limite inferior diferente de zero (ex. `∫₁² x²+3x dx`), isso produzia uma string como
`"(2)**3/3 + 3*(2)**2/2-(1)**3/3 + 3*(1)**2/2"` que, lida da esquerda para a direita, só
nega o PRIMEIRO termo do limite inferior — um erro matemático real no passo exibido (o
valor final, calculado separadamente por `compute_definite_integral`, sempre esteve
correto). Pego comparando manualmente o valor da fórmula exibida com o resultado real
antes de confiar no formato; corrigido envolvendo o limite inferior inteiro em parênteses:
`f"{upper_text}-({lower_text})"`. Teste de regressão dedicado documenta o bug e o fix.

## Casos especiais

- **Limites iguais** (`∫₃³x²dx`): curto-circuita todo o processo de encontrar a primitiva
  — matematicamente, um intervalo de largura zero vale sempre zero, independente do
  integrando. Passo único com explicação, resultado `0`.
- **Limites invertidos** (`∫₂⁰x²dx`): NENHUM código especial — a fórmula geral
  `F(b)-F(a)` combinada com o comportamento natural de `compute_definite_integral` para
  `inferior > superior` já produz o resultado orientado (negativo) corretamente. Validado:
  `F(0)-F(2)` → `-8/3`, nunca convertido para valor absoluto.

## Exemplos validados (pytest + navegador real)

| Entrada | Passos |
| --- | --- |
| `∫₀² x²dx` | Integral original → regra da potência → TFC → Substituindo → Calculando (`8/3`) |
| `∫₀² (x²+3x)dx` | 8 passos (linearidade + 2 termos) → `26/3` — renderizado no navegador com KaTeX, `F(2)-F(0)`, sem "+ C" |
| `∫₃³ x²dx` | 2 passos, "comprimento nulo" → `0` |
| `∫₂⁰ x²dx` | `F(0)-F(2)` → `-8/3` (sinal preservado) |
| `∫₀¹ sin(x)dx` | Mensagem amigável no passo a passo; `/solve` continua devolvendo `1 - cos(1)` |

## Resultados dos testes

- `pytest`: **1144 passed** (25 novos: `test_steps_definite_integrals.py` com 20 testes +
  6 casos novos/atualizados em `test_api_steps.py`), zero regressões.
- `vitest`: **907 passed** (4 novos em `MathSteps.test.tsx`, zero componente de produto
  do frontend alterado — a notação `F(x)`, a substituição de limites e o `∫ₐᵇ...dx` já
  renderizavam corretamente pela pipeline de LaTeX existente).
- `tsc --noEmit`/`eslint`/`next build`: limpos, 15 rotas.
- Validado no navegador real: os 4 cenários (linearidade, limites iguais, limites
  invertidos, `sin(x)` fora de escopo) renderizam exatamente como especificado.

## Limitações conhecidas

Mesmo escopo de `find_primitive_steps` (regra da potência para polinômios de uma
variável): substituição, integração por partes, trigonométricas/exponencial/logaritmo,
integrais impróprias/infinitas, múltiplas e área entre curvas ficam para versões futuras
— todas caem na mensagem amigável, nunca em erro interno.

## Estado atual

Commit `7c8eb1f` ("feat(steps): add step-by-step resolution for definite integrals
(Sprint V2.10.2)"), pushed `d0691d2..7c8eb1f`. Autorização explícita do Theo ("commite e
de push").
