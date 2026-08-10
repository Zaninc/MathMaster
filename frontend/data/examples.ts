export interface QuickExample {
  label: string;
  expression: string;
}

/**
 * Os 6 exemplos pedidos no briefing da Sprint Frontend V1 — todos
 * confirmados contra o backend real (smoke test manual, Etapa 1).
 *
 * Consumida hoje só pela Home (`components/home/QuickCalculator.tsx`) —
 * a Calculadora (`components/calculator/CalculatorWorkspace.tsx`) usa
 * `CALCULATOR_QUICK_EXAMPLES` (abaixo) desde a simplificação pós-Sprint
 * V2.3. Separadas deliberadamente: a Home pede para não mexer nos
 * exemplos das "outras páginas" ao ajustar só a vitrine da Calculadora.
 */
export const QUICK_EXAMPLES: QuickExample[] = [
  { label: "x² - 4 = 0", expression: "x² - 4 = 0" },
  { label: "sen(π/6)", expression: "sen(π/6)" },
  { label: "d/dx(x² + 3x)", expression: "d/dx(x² + 3x)" },
  { label: "∫₀¹ x² dx", expression: "∫₀¹ x² dx" },
  { label: "lim x→0 sen(x)/x", expression: "lim x→0 sen(x)/x" },
  { label: "circunferencia((0,0),5)", expression: "circunferencia((0,0),5)" },
  // Sprint V2.1 — somatório finito, sintaxe principal Σ(var=inf..sup) expr.
  { label: "Σ(i=1..10) i", expression: "Σ(i=1..10) i" },
  // Sprint V2.2 — Motor de Matrizes.
  { label: "[[1,2],[3,4]]", expression: "[[1,2],[3,4]]" },
  { label: "det([[1,2],[3,4]])", expression: "det([[1,2],[3,4]])" },
  // Sprint V2.7 — Motor de Combinatória. Substitui "inv([[2,0],[0,2]])"
  // (removida daqui, mesmo racional da V2.6 com transpose: o motor de
  // matrizes ainda tem 3 outros exemplos na lista e a regra da sprint é
  // "substituir apenas um exemplo existente" — a operação continua 100%
  // suportada, só deixou de ocupar espaço na Home).
  { label: "combinacao(10,3)", expression: "combinacao(10,3)" },
  {
    label: "[[1,2],[3,4]]*[[5,6],[7,8]]",
    expression: "[[1,2],[3,4]]*[[5,6],[7,8]]",
  },
  // Sprint V2.2.2 — os exemplos com variáveis locais (A=..., B=...) da
  // V2.2.1 foram removidos daqui por decisão de UX do Theo, após testar a
  // interface: a sintaxe continua 100% suportada pelo motor (ver
  // `matrix/parsing.py`/`matrix/evaluator.py`), só deixou de aparecer como
  // exemplo rápido. Nenhuma mudança de backend, teclado, histórico ou
  // Biblioteca de Fórmulas.
  // Sprint V2.3 — Motor de Números Complexos.
  { label: "3+4i", expression: "3+4i" },
  { label: "(2+i)(3-i)", expression: "(2+i)(3-i)" },
  { label: "conjugado(3+4i)", expression: "conjugado(3+4i)" },
  { label: "modulo(3+4i)", expression: "modulo(3+4i)" },
  { label: "argumento(1+i)", expression: "argumento(1+i)" },
  { label: "polar(1+i)", expression: "polar(1+i)" },
  // Sprint V2.4 — Descoberta de Sistemas Lineares (motor já existente,
  // sem exemplo até então). Um único exemplo representativo, mesmo padrão
  // de "um por operação nova" das sprints anteriores. Separador ";" (não
  // "\n"): o campo da Home é um `<input type="text">` de uma linha só —
  // o próprio navegador (algoritmo de sanitização de valor do HTML,
  // reproduzido pelo jsdom) remove qualquer "\n" do value ao preenchê-lo
  // programaticamente, colando as duas equações ("x+y=5x-y=1", inválido).
  // ";" é o separador alternativo que o backend já aceita nativamente
  // (`equations/dispatcher.py`) e sobrevive intacto num input de uma
  // linha — mesmo sistema, mesma renderização KaTeX (`to-latex.ts` trata
  // os dois separadores de forma idêntica), zero mudança estrutural no
  // componente da Home. A Calculadora (textarea real) usa a forma com
  // "\n" em `CALCULATOR_QUICK_EXAMPLES` abaixo, sem esse problema.
  { label: "x+y=5; x-y=1", expression: "x+y=5; x-y=1" },
  // Sprint V2.5 — Motor de Sistemas Polinomiais Não Lineares. Mesmo
  // separador ";" e mesmo motivo da V2.4 acima (o campo da Home é um
  // <input> de uma linha só, "\n" seria removido na sanitização de valor
  // do HTML).
  { label: "x²+y=5; x-y=1", expression: "x²+y=5; x-y=1" },
  // Sprint V2.6 — Motor de Polinômios Avançados. Substitui
  // "transpose([[1,2,3],[4,5,6]])" (removida daqui): motor de matrizes já
  // tem 5 outros exemplos na lista, e "Não aumentar demasiadamente a
  // quantidade" (regra explícita da sprint) — a operação continua 100%
  // suportada, só deixou de ocupar espaço na Home.
  { label: "fatorar(x²-9)", expression: "fatorar(x²-9)" },
  // Sprint V2.8 — Motor de Probabilidade. Os dois exemplos exatos pedidos
  // na seção EXEMPLOS do escopo da sprint para a Home.
  { label: "probabilidade(3,10)", expression: "probabilidade(3,10)" },
  { label: "binomial(10,3,0.5)", expression: "binomial(10,3,0.5)" },
];

/**
 * Vitrine rápida da Calculadora (`/calculadora`) — um exemplo por área do
 * motor, NUNCA um catálogo completo do que é suportado (decisão de UX do
 * Theo, pós-Sprint V2.3: `QUICK_EXAMPLES` tinha crescido para 18 itens
 * ali, virando exemplo de cada operação nova em vez de continuar uma
 * vitrine). Operações que não aparecem mais aqui (ex. det/inv/transpose,
 * multiplicação de matrizes, conjugado/argumento/polar de complexos)
 * continuam 100% suportadas pelo motor — só deixaram de ocupar espaço na
 * tela principal da calculadora; permanecem acessíveis pela Biblioteca de
 * Fórmulas e pelos exemplos próprios de cada categoria lá
 * (`data/formulas.ts`). Ordem fixa, todos confirmados contra o backend
 * real.
 *
 * Sprint V2.4 — Sistemas Lineares: motor já existia (backend +
 * `equations/dispatcher.py`), mas não tinha NENHUM exemplo/tecla/exposição
 * no frontend (lacuna de descoberta pura, não uma feature nova) — um
 * único exemplo acrescentado (10 → 11), exceção deliberada à contagem
 * fixa de antes, pedida explicitamente pelo Theo.
 *
 * Sprint V2.5 — Motor de Sistemas Polinomiais Não Lineares: motor NOVO de
 * verdade desta vez (não uma lacuna de descoberta) — mesma exceção de
 * "um exemplo por área nova" (11 → 12).
 *
 * Sprint V2.6 — Motor de Polinômios Avançados: motor NOVO com 7 operações
 * distintas — 3 exemplos (não 1) para cobrir fatoração/expansão/raízes,
 * pedido explícito do escopo da sprint (12 → 15).
 *
 * Sprint V2.7 — Motor de Combinatória: 4 exemplos (fatorial, combinação,
 * arranjo, permutação), a lista exata pedida na seção EXEMPLOS do escopo
 * da sprint (15 → 19).
 *
 * Sprint V2.8 — Motor de Probabilidade: 3 exemplos (probabilidade,
 * binomial, condicional), a lista exata pedida na seção EXEMPLOS do
 * escopo da sprint (19 → 22).
 *
 * Sprint V3.0 (Structured Math Input) — reduzida temporariamente de 22
 * para 7 (decisão de escopo confirmada com o Theo): o `StructuredMathInput`
 * (MathLive) só sabe representar estruturalmente números, variáveis,
 * `+ - × ÷ =`, parênteses, potência, fração e raiz quadrada/cúbica/
 * n-ésima nesta sprint — os exemplos que dependiam de notações ainda não
 * migradas (derivada, integral, limite, geometria, somatório, matrizes,
 * complexos, sistemas, polinômios com função nomeada, combinatória,
 * probabilidade) saem da vitrine da Calculadora até a categoria
 * correspondente do teclado ser migrada estruturalmente (V3.0.x). Nada foi
 * removido do backend nem de `QUICK_EXAMPLES`/`QUICK_SHORTCUTS` (Home,
 * fora de escopo) — só desta lista. Os 6 primeiros são exatamente os
 * casos de regressão obrigatórios do ticket da V3.0.
 */
export const CALCULATOR_QUICK_EXAMPLES: QuickExample[] = [
  { label: "x² - 4 = 0", expression: "x² - 4 = 0" },
  { label: "2x + 4 = 10", expression: "2x + 4 = 10" },
  { label: "(x+1)³", expression: "(x+1)³" },
  { label: "√16", expression: "√16" },
  { label: "1/2 + 1/3", expression: "1/2 + 1/3" },
  { label: "x³-6x²+11x-6=0", expression: "x³-6x²+11x-6=0" },
  { label: "π/2", expression: "π/2" },
];

export interface QuickShortcut {
  label: string;
  insertText: string;
}

/**
 * Atalhos por categoria — cada um preenche o campo com um ponto de partida
 * representativo (não insere na posição do cursor: isso é responsabilidade
 * do teclado matemático completo da Calculadora, Etapa 2). Todos também
 * confirmados contra o backend real.
 */
export const QUICK_SHORTCUTS: QuickShortcut[] = [
  { label: "Equação", insertText: "x - 5 = 0" },
  { label: "Função", insertText: "f(x) = x² - 1" },
  { label: "Derivada", insertText: "d/dx(x²)" },
  { label: "Integral", insertText: "∫x² dx" },
  { label: "Limite", insertText: "lim x→0 sen(x)/x" },
  { label: "Raiz", insertText: "√(x+1)" },
  { label: "Trigonometria", insertText: "sen(π/6)" },
  { label: "Geometria", insertText: "circunferencia((0,0),5)" },
];
