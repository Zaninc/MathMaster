export interface GraphExample {
  label: string;
  expression: string;
}

export interface GraphExampleGroup {
  id: string;
  label: string;
  items: GraphExample[];
}

/**
 * Sintaxe de MATHJS (^, sin, log, abs) — NÃO é a sintaxe do MathMaster
 * (backend). Os dois nunca se misturam: isto alimenta só o avaliador de
 * plotagem client-side (`lib/math/plot-evaluator.ts`), nunca `/solve`.
 *
 * Categorias com UMA função continuam botões simples (um clique = uma
 * função, igual sempre foi). Categorias com VÁRIAS funções relacionadas
 * viram grupo expansível em `FunctionList` (`GRAPH_EXAMPLE_GROUPS`) — a
 * biblioteca cresceu, mas a fileira de botões não, então a interface não
 * fica poluída.
 */
export const GRAPH_EXAMPLES: GraphExample[] = [
  { label: "Linear", expression: "2x + 1" },
  { label: "Quadrática", expression: "x^2 - 4" },
  { label: "Racional", expression: "1/x" },
];

/**
 * `log(x)` insere `log10(x)` (base 10, convenção do resto do produto —
 * ver `to-latex.ts`) e `ln(x)` insere `log(x)` do mathjs, cujo `log`
 * NATIVO já é logaritmo natural — o `log(x)` que existia antes desta
 * expansão continua acessível aqui, só que agora com o rótulo correto
 * (`ln`) em vez de reaproveitar o nome "log" pra duas coisas diferentes.
 */
export const GRAPH_EXAMPLE_GROUPS: GraphExampleGroup[] = [
  {
    id: "polinomial",
    label: "Polinomial",
    items: [
      { label: "x³ − 3x", expression: "x^3 - 3x" },
      { label: "x³", expression: "x^3" },
      { label: "x⁴", expression: "x^4" },
    ],
  },
  {
    id: "exponencial",
    label: "Exponencial",
    items: [
      { label: "eˣ", expression: "e^x" },
      { label: "2ˣ", expression: "2^x" },
    ],
  },
  {
    id: "logaritmica",
    label: "Logarítmica",
    items: [
      { label: "ln(x)", expression: "ln(x)" },
      { label: "log(x)", expression: "log10(x)" },
      { label: "logₐ(x)", expression: "log(x, 2)" },
    ],
  },
  {
    id: "trigonometrica",
    label: "Trigonométrica",
    items: [
      { label: "sen(x)", expression: "sin(x)" },
      { label: "cos(x)", expression: "cos(x)" },
      { label: "tg(x)", expression: "tan(x)" },
      { label: "cotg(x)", expression: "cot(x)" },
      { label: "sec(x)", expression: "sec(x)" },
      { label: "cossec(x)", expression: "csc(x)" },
      { label: "a·sen(bx+c)+d", expression: "2*sin(3*x + 1) - 1" },
      { label: "a·cos(bx+c)+d", expression: "2*cos(3*x + 1) - 1" },
    ],
  },
  {
    id: "especiais",
    label: "Especiais",
    items: [
      { label: "√x", expression: "sqrt(x)" },
      { label: "|x|", expression: "abs(x)" },
    ],
  },
  {
    id: "interessantes",
    label: "Interessantes",
    items: [
      { label: "e^(−x²)", expression: "e^(-x^2)" },
      { label: "sigmoide", expression: "1/(1 + e^(-x))" },
    ],
  },
];
