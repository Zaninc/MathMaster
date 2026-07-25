# Session Log — 2026-07-25 — Sprint V2.3: Motor de Números Complexos

## Escopo

Suporte completo a números complexos no MathMaster — unidade imaginária (`i`/`I`), forma
retangular (`2+i`, `3-4i`, `-5+2i`), operações (soma, subtração, multiplicação, divisão,
potência inteira, parênteses), funções (`conjugado`/`conj`, `modulo`/`abs`, `argumento`/`arg`,
`polar`, com aliases PT-BR/EN), renderização KaTeX completa (preview, resultado, histórico,
exemplos, biblioteca de fórmulas), tecla dedicada no teclado matemático, exemplos, exploração
contextual (`isComplex()`) e categoria própria ("Números Complexos") na Biblioteca de Fórmulas.
Contrato do `/solve` intocado (`{expression, result, approx}`). Por decisão explícita de
arquitetura (revisão pré-sprint), `polar(...)` produz uma expressão SIMBÓLICA
`r*(cos(θ)+i*sin(θ))` via SymPy — nunca uma string improvisada — preparando o motor para formas
futuras (exponencial `re^{iθ}`, raízes n-ésimas, De Moivre) sem refatoração.

## Arquitetura

**`backend/app/math_engine/complex/`** — pacote novo, seguindo o mesmo padrão de `matrix/`/
`summation/`, mas deliberadamente mais leve: a aritmética geral (+, -, \*, /, ^) sobre números
complexos já é exatamente o que `safe_parse_expr`/SymPy resolvem nativamente assim que "i"
resolve para `sympy.I` — confirmado empiricamente durante o planejamento, então nenhuma árvore
sintática própria foi criada para isso (diferente de `matrix/`, que precisa de uma porque
`sympy.Matrix` tem semântica de tipo própria).

- `parsing.py` — tabela de nomes canônicos + aliases (`CANONICAL_FUNCTION_NAMES`), detecção de
  chamada conhecida em qualquer posição (`contains_complex_call`, mesmo critério `.search()` de
  `matrix/dispatcher.py`), e extração estrutural do argumento de `polar(...)` por
  bracket-matching (`extract_whole_polar_argument` — só aceita quando `polar(...)` é a
  expressão INTEIRA).
- `evaluator.py` — um único `local_dict` ensina o parser o que "i" e as três funções compostas
  (`conjugate`/`modulus`/`argument`, canônicas + aliases) significam; reaproveita
  `safe_parse_expr`/`extract_safe_symbols`/`log_convention.LOCAL_DICT`, mesma infraestrutura
  segura de sempre. `expand()` (não `algebra.dispatcher.solve_algebra`, que tenta `factor()`
  primeiro) é a normalização final — `factor()` sobre um produto de dois complexos concretos
  como `(2+i)*(3-i)` não expande (não há fator comum), devolvendo a forma NÃO avaliada em vez
  de `7 + i` (confirmado empiricamente).
- `validation.py` — só a validação que faz sentido sobre um complexo JÁ avaliado:
  `arg(0)`/`polar(0)` não são definidos (SymPy devolve `nan` silenciosamente); rejeitado
  explicitamente antes.
- `dispatcher.py` — `is_complex_domain_expression` reconhece (1) uma chamada às quatro funções
  em qualquer posição, OU (2) a unidade imaginária como token isolado (`i`/`I`) — em AMBOS os
  casos, NUNCA quando a expressão contém `"="` (preserva 100% do comportamento já existente
  para equações/definições de função, ex. `"abs(x) = 5"`). `solve_complex_text` trata
  `polar(...)` como caso especial: gera a string final manualmente (nunca via `str()` de uma
  árvore SymPy composta) — ver "Decisão arquitetural crítica" abaixo.

**Posição na cascata** (`math_engine/dispatcher.py`): `analytic_geometry` → `summation` →
`matrix` → **`complex`** → `calculus` → `functions` → `trigonometry` → `logarithms` →
`equations` → `algebra` — mesma posição/motivo de `matrix`/`summation` (o argumento de
`conjugado(...)`/`modulo(...)`/etc. pode conter livremente `sin(`/`log(` que essas áreas
roubariam por `.search()` livre).

### Decisão arquitetural crítica: "i" minúsculo é reservado só DENTRO desta área

`"I"` maiúsculo já era globalmente reservado como unidade imaginária desde o Hardening III
(`safe_parsing._ALLOWED_CONSTANTS`), em TODAS as áreas do motor — confirmado empiricamente que
`solve_expression("2+I")` já produzia `"2 + i"` ANTES desta sprint. O gap real era só a grafia
minúscula convencional (`"2+i"`, não `"2+I"`). A extensão foi feita **só dentro do
`local_dict` de `complex/evaluator.py`**, deliberadamente NUNCA em `safe_parsing.py`/
`parser/normalize.py` (que afetariam TODAS as áreas incondicionalmente) — porque `"i"` já é, em
todo o produto, o nome de variável de laço de somatório por convenção (`"Σ(i=1..10) i"`,
presente em `data/examples.ts`/`data/keyboard.ts`/toda a suíte de somatório). As duas
convenções nunca colidem: `is_summation_domain_expression` decide PRIMEIRO na cascata, por
prefixo — um cabeçalho de somatório nunca chega até `complex/`. Confirmado por teste dedicado
(`test_summation_loop_variable_i_is_unaffected`, `test_summation_body_using_i_is_unaffected`).

**Bug real encontrado e corrigido durante o desenvolvimento**: a primeira versão da detecção
usava `\b[iI]\b` (fronteira de palavra clássica), que falha silenciosamente para "i" colado a
um dígito (`"4i"`, `"3-4i"`) — dígito TAMBÉM é caractere de palavra para `\b` do regex, então
não há fronteira entre "4" e "i". Corrigido com lookaround explícito
(`(?<![A-Za-z_])[iI](?![A-Za-z_])`) que permite dígito à esquerda de propósito, mas continua
excluindo "i" quando faz parte de um identificador maior (`"circunferencia"`,
`"trigonometria"`). Coberto por teste de regressão tanto no backend quanto no frontend
(`test_i_glued_to_a_digit_is_still_recognized`).

### Decisão arquitetural crítica: `polar(...)` sobrevive ao pipeline de apresentação

`app/formatter/pipeline.py` resympifica qualquer resultado classificado como "expressão pura"
(`is_pure_expression_shape`) — se `polar(1+i)` devolvesse a string `"sqrt(2)*(cos(pi/4)+I*sin(pi/4))"`
crua, essa resympificação reavaliaria `cos(pi/4)` de volta a `sqrt(2)/2`, destruindo a forma
polar (confirmado empiricamente durante o planejamento). `_render_polar` monta a string final
manualmente com um separador `"·"` deliberado entre `"i"` e `"sin(...)"` — nenhum caractere do
whitelist de `_PURE_EXPRESSION_PATTERN` inclui `"·"`, então a string nunca é classificada como
"expressão pura", passa INTOCADA por `format_result` e só recebe o polimento cosmético
incondicional de `unicode_math.render_math` (sqrt→√, pi→π, I→i) — resultado típico:
`"√2(cos(π/4)+i·sin(π/4))"`.

**Frontend — mesmo problema, resolvido separadamente**: essa mesma string (com "·" e
justaposição "r(" sem "\*") quebra o parser do mathjs, então `resultToLatex`/`valueToLatex`
(usados para o RESULTADO, fail-closed, sem fallback Tier 2) devolveriam `null` e o card mostraria
texto cru — violando "nunca mostrar texto cru se puder ser renderizado em KaTeX". Resolvido com
um reconhecedor estrutural dedicado (`parsePolarForm`/`polarFormToLatex` em `lib/math/to-latex.ts`),
classify-first: extrai r/θ por bracket-matching e só aceita quando a reconstrução byte-a-byte
bate com o texto original (nunca "adivinha").

## O que foi implementado

1. Backend: `complex/{__init__,parsing,validation,evaluator,dispatcher}.py` + integração na
   cascata raiz (`math_engine/dispatcher.py`).
2. Frontend KaTeX (`lib/math/to-latex.ts`): o mathjs já reconhece "i" nativamente como unidade
   imaginária (nenhum código extra necessário); `COMPLEX_ALIAS_LATEX` para os aliases PT-BR/EN
   de função (`\overline{}`, `|...|`, `\arg(...)`) no Tier 1 (`productHandler`) e no Tier 2
   (preview durante digitação); reconhecedor estrutural dedicado para o resultado em forma
   polar.
3. Teclado (`data/keyboard.ts`): nova tecla "i" na aba Símbolos, ao lado de π/e/∞.
4. Exemplos (`data/examples.ts`): 6 novos — `3+4i`, `(2+i)(3-i)`, `conjugado(3+4i)`,
   `modulo(3+4i)`, `argumento(1+i)`, `polar(1+i)`.
5. Exploração (`data/connections.ts`): `isComplex()` + branch em `getCalculatorExplorations`
   (posicionado logo depois de `isMatrix`, mesma posição do backend) — "Ver fórmulas
   relacionadas", "Exercícios semelhantes".
6. Biblioteca de Fórmulas (`data/formulas.ts`): categoria nova `numeros-complexos` ("Números
   Complexos") com 6 fórmulas (definição, conjugado, módulo, argumento, forma polar, fórmula de
   Euler) — 100% data-driven, `FormulasReference.tsx` não precisou de nenhuma mudança.

## Validação

| Item | Resultado |
| --- | --- |
| `pytest` (backend, suíte completa) | 844 passed (55 novos em `test_complex.py`) |
| `npm run test` (frontend, suíte completa) | 660 passed (73 arquivos) |
| `npm run lint` (eslint) | limpo |
| `npm run build` (inclui `tsc` via Next.js) | build de produção ok, todas as rotas geradas |
| Smoke test (via `TestClient`/`/solve`, `test_solve_endpoint_*`) | `3+4i` → `3 + 4*i`; `conjugado(3+4i)` → `3 - 4*i`; `polar(1+i)` → `√2(cos(π/4)+i·sin(π/4))` |
| Validação desktop/mobile no navegador | **não realizada** — extensão Claude in Chrome não conectada nesta sessão (mesma limitação já registrada nas sprints V2.1/V2.2) |

## Decisões arquiteturais tomadas

- **`expand()` em vez de `solve_algebra`** para a normalização final de aritmética complexa —
  ver seção de arquitetura acima (evita a forma não-expandida que `factor()` produziria).
- **"i" minúsculo reservado só dentro de `complex/`**, nunca globalmente — ver "Decisão
  arquitetural crítica" acima.
- **`polar(...)` só como expressão INTEIRA** — `"2*polar(1+i)"`/`"polar(1+i)+1"` são
  rejeitados explicitamente com mensagem clara, em vez de tentar compor uma string de
  apresentação com outras operações (não teria uma interpretação matemática única/óbvia).
- **`conjugate`/`modulus`/`argument` são funções SymPy comuns no `local_dict`** (não uma árvore
  própria) — chamadas isoladas ou compostas (`"modulo(3+4i) + 1"`, `"2*conjugado(1+i)"`) são só
  sintaxe de chamada de função normal, sem caso especial.
- **"=" nunca é reivindicado por esta área** (nem pelo critério de chamada de função, nem pelo
  de token isolado) — preserva 100% do comportamento já existente para qualquer texto em forma
  de equação/definição de função.

## Limitações conhecidas

- Equações envolvendo módulo/argumento/conjugado de um complexo DESCONHECIDO (ex. resolver
  `"modulo(x) = 5"` para x) estão fora do escopo desta sprint — comportamento idêntico ao que já
  existia antes dela (nenhuma mudança, `"="` nunca é reivindicado por `complex/`).
- `polar(...)` não compõe com outras operações (`"2*polar(z)"` é rejeitado) — decisão de
  arquitetura explícita, não uma limitação técnica; a forma polar é uma expressão de
  apresentação, não um valor genérico.
- Raízes n-ésimas, forma exponencial (`re^{iθ}`) e fórmula de De Moivre não foram implementadas
  nesta sprint — mas a decisão de `polar(...)` produzir uma expressão SIMBÓLICA (não uma string)
  prepara o terreno para essas extensões sem refatoração futura (pedido explícito do Theo,
  revisão de arquitetura pré-sprint).
- Validação visual no navegador real não foi feita nesta sessão (extensão desconectada) — a
  cobertura vem de 55 testes de backend (incl. 3 contra o `/solve` real via `TestClient`) + 44
  novos testes de frontend (`keyboard.test.ts`, `connections.test.ts`, `to-latex.test.ts`).

## Objetivo da próxima sprint

Conforme o roadmap (`[[mathmaster-roadmap-and-architecture]]`), parser inteligente e
explicações determinísticas seguem como próximos itens da Fase 1; extensões naturais do Motor
de Números Complexos (forma exponencial, raízes n-ésimas, De Moivre) ficam disponíveis como
trabalho futuro de baixo custo, dado o design simbólico já preparado nesta sprint.
