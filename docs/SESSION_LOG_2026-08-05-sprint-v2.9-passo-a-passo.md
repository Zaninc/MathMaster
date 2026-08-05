# SESSION LOG — 2026-08-05 — Sprint V2.9: Infraestrutura de Passo a Passo

## Escopo

Primeira infraestrutura determinística de resolução passo a passo do MathMaster: equações
lineares de uma incógnita e sistemas lineares 2×2. Sem IA, sem `eval`, sem explicações
probabilísticas — cada passo nasce de uma operação SymPy real (`as_independent`, `expand`,
`linear_eq_to_matrix`), nunca inventado depois que a solução já é conhecida. Endpoint novo e
opcional (`POST /solve/steps`), `/solve` (contrato `{expression, result, approx}`) 100% intocado.

Fora de escopo (reservado para versões futuras): quadráticas, sistemas não lineares, matrizes,
derivadas, integrais, limites, polinômios, combinatória, probabilidade, trigonometria, IA
explicativa, geração de texto livre. Sistemas 3×3+ continuam resolvidos pelo motor atual
(`equations/systems.py`, `linsolve`), só sem passo a passo.

## Arquitetura

Novo pacote `backend/app/math_engine/steps/`, mesmo padrão modular de `<área>/dispatcher.py`
já usado no resto do `math_engine/`:

- `models.py` — `MathStep` (dataclass congelada: `expression`, `title | None`, `explanation | None`).
- `validation.py` — mensagens amigáveis e guards de escopo (inequação, incógnita única, grau
  linear via `sympy.degree`, nunca regex).
- `formatting.py` — helpers de apresentação compartilhados (`eq_text`, `move_title`,
  `isolate_title`) — só decidem COMO montar a string do passo a partir de objetos SymPy já
  calculados, nunca calculam nada matemático.
- `linear_equations.py` — motor de equação linear. `reduce_to_value()` é o núcleo reutilizável
  (mover termos com x → mover constantes → isolar coeficiente), usado tanto pelo fluxo de
  equação única quanto por `linear_systems.py` (resolver a segunda incógnita por substituição é
  literalmente o mesmo problema).
- `linear_systems.py` — sistema 2×2 por eliminação via `sympy.linear_eq_to_matrix`.
- `dispatcher.py` — roteador único (`generate_steps`), replica a MESMA ordem de prioridade de
  domínios de `math_engine/dispatcher.py` (analytic_geometry, summation, matrix, complex,
  polynomials, combinatorics, probability, calculus, functions, trigonometry, logarithms —
  TODOS excluídos antes de sequer considerar equações). Necessário porque vários desses domínios
  usam "=" livremente por dentro (`A=[[1,2],[3,4]]` é matriz, não equação) — sem essa exclusão,
  um texto de outro domínio cairia no parser de equação linear e falharia de forma confusa (ou,
  no caso de matriz, um `AttributeError` cru em vez de `ExpressionError` amigável).

Pequeno acréscimo em `equations/dispatcher.py` (reuso, não duplicação): `_split_equations` virou
pública (`split_equations`) e ganhou uma vizinha nova, `split_equation_sides(text)` — divide uma
equação de um único "=" em `(lado_esquerdo, lado_direito)` **sem** deixar o SymPy avaliar a
igualdade. Necessário porque o caminho de parse do motor atual (`convert_equals_signs` +
`Eq(...)`) faz o SymPy, quando consegue PROVAR que a igualdade é sempre verdadeira ou sempre
falsa independente de x (ex. `2x+1=2x+3`), devolver `BooleanFalse`/`BooleanTrue` em vez de um
`Eq` — exatamente os casos de identidade/contradição que o passo a passo precisa apresentar com
passos próprios, não rejeitar com "não foi possível interpretar a equação" (comportamento atual
do `/solve` para esses casos específicos, bug pré-existente não corrigido aqui — fora de escopo).

API (`app/main.py`, `app/schemas.py`, `app/execution.py`): `POST /solve/steps` chama
`generate_steps_with_timeout` (novo, mesmo isolamento por processo/timeout real de
`solve_expression_with_timeout`) e, separadamente, `solve_expression_with_timeout` (a MESMA
função já usada por `/solve`) para compor `result` — duas chamadas isoladas em vez de uma só,
mantendo `execution.py` com uma função por responsabilidade e sem acoplar o cálculo do resultado
final à geração de passos.

## Contrato do endpoint

```
POST /solve/steps
{ "expression": "2*x+4=10" }

→ 200
{
  "expression": "2*x+4=10",
  "result": "x = 3",
  "steps": [
    { "title": "Equação inicial", "expression": "2*x + 4=10", "explanation": null },
    { "title": "Subtraindo 4 dos dois lados", "expression": "2*x=6", "explanation": null },
    { "title": "Dividindo os dois lados por 2", "expression": "x=3", "explanation": null }
  ]
}
```

`expression` de cada passo é sempre texto matemático puro (nunca LaTeX bruto) — o backend nunca
decide apresentação visual. Erro fora de escopo (equação não linear, sistema 3×3+, inequação,
domínio não suportado, expressão inválida) responde 400 com `detail` amigável, mesmo contrato de
erro já usado por `/solve`.

## Regras de resolução linear

Para uma equação de uma incógnita: distributiva → mover termos com x para um lado → mover
constantes para o outro → dividir/multiplicar pelo coeficiente (fração unitária, ex. 1/3, vira
"multiplicar pelo denominador" — mesma operação, fraseado mais natural em português). A
propriedade distributiva raramente aparece como um passo VISÍVEL separado: o SymPy distribui
automaticamente Número×`(a+b)` já na hora do parse (confirmado empiricamente — `4*(x+2)`
já chega como `4*x + 8`), então o passo "Equação inicial" já reflete a forma expandida nesses
casos; o código de detecção de distribuição existe e funciona (comparação `expand(lhs) != lhs`),
mas fica como defesa para o caso hipotético de um coeficiente não-numérico, não como passo
artificialmente inserido.

Identidade (`2x+1=2x+1` → infinitas soluções) e contradição (`2x+1=2x+3` → sem solução) NÃO são
casos especiais tratados à parte no algoritmo — são o resultado NATURAL de `reduce_to_value`
quando, depois de mover os termos com x, não sobra símbolo nenhum em nenhum dos lados: nesse
ponto só resta comparar duas constantes (iguais → infinitas soluções; diferentes → sem solução).

## Método em sistemas

Eliminação 2×2 via `sympy.linear_eq_to_matrix`: soma direta das duas equações quando o
coeficiente de y já se cancela (`b1 == -b2`), subtração direta quando é igual (`b1 == b2`), e
multiplicação cruzada geral (`m1 = b2, m2 = -b1`) em qualquer outro caso — cancelamento
algébrico garantido por construção (`m1*b1 + m2*b2 = b2*b1 - b1*b2 = 0`), nunca "adivinhado".
Depois de isolar x, substitui numa das equações originais e reaproveita
`linear_equations.reduce_to_value` para isolar y — o mesmo motor que resolve uma equação linear
comum, porque depois da substituição é exatamente isso que sobra. Sem solução/infinitas soluções
em sistemas também caem naturalmente no mesmo mecanismo de identidade/contradição de
`reduce_to_value`, sem código duplicado.

## O que foi implementado

1. Backend: `math_engine/steps/{__init__,models,validation,formatting,linear_equations,
   linear_systems,dispatcher}.py`.
2. `equations/dispatcher.py`: `split_equations` (promovida a pública) + `split_equation_sides`
   (nova).
3. `execution.py`: `generate_steps_with_timeout` (isolamento por processo, mesmo padrão de
   `solve_expression_with_timeout`).
4. `main.py`/`schemas.py`: rota `POST /solve/steps` + `StepItem`/`StepsRequest`/`StepsResponse`.
5. Frontend: `components/steps/MathSteps.tsx` (botão "Ver passo a passo"/"Ocultar passo a
   passo", fechado por padrão, cache em `Map` por expressão — fechar/reabrir para o mesmo
   resultado nunca refaz a requisição, mesmo em erro) + `MathStepItem.tsx` (KaTeX via
   `valueToLatex`, já existente — reconhece sistema via `\n` → `\begin{cases}` e lista
   `"x=3, y=2"` automaticamente, zero renderer novo). Substituiu o botão desabilitado "Ver
   explicação (em breve)" em `ResultPanel.tsx`.
6. `lib/api/{types,client}.ts`: `StepItem`/`StepsResponse` + `apiClient.solveSteps()`.

## Exemplos validados

| Entrada | Passos |
| --- | --- |
| `2*x+4=10` | `2*x + 4=10` → `2*x=6` → `x=3` |
| `3x-7=2x+5` | `2*x + 4=10`… → `x - 7=5` → `x=12` |
| `(x/3)+2=5` | `x/3=3` → `x=9` |
| `2x+1=2x+3` | `1=3` — "a equação não tem solução" |
| `2x+1=2x+1` | `1=1` — "infinitas soluções" |
| `x+y=5` / `x-y=1` | soma direta `2*x=6` → `x=3` → `y+3=5` → `y=2` → `"x=3, y=2"` |
| `2x+3y=13` / `x+2y=8` | multiplica por `2`/`-3` → `x=2` → `y=3` |
| `x+y+z=6` / `x-y=0` / `y-z=1` | 400 — "mais de duas incógnitas" (motor atual resolve normalmente, sem passo a passo) |

Validado também interativamente no navegador (backend `uvicorn` + frontend `next dev` reais):
KaTeX renderiza `\begin{cases}` no sistema, resultado principal nunca é bloqueado pelo passo a
passo, erro (equação não linear) aparece de forma amigável sem quebrar a tela.

## Resultados dos testes

- `pytest` (backend): **1039 passed** (954 pré-existentes + 85 novos: `test_steps_linear_
  equations.py`, `test_steps_linear_systems.py`, `test_api_steps.py`), 0 falhas.
- `vitest` (frontend): **885 passed** na suíte cheia rodada em partes/isolada; a suíte completa
  em paralelo total mostrou 2-5 timeouts flaky em arquivos **não tocados** por esta sprint
  (`GraphCanvas`, `FormulasReference`, `CalculatorWorkspace`, `to-latex`) — confirmado como
  contenção de recursos da máquina sob paralelismo (arquivos diferentes falham a cada execução),
  não regressão: todos passam 100% quando rodados isolados ou em grupos menores.
- `tsc --noEmit`: limpo. `eslint`: limpo (1 violação de `react-hooks/set-state-in-effect`
  encontrada e corrigida em `MathStepItem.tsx` durante o desenvolvimento — `setState` só dentro
  do callback assíncrono, nunca síncrono no corpo do efeito, mesmo padrão "chave" já usado em
  `useSolveLatex.ts`). `next build`: sucesso (15/15 páginas).
- Smoke: `TestClient` + `uvicorn` real cobrindo `/solve/steps` e regressão de `/solve`; validação
  visual real no navegador (equação linear, sistema 2×2, equação não linear rejeitada).

## Bug real encontrado durante o desenvolvimento

`Expr.as_independent(symbol)` sem `as_Add=True` explícito faz split MULTIPLICATIVO por padrão
para qualquer expressão que não seja um `Add` no topo — `(-2*x).as_independent(x)` devolve
`(-2, x)`, não `(0, -2*x)`; `Integer(10).as_independent(x)` devolve `(10, 1)`, não `(10, 0)`.
Sem o `as_Add=True` explícito, isso gerava passos fantasma ("Subtraindo 1 dos dois lados") em
toda equação sem termo constante do lado errado — pego empiricamente rodando os quatro exemplos
do escopo antes de escrever os testes automatizados, não pela suíte (que ainda não existia).
Corrigido nas duas chamadas de `as_independent` em `reduce_to_value`.

## Limitações conhecidas

- Só equações lineares de 1 incógnita e sistemas 2×2 lineares com coeficientes racionais.
  Sistemas 3×3+ devolvem mensagem amigável ("mais de duas incógnitas"); o motor atual continua
  resolvendo-os normalmente via `/solve`, só sem passo a passo.
- Identidade/contradição em equações de uma incógnita ("2x+1=2x+3") são suportadas pelo passo a
  passo, mas o `/solve` ATUAL falha para o mesmo caso com "não foi possível interpretar a
  equação" (bug pré-existente, `Eq()` do SymPy resolve para `BooleanFalse` direto no parse —
  fora de escopo desta sprint corrigir, documentado para referência futura).
- Quadráticas, sistemas não lineares, matrizes, cálculo, combinatória, probabilidade,
  trigonometria — fora de escopo por design, erro amigável explícito, nunca "fingido".
- Não salva os passos no histórico (por decisão de escopo) — histórico continua só com
  expressão/resultado, como antes.

## Estado atual

Commit `628d7e9` ("feat(steps): add deterministic step-by-step infrastructure (Sprint V2.9)"),
pushed `137b09e..628d7e9`. Autorização explícita do Theo ("commit isso e de push").

## Objetivo da próxima sprint

Não definido ainda pelo Theo. Candidatos naturais a partir da limitação documentada acima:
corrigir o bug pré-existente de identidade/contradição no `/solve` atual (aproveitando o parser
`split_equation_sides` já construído nesta sprint), ou expandir o passo a passo para equações
quadráticas.
