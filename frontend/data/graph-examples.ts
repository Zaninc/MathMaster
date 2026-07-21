export interface GraphExample {
  label: string;
  /**
   * Representação visual em LaTeX (opcional, sem delimitadores `$`),
   * renderizada via `MathFormula` — puramente de apresentação. `label`
   * continua sendo o nome acessível (`aria-label`) e o fallback exibido
   * se o KaTeX falhar; `expression` continua sendo o único texto que
   * chega no campo/avaliador. Nenhum dos dois é afetado por este campo.
   */
  labelLatex?: string;
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
      { label: "x³ − 3x", labelLatex: String.raw`x^3 - 3x`, expression: "x^3 - 3x" },
      { label: "x³", labelLatex: String.raw`x^3`, expression: "x^3" },
      { label: "x⁴", labelLatex: String.raw`x^4`, expression: "x^4" },
    ],
  },
  {
    id: "exponencial",
    label: "Exponencial",
    items: [
      { label: "eˣ", labelLatex: String.raw`e^x`, expression: "e^x" },
      { label: "2ˣ", labelLatex: String.raw`2^x`, expression: "2^x" },
    ],
  },
  {
    id: "logaritmica",
    label: "Logarítmica",
    items: [
      { label: "ln(x)", labelLatex: String.raw`\ln(x)`, expression: "ln(x)" },
      { label: "log(x)", labelLatex: String.raw`\log_{10}(x)`, expression: "log10(x)" },
      { label: "logₐ(x)", labelLatex: String.raw`\log_a(x)`, expression: "log(x, 2)" },
    ],
  },
  {
    id: "trigonometrica",
    label: "Trigonométrica",
    items: [
      { label: "sen(x)", labelLatex: String.raw`\operatorname{sen}(x)`, expression: "sin(x)" },
      { label: "cos(x)", labelLatex: String.raw`\cos(x)`, expression: "cos(x)" },
      { label: "tg(x)", labelLatex: String.raw`\operatorname{tg}(x)`, expression: "tan(x)" },
      { label: "cotg(x)", labelLatex: String.raw`\operatorname{cotg}(x)`, expression: "cot(x)" },
      { label: "sec(x)", labelLatex: String.raw`\sec(x)`, expression: "sec(x)" },
      { label: "cossec(x)", labelLatex: String.raw`\operatorname{cossec}(x)`, expression: "csc(x)" },
      {
        label: "a·sen(bx+c)+d",
        labelLatex: String.raw`a\operatorname{sen}(bx+c)+d`,
        expression: "2*sin(3*x + 1) - 1",
      },
      { label: "a·cos(bx+c)+d", labelLatex: String.raw`a\cos(bx+c)+d`, expression: "2*cos(3*x + 1) - 1" },
    ],
  },
  {
    id: "especiais",
    label: "Especiais",
    items: [
      { label: "√x", labelLatex: String.raw`\sqrt{x}`, expression: "sqrt(x)" },
      { label: "|x|", labelLatex: String.raw`|x|`, expression: "abs(x)" },
    ],
  },
  {
    id: "interessantes",
    label: "Interessantes",
    items: [
      { label: "e^(−x²)", labelLatex: String.raw`e^{-x^2}`, expression: "e^(-x^2)" },
      { label: "sigmoide", labelLatex: String.raw`\frac{1}{1+e^{-x}}`, expression: "1/(1 + e^(-x))" },
    ],
  },
];
