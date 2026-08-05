# SESSION LOG — 2026-08-05 — Sprint V2.9.1: Passo a Passo de Equações Quadráticas

## Escopo

Expandir a infraestrutura de passo a passo da V2.9 para equações quadráticas de uma
incógnita, com seleção automática do método — nunca Bhaskara indiscriminadamente. Sem IA,
determinístico. Reutiliza integralmente a arquitetura da V2.9 (não conceitualmente: o mesmo
código é chamado com alvos diferentes). Endpoint (`POST /solve/steps`) e `/solve` intocados.

## Seleção automática do método (prioridade)

1. **Grau 1 (incl. degenerado)** — `0x²+2x=6` expande para grau 1 e é roteado para
   `linear_equations` pelo `steps/dispatcher.py`, sem nenhum código dedicado a "caso
   degenerado" em lugar nenhum: quem decide linear × quadrática é o grau REAL
   (`sympy.degree`), nunca regex.
2. **`b=0` e `-c/a ≥ 0`** — raiz quadrada direta (`x²=k` → `x=±√k`), sem discriminante.
3. **`a=1` (mônica) e as duas raízes exatas INTEIRAS e distintas** — fatoração via
   `sympy.factor()`. Critério propositalmente mais estrito que "fatora sobre os
   racionais": `2x²+3x-5=0` também fatora limpo em `(x-1)(2x+5)`, mas uma raiz é `-5/2`
   (não inteira) — vai para Bhaskara mesmo assim, como pedido ("fatoração apenas quando a
   fatoração INTEIRA não for natural").
4. **Qualquer outro caso** (não mônica, raízes racionais não inteiras, raiz dupla,
   irracionais, complexas — incluindo `b=0` com `-c/a < 0`) — fórmula de Bhaskara.
   Δ>0/Δ=0/Δ<0 são ramos NATURAIS do mesmo cálculo do discriminante, não casos hardcoded
   à parte — mesmo espírito de identidade/contradição em `reduce_to_value` (V2.9).

## Arquitetura reutilizada da V2.9 (reuso literal, não só conceitual)

- `linear_equations.reduce_to_value` é chamado com **`x**2`** como alvo (não só `x`) no
  caminho de raiz direta — `Expr.as_independent()`/`.has()` do SymPy aceitam qualquer
  subexpressão como alvo, não só um `Symbol` atômico, então o MESMO código "mover termos,
  isolar coeficiente" da V2.9 funciona sem nenhuma alteração.
- O mesmo `reduce_to_value` resolve cada fator linear já isolado (`x - r = 0`) no caminho
  de fatoração — cada fator é literalmente uma equação linear trivial.
- `_parse_sides` (privado em `linear_equations.py`) foi promovido a `parse_equation_sides`
  (público) — `linear_systems.py` migrou para reusá-lo em vez de manter uma cópia própria
  (duplicação pré-existente da V2.9, corrigida de brinde).
- `steps/dispatcher.py` agora roteia por **grau real** em vez de assumir sempre linear.

## O que foi implementado

1. Backend: novo `math_engine/steps/quadratic_equations.py`
   (`generate_quadratic_equation_steps`, `_direct_square_root_steps`,
   `_try_integer_factoring`, `_factoring_steps`, `_bhaskara_steps`).
2. `steps/dispatcher.py`: roteamento por `sympy.degree(expand(lhs-rhs), symbol)`.
3. `steps/linear_equations.py`: `parse_equation_sides` público; `steps/linear_systems.py`
   passou a reusá-lo.
4. `steps/validation.py`: mensagens atualizadas ("lineares e quadráticas").

## Exemplos validados (rodados de ponta a ponta)

| Entrada | Método | Resultado |
| --- | --- | --- |
| `x²=16` / `x²=49` | Raiz direta | `x=4,x=-4` / `x=7,x=-7` |
| `2x²=18` / `5x²-45=0` | Raiz direta (isola `x²` antes de dividir) | `x=3,x=-3` |
| `x²-5x+6=0` | Fatoração | `x=3,x=2` |
| `x²+5x+6=0` | Fatoração | `x=-2,x=-3` |
| `2x²+3x-5=0` | Bhaskara (fatora sobre racionais, mas -5/2 não é inteiro) | Δ=49, `x=1,x=-5/2` |
| `x²+1=0` | Bhaskara (b=0, mas -c/a<0 → discriminante) | Δ=-4, `x=i,x=-i` |
| `x²-4x+4=0` | Bhaskara, Δ=0 | raiz dupla `x=2` |
| `0x²+2x=6` | Delegado ao motor linear (grau real = 1) | `x=3` |

Validado no navegador real (backend `uvicorn` + frontend `next dev`): Bhaskara completo
com `Δ` renderizado, raízes complexas (`x=i`/`x=-i`), fatoração `(x-3)(x-2)=0` — todos com
KaTeX correto, resultado principal intacto.

## Bug real encontrado durante o desenvolvimento

`sympy.factor(2x²+3x-5)` devolve `(x-1)*(2x+5)` — fatora limpo sobre os racionais mesmo
para o caso que deveria ir por Bhaskara (uma raiz, `-5/2`, não é inteira). O critério de
"fatoração natural" foi corrigido para exigir explicitamente `a=1` e **ambas** as raízes
`.is_Integer` — não basta "fatorar sobre os racionais".

## Resultados dos testes

- `pytest`: **1059 passed** (20 novos, incl. `test_steps_quadratic_equations.py`).
- `vitest`: **889 passed** (18 novos — cobertura de `MathSteps`/`to-latex` para os
  formatos novos de expressão: `Delta=...`, raízes fracionárias/complexas).
- `tsc --noEmit`/`eslint`/`next build`: limpos.

## Um pequeno desvio do frontend intocado

Um teste (`x²+1=0`) revelou que o pipeline `to-latex.ts` rejeitava `"Delta=49"` inteiro:
`Delta` sozinho como um LADO da equação casa com o guard `BARE_WORD` (existente para
manter rótulos como "crescente" como texto puro), e a conversão inteira falhava. Corrigido
com uma tabela de 1 entrada (`NAMED_SYMBOL_LATEX = { Delta: "\\Delta" }`) checada ANTES do
guard — mesmo padrão de vocabulário aditivo já usado em toda sprint anterior de motor novo
(`SET_GLYPH_LATEX`, `COMBINATORICS_LATEX`). Documentado explicitamente ao Theo antes de
prosseguir.

## Limitações conhecidas

- Fatoração só tentada para equações mônicas (`a=1`); `2x²-6x+4=0` (não-mônica, raízes
  inteiras) vai para Bhaskara em vez de fatorar — decisão de escopo documentada no código.
- Raiz `-5/2` (fração exata) em vez de `-2.5` decimal — mantém a convenção do resto do
  produto (nunca decimal onde há forma exata) e evita inconsistência com o campo `result`
  da mesma resposta.

## Estado atual

Commit `40d401a` ("feat(steps): add step-by-step resolution for quadratic equations
(Sprint V2.9.1)"), pushed `651c305..40d401a`. Autorização explícita do Theo ("pode
commitar e dar push").

## Objetivo da próxima sprint

Ver `docs/SESSION_LOG_2026-08-05-hotfix-v2.9.1a-titulos-mistos.md` — no mesmo dia, um
hotfix (V2.9.1a) resolveu a renderização de matemática embutida nos TÍTULOS dos passos
(ex. a fórmula de Bhaskara aparecia como texto cru dentro do título).
