# SESSION LOG — 2026-08-06 — Sprint V2.12: Passo a Passo de Limites

## Escopo

Adicionar passo a passo para limites: substituição direta (funções
contínuas, incluindo polinômios e racionais sem indeterminação);
constantes; indeterminação 0/0 por fatoração/cancelamento; limites no
infinito de funções racionais por comparação de graus (numerador de grau
igual ou menor que o denominador — divergência e `x→-∞` ficam fora do
escopo). Fora de escopo: regra de L'Hôpital, limites trigonométricos,
exponenciais, logaritmos, infinitos laterais, continuidade, épsilon-delta,
séries, Taylor — reservado para V2.12.x futuras.

## Arquitetura reutilizada da V2.9–V2.11

Novo `backend/app/math_engine/steps/limits.py`. **Nenhum resolvedor
paralelo**: todo valor final vem de `calculus/limits.py:compute_limit` (o
MESMO `sympy.limit` que o `/solve` já usa) ou de operações reais do SymPy
(`cancel()`, `factor()`, `degree()` — mesma categoria de
`compute_derivative`/`compute_indefinite_integral`, nunca uma conta manual
inventada). O módulo só decide COMO fatiar o cálculo em passos.

**Refatoração de reuso**: a técnica de substituição textual (`x` trocado
pelo VALOR entre parênteses, sem simplificar — evita o mesmo problema já
documentado desde `quadratic_equations._bhaskara_steps`) estava privada em
`definite_integrals.py` desde a V2.10.2 (`_substitute_bound_text`).
Promovida para `steps/formatting.py` como `substitute_symbol_text`, e
`definite_integrals.py` atualizado para importar dali — comportamento
idêntico, os 20 testes antigos continuam passando sem alteração.

## Como o dispatcher detecta limites

`calculus/dispatcher.py` ganhou `is_limit_call`/`parse_limit_call`
(aditivas, mesmo padrão de `is_derivative_call`/`parse_derivative_call`,
reaproveitando `_CALL_PATTERN`/`_split_top_level_args`/`_parse_variable`/
`_parse_fragment` já existentes). `steps/dispatcher.py` roteia
`limite(expr, var, ponto)` diretamente para `limits.py`, que faz sua
própria classificação interna e levanta sua própria mensagem amigável —
`limite` deixou de cair na exclusão geral de domínio de cálculo (que antes
rejeitava TODO limite, sem distinguir suportado de não suportado).

## Detecção de indeterminação

Via árvore SymPy real, nunca regex: `expr.as_numer_denom()` +
`Expr.is_polynomial(symbol)` decide se a expressão é razão de dois
polinômios (o denominador pode ser 1). Se `denominador(ponto) != 0`:
substituição direta. Se `numerador(ponto) == denominador(ponto) == 0`:
tenta `sympy.cancel(numer/denom)` — se UM cancelamento de `(x-ponto)` já
resolve (denominador cancelado não se anula mais em `ponto`), mostra
`factor(numerador)` → forma cancelada → resultado; caso contrário (ainda
indeterminado após um cancelamento), rejeita com mensagem amigável — fora
do escopo desta versão, sem exemplo no ticket.

## Comparação de graus (limites no infinito)

`sympy.degree(numerador, x)`/`degree(denominador, x)` (mesma função já
usada em `steps/dispatcher.py` para rotear equações por grau). SEMPRE
divide numerador e denominador por `x^{grau do denominador}` — essa regra
única cobre tanto o caso de graus iguais (`(3x²+2)/(x²-1)`, ticket CASO 4)
quanto o de numerador menor (`(x²+1)/(x³+5)`, ticket CASO 5), sem código
dedicado a cada ramo. Grau do numerador MAIOR que o do denominador
(diverge para ±∞) e `x→-∞` ficam fora do escopo — sem exemplo no ticket,
e evitam introduzir uma representação de "∞" nunca antes testada no
pipeline de KaTeX dos passos.

## Exemplos validados (pytest + navegador real)

| Entrada | Passos |
| --- | --- |
| `lim x→2 (x³-2x+1)` | 3 passos — contínua → `(2)³-2·(2)+1` → `5` — validado no navegador |
| `lim x→2 (x+1)/(x+3)` | Mesmo caminho de substituição direta → `3/5` |
| `lim x→2 (x²-4)/(x-2)` | 6 passos — `0/0` → indeterminação → `(x-2)(x+2)` → `x+2` → `4` — validado no navegador |
| `lim x→∞ (3x²+2)/(x²-1)` | 5 passos — graus iguais → divide por x² → `(3+2/x²)/(1-1/x²)` → `3/1` → `3` — validado no navegador |
| `lim x→∞ (x²+1)/(x³+5)` | Mesma estrutura, numerador de grau menor → `0` |
| `lim x→0 sin(x)/x` | Mensagem amigável — validado no navegador; `/solve` continua devolvendo `Limite: 1` |

## Zero mudança de frontend

Verificado por debug-render ANTES de escrever qualquer código de produto
(mesma prática das sprints anteriores): `\lim_{x\to p}` já era suportado
desde a Sprint 12 (`productHandler`); "0/0", `(x-2)(x+2)`, frações de
frações com expoente negativo (`x**(-3)`) — tudo renderiza corretamente
pelo pipeline `valueToLatex` já existente, sem precisar de nenhuma
correção pontual de símbolo desta vez (diferente de V2.9.1a/V2.10.1/V2.11,
que precisaram de exceções para "b"/"C"/"g").

## Resultados dos testes

- `pytest`: **1197 passed** (17 novos: `test_steps_limits.py` + 7 novos em
  `test_api_steps.py`; 1 teste de regressão em `test_steps_derivatives.py`
  atualizado — `limite` deixou de ser rejeitado pela exclusão geral).
- `vitest`: **917 passed** (4 novos em `MathSteps.test.tsx`; 2 falhas
  conhecidas/pré-existentes em arquivos não tocados por esta sprint,
  confirmadas 42/42 passando isoladas — mesmo padrão de flake documentado
  em sprints anteriores).
- `tsc --noEmit`/`eslint`/`next build`: limpos, 15 rotas.
- Validado no navegador real: substituição direta, 0/0 com fatoração e
  cancelamento, infinito por comparação de graus, e rejeição amigável para
  `sin(x)/x` (com `/solve` continuando a funcionar) — todos batendo
  exatamente com o design.

## Limitações conhecidas

Mesmo escopo do ticket: L'Hôpital, limites trigonométricos/exponenciais/
logarítmicos, laterais, continuidade, épsilon-delta, séries, Taylor,
`x→-∞`, e limites no infinito onde o numerador diverge (grau maior que o
denominador) ficam para V2.12.x — todas caem na mensagem amigável, nunca
em erro interno.

## Estado atual

Commit `3bddd9b` ("feat(steps): add step-by-step resolution for limits
(Sprint V2.12)"), pushed `21f8a68..3bddd9b`. Autorização explícita do Theo
("commite e de push alem de atualizar o session log e readme").
