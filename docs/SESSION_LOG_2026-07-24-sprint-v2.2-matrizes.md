# Session Log — 2026-07-24 — Sprint V2.2: Motor de Matrizes

## Escopo

Suporte completo a matrizes no MathMaster — literal `[[1,2],[3,4]]`, operações (soma,
subtração, multiplicação, escalar, potência inteira), funções (determinante, inversa,
transposta, traço) com aliases PT-BR, renderização KaTeX completa (preview + resultado),
tecla dedicada no teclado matemático, exemplos, exploração contextual e categoria própria na
Biblioteca de Fórmulas. Contrato do `/solve` intocado (`{expression, result, approx}`).
Autovalores/autovetores/diagonalização/Jordan/decomposições ficam fora desta sprint por
decisão explícita do escopo.

## Arquitetura

**`backend/app/math_engine/matrix/`** — pacote novo, seguindo exatamente o padrão de
`summation/` (mesma sprint anterior, V2.1):

- `parsing.py` — parser de descida recursiva com precedência (`^` > `*` > `+`/`-`), bracket-
  counting puro (nunca regex sobre o CONTEÚDO da matriz, conforme pedido). Produz uma árvore
  `MatrixNode` (`MatrixLiteralNode` / `ScalarNode` / `MatrixCallNode` / `MatrixBinaryOpNode`)
  em vez de casar só os padrões dos exemplos — "[[1,2],[3,4]] + [[5,6],[7,8]] * 2" já funciona
  de graça. Row-length e matriz vazia validadas aqui (é estrutura sintática, não semântica de
  matriz avaliada).
- `validation.py` — validações sobre matrizes JÁ AVALIADAS: dimensões compatíveis (soma/
  subtração/multiplicação), quadrada (det/trace/potência), inversível (det ≠ 0), expoente
  inteiro não-negativo com teto (`MAX_MATRIX_POWER=100`). Teto de dimensão
  (`MAX_DIMENSION=20`) — mesmo espírito de `summation/validation.py:MAX_TERMS`.
- `evaluator.py` — cada nó vira `sympy.Matrix` ou `sympy.Expr` escalar; o operador decide a
  semântica pelo tipo runtime do operando (`isinstance(..., MatrixBase)`), igual ao Python
  decidindo `__add__` por tipo. Reaproveita `safe_parse_expr`/`extract_safe_symbols`/
  `log_convention.LOCAL_DICT` por célula — mesma infraestrutura seguro de sempre.
- `dispatcher.py` — `is_matrix_domain_expression` reconhece "[[" (marcador léxico inequívoco;
  o único outro uso de colchete, listas de pontos em `analytic_geometry`, é sempre simples) OU
  uma chamada de função de matriz **em qualquer posição** do texto (mesmo critério de
  `.search()` de trigonometry/logarithms — necessário porque "2 \* [[...]]" não começa com
  "[[").

**Posição na cascata** (`math_engine/dispatcher.py`): `analytic_geometry` → `summation` →
**`matrix`** → `calculus` → `functions` → `trigonometry` → `logarithms` → `equations` →
`algebra`, exatamente como pedido.

**Frontend — nenhum parser novo**: o mathjs (já dependência do projeto) entende nativamente
`[[1,2],[3,4]]` como matriz e já sabe renderizar `det`/`inv`/`transpose`/`trace` com notação
bonita própria (`\det(...)`, `^{-1}`, `^\top`, `\mathrm{tr}(...)`) — só os aliases PT-BR
puramente ASCII (`determinante`/`inversa`/`transposta`) precisaram de um caso no
`productHandler` de `lib/math/to-latex.ts`; `traço` (com "ç") é reescrito para `trace(` em
`transliterate()` antes da whitelist de caracteres do Tier 1.

## Bug real encontrado e corrigido durante a implementação

`valueToLatex` (usado para o RESULTADO, não a expressão) tinha um `pairToLatex` que casa
`"[...]"` com exatamente duas partes separadas por vírgula de nível mais alto, interpretando
como tupla/intervalo. Uma matriz de **exatamente duas linhas** ("[[1,2],[3,4]]") colidia com
essa forma (duas partes: "[1,2]" e "[3,4]") e virava "(vetor, vetor)" em vez de uma matriz 2x2
de verdade. Corrigido com um guard `"[[".startsWith` ANTES de `pairToLatex`, coberto por um
teste de regressão dedicado.

## O que foi implementado

1. Backend: `matrix/{__init__,parsing,validation,evaluator,dispatcher}.py` + integração na
   cascata raiz (`math_engine/dispatcher.py`).
2. Frontend KaTeX: `lib/math/to-latex.ts` — matriz nativa via mathjs, aliases PT-BR, correção
   do guard contra colisão com `pairToLatex`, ampliação pontual do alfabeto seguro só para o
   caso "traço(".
3. Teclado (`data/keyboard.ts`): nova tecla na aba Álgebra, insere `[[,],[,]]` com cursor no
   primeiro elemento.
4. Exemplos (`data/examples.ts`): 5 novos — literal, `det`, `inv`, `transpose`, multiplicação.
5. Exploração (`data/connections.ts`): `isMatrix()` + branch em `getCalculatorExplorations` —
   "Ver propriedades" (só para literal puro, dinamicamente monta `det(...)` sobre a matriz
   digitada — bracket-matching real, não `startsWith`/`endsWith`, para não disparar sobre
   "[[1,2],[3,4]] + [[5,6],[7,8]]"), "Ver fórmulas relacionadas", "Exercícios semelhantes".
6. Biblioteca de Fórmulas (`data/formulas.ts`): categoria nova `algebra-linear` ("Álgebra
   Linear") com 6 fórmulas (multiplicação, determinante 2x2, inversa 2x2, transposta, matriz
   identidade, traço) — 100% data-driven, `FormulasReference.tsx` não precisou de nenhuma
   mudança (filtro de categoria já itera sobre os dados).

## Validação

| Item | Resultado |
| --- | --- |
| `pytest` (backend, suíte completa) | 741 passed (71 novos em `test_matrix.py`) |
| `npm run test` (frontend, suíte completa) | 613 passed (72 arquivos) |
| `tsc --noEmit` | limpo |
| `npm run lint` (eslint) | limpo |
| `npm run build` | build de produção ok, todas as rotas geradas |
| Smoke test (servidores reais, não só TestClient) | `curl /solve` com `[[1,2],[3,4]]*[[5,6],[7,8]]` → `[[19, 22], [43, 50]]`; `det(...)` → `-2`; `inv([[1,2],[2,4]])` (singular) → 400 com mensagem clara |
| Validação desktop/mobile no navegador | **não realizada** — extensão Claude in Chrome não conectada nesta sessão (ver limitações) |

## Decisões arquiteturais tomadas

- **Sem menos unário / sem "/" no nível top da gramática de matriz** — os exemplos da sprint
  nunca precisam disso; `validate_power_exponent` já rejeita expoente negativo com mensagem
  própria, preparado para uma futura extensão de sintaxe (testado diretamente, já que hoje é
  inalcançável pelo parser).
- **Regex permitido só para detecção de domínio** (`is_matrix_domain_expression`,
  `isMatrix()` no frontend) — nunca para interpretar o CONTEÚDO da matriz, que é 100%
  bracket-counting manual, conforme pedido.
- **"Ver propriedades" só para literal puro**: uma expressão como `det([[1,2],[3,4]])` já não
  ganha essa ação (comporia `det(det(...))`, sem sentido) — mesma filosofia já documentada em
  `connections.ts` ("melhor omitir do que uma ação errada").
- **Preparação para nomes de matriz** (evolução futura, não implementada): o parser já produz
  uma árvore de expressão genérica em vez de casar só os padrões de hoje — o ponto de extensão
  exato (`_parse_primary`, onde um identificador vira `ScalarNode`) está marcado no docstring
  de `parsing.py`.

## Limitações conhecidas

- Números decimais em célula de matriz (ex. `[[1.5, 2],[3,4]]`) não são suportados — nenhuma
  área do motor aceita ponto decimal hoje (`safe_parsing.py`, decisão pré-existente à sprint);
  racionais (`1/2`) funcionam normalmente.
- Potência negativa de matriz não tem sintaxe de entrada (sem menos unário); use `inv(...)`
  para a inversa.
- Validação visual no navegador real não foi feita nesta sessão (extensão desconectada) — a
  cobertura vem de 71 testes de backend (incl. 4 contra o servidor `/solve` real via
  `TestClient`) + testes de componente do frontend (JSDOM, incl. asserções sobre os nós
  `annotation` do MathML gerado pelo KaTeX) + smoke test via `curl` contra o backend real
  rodando localmente.
- `ARCHITECTURE.md` já estava desatualizado antes desta sprint (não documenta a cascata de
  domínios nem a Sprint V2.1/Somatórios) — não foi tocado aqui para não misturar um
  backfill de documentação alheio a esta sprint com o escopo pedido.
