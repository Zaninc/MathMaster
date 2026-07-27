# SESSION LOG — 2026-07-27 — Sprint V2.7: Motor de Combinatória

## Escopo

Novo domínio matemático dedicado à Combinatória (`math_engine/combinatorics/`), com operações
exatas (SymPy, nunca aproximações): fatorial, permutação simples, arranjo, combinação e
permutação com repetição. Integração completa ao pipeline existente (cascata do dispatcher,
formatter global, KaTeX no frontend, teclado, exemplos, Biblioteca de Fórmulas, bloco Explorar).
Nenhum comportamento existente alterado (álgebra, polinômios, equações, sistemas, matrizes,
cálculo, trigonometria, geometria, complexos — regressão completa verificada). Contrato do
`/solve` intocado.

Fora de escopo (reservado para a V2.8): probabilidade, distribuição binomial, triângulo de
Pascal, princípio multiplicativo.

## Arquitetura

Mesmo padrão modular de `polynomials/` (V2.6) — chamada nomeada explícita, ancorada nas duas
pontas, nunca "adivinhada" no meio de uma expressão:

- `parsing.py` — `CANONICAL_OPERATIONS` (tabela literal de aliases, incl. formas acentuadas:
  `permutação`, `combinação`, `permutação_repetição` e variantes mistas — o acento é consumido
  pelo regex ancorado ANTES do parse, porque `parser/normalize.py` não remove acentos e a
  whitelist de `safe_parsing.py` rejeita `ç`/`ã`), `match_combinatorics_call` (alternativas mais
  longas primeiro), `split_top_level_args` (cópia deliberada, área self-contained),
  `parse_combinatorics_fragment` (reaproveita `safe_parse_expr`/`extract_safe_symbols`).
- `validation.py` — só validação semântica pós-parse: `as_nonnegative_int` (inteiros ≥ 0, com
  mensagens distintas para decimal/simbólico/negativo), `reject_decimal_literal` (mensagem
  amigável para "2.5" ANTES do parse — a whitelist global nem aceita o caractere "."),
  `require_k_at_most_n`, `require_repetitions_fit` (soma das repetições ≤ n).
- `evaluator.py` — só matemática: `factorial`/`binomial` do SymPy, aritmética inteira exata.
- `formatter.py` — identidade visual de livro didático: toda operação devolve a DEDUÇÃO
  simbólica como cadeia de igualdades em texto puro (`C(10,3) = 10!/(3!*7!) = 120`). Contrato
  verificado nas duas pontas: o `app/formatter/` global deixa a cadeia intacta (a cabeça
  "C(10,3)" não casa com nenhum padrão de `classify.py`) e o `to-latex.ts` divide por "=" e
  renderiza cada pedaço (mathjs entende `10!/(3!*7!)` nativamente). Separador de produto é
  SEMPRE `*` (nunca `·`, que derruba o parser do mathjs) e a cadeia nunca contém `;`/`|`.
- `dispatcher.py` — roteia as 5 operações; entra na cascata raiz logo depois de `polynomials`.

Decisão de design: os aliases de livro didático `C(n,k)`/`A(n,k)`/`P(n)` (maiúsculos) também são
aceitos como entrada — são exatamente as cabeças que o formatter devolve na dedução, então
qualquer pedaço do resultado pode ser digitado de volta (round-trip). Antes da V2.7 as três
formas eram erro de interpretação (verificado empiricamente), portanto zero mudança de
comportamento existente. Minúsculas (`a(1,2)`) ficam de fora de propósito (álgebra livre).
`permutacao_repeticao` devolve só a fração (`8!/(3!*2!*2!) = 1680`), sem cabeça: não existe
notação de texto puro consagrada que sobreviva ao contrato acima (qualquer separador candidato
colide com o split de segmentos rotulados ou com a reescrita de módulo).

"5!"/"factorial(5)" soltos continuam na álgebra (fallback), byte a byte como antes.

## O que foi implementado

1. Backend: `combinatorics/{__init__,parsing,validation,evaluator,formatter,dispatcher}.py` +
   integração na cascata raiz (`math_engine/dispatcher.py`, logo após polynomials).
2. Frontend KaTeX (`lib/math/to-latex.ts`): `COMBINATORICS_LATEX` no Tier 1 — notação dedicada
   dependente da POSIÇÃO dos argumentos (`C_{10,3}`, `A_{8,3}`, `P_{5}`, `6!`,
   `P_{8}^{3,2,2}`), aridade errada cai fail-closed no fallback genérico; fatorial parentesiza
   argumento composto (`(x+1)!`); `C`/`A`/`P` restritos a argumentos numéricos (`ConstantNode`)
   para nunca reinterpretar uma variável de matriz. Tier 2 (preview tolerante): entradas
   paralelas para as grafias acentuadas e digitação incompleta.
3. Teclado (`data/keyboard.ts`): aba nova "Combinatória" (entre Geometria e Símbolos) com 5
   teclas — labels em KaTeX (`n!`, `P_{n}`, `A_{n,k}`, `C_{n,k}`, `P_{n}^{a,b}`), inserção
   sempre ASCII com cursor dentro dos parênteses.
4. Exemplos (`data/examples.ts`): 4 na Calculadora (`fatorial(6)`, `combinacao(10,3)`,
   `arranjo(8,3)`, `permutacao(6)` — lista exata do escopo, 15 → 19) e 1 na Home
   (`combinacao(10,3)` substituindo `inv([[2,0],[0,2]])`, mesmo racional da V2.6).
5. Biblioteca de Fórmulas (`data/formulas.ts`): categoria nova "combinatoria" com 5 fórmulas
   (Fatorial, Permutação simples, Arranjo simples, Combinação simples, Permutação com
   repetição), aparece por último na página.
6. Explorar (`data/connections.ts`): `isCombinatoricsOperation()` (nomes completos em qualquer
   posição; `C`/`A`/`P` só ancorados e em maiúscula, espelho do backend) + bloco na cascata logo
   após polynomials — "Ver fórmulas relacionadas" → categoria `combinatoria` (destino válido) e
   "Exercícios semelhantes" → `algebra-basica` (tópico seedado, mesma escolha da V2.6).

## Sintaxes aceitas

| Operação | Forma principal | Aliases |
| --- | --- | --- |
| Fatorial | `fatorial(n)` | `fat(n)` |
| Permutação simples | `permutacao(n)` | `permutação(n)`, `P(n)` |
| Arranjo | `arranjo(n,k)` | `A(n,k)` |
| Combinação | `combinacao(n,k)` | `combinação(n,k)`, `C(n,k)` |
| Permutação c/ repetição | `permutacao_repeticao(n,a,b,...)` | `permutação_repetição(...)` e variantes mistas |

Validação: apenas inteiros ≥ 0; `k ≤ n` (arranjo/combinação); soma das repetições ≤ n;
mensagens amigáveis dedicadas para negativos, decimais, argumento simbólico, `k > n` e contagem
errada de argumentos — cada uma vira literalmente o `detail` do HTTP 400.

## Exemplos validados (contra o `/solve` real — `TestClient` + `uvicorn`/HTTP)

| Entrada | Saída |
| --- | --- |
| `fatorial(0)` | `0! = 1` |
| `fat(5)` | `5! = 120` |
| `fatorial(6)` | `6! = 720` |
| `permutacao(6)` | `P(6) = 6! = 720` |
| `arranjo(8,3)` | `A(8,3) = 8!/(8-3)! = 8!/5! = 336` |
| `combinacao(10,3)` | `C(10,3) = 10!/(3!*7!) = 120` |
| `combinacao(20,10)` | `C(20,10) = 20!/(10!*10!) = 184756` |
| `permutacao_repeticao(8,3,2,2)` | `8!/(3!*2!*2!) = 1680` |
| `C(10,3)` | `C(10,3) = 10!/(3!*7!) = 120` |
| `combinacao(3,5)` | 400 — "combinação(...) exige k ≤ n — recebido k = 5 maior que n = 3. …" |
| `fatorial(-1)` | 400 — "…não está definida para números negativos…" |
| `fatorial(2.5)` | 400 — "…só está definida para números inteiros…" |
| `5!` (regressão) | `120` (álgebra, intocado) |
| `fatorar(x²-9)` (regressão) | `(x - 3)(x + 3)` |

No frontend, `resultToLatex` renderiza a cadeia como linha única de livro didático:
`C_{10,3} = \frac{10!}{3!\cdot 7!} = 120` (coberto por teste com `throwOnError: true`).

## Resultados dos testes

- `pytest` (backend): **960 passed** (914 da V2.6 + 46 novos em
  `tests/math_engine/test_combinatorics.py`), 0 falhas.
- `vitest` (frontend): **827 testes / 824 passed na suíte cheia** — as 3 falhas são os timeouts
  de 5 s conhecidos do primeiro `import("mathjs")` frio nesta máquina (pré-existentes, já
  registrados no log da V2.6); os 3 arquivos passam 53/53 rodados em isolamento. 24 testes
  novos da V2.7 (to-latex 15, keyboard 4, connections 7, headings de fórmulas atualizados).
- `tsc --noEmit`: limpo. `eslint`: limpo. `next build`: sucesso (15/15 páginas).
- Smoke: contrato `/solve` completo via `TestClient` e via `uvicorn` real (18 casos, incl.
  erros 400 e histórico); frontend `next start` servindo os chunks com todo o conteúdo novo
  (aba do teclado, exemplos, fórmulas, notação KaTeX) confirmado por HTTP.

## Limitações conhecidas

- Validação visual interativa no navegador real não foi possível nesta sessão — extensão
  Claude in Chrome não conectada (mesma limitação registrada na V2.6). Validado por
  alternativa equivalente: servidores reais locais + chamadas HTTP diretas + verificação do
  conteúdo novo nos chunks servidos.
- Não há limite superior próprio para `n` além do timeout global de 5 s do subprocesso:
  `fatorial(50000)` calcula (resultado exato com dezenas de milhares de dígitos);
  valores realmente patológicos caem no timeout com a mensagem genérica de tempo excedido.
- `C₅,₂` (subscrito Unicode) não é aceito como entrada — subscritos não são tratados pelo
  normalizador (só sobrescritos) e estão fora da whitelist de caracteres; o caminho digitável é
  `C(5,2)`/`combinacao(5,2)`, e a notação bonita fica por conta do preview KaTeX.
- O preview do input mostra `P_{8}^{3,2,2}` para `permutacao_repeticao(...)`, mas o RESULTADO
  dessa operação vem sem cabeça (só a fração) — decisão documentada em
  `combinatorics/formatter.py`.
- Tópico de exercícios específico de combinatória ainda não existe em `/aprendizado` (não
  seedado); "Exercícios semelhantes" aponta para `algebra-basica`, como na V2.6.

## Objetivo da próxima sprint

V2.8, conforme o escopo desta sprint: probabilidade, distribuição binomial, triângulo de
Pascal e princípio multiplicativo — a base exata de fatoriais/combinações desta área já cobre
os denominadores/coeficientes necessários.
