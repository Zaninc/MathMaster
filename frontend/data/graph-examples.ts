export interface GraphExample {
  label: string;
  expression: string;
}

/**
 * Sintaxe de MATHJS (^, sin, log, abs) — NÃO é a sintaxe do MathMaster
 * (backend). Os dois nunca se misturam: isto alimenta só o avaliador de
 * plotagem client-side (`lib/math/plot-evaluator.ts`), nunca `/solve`.
 */
export const GRAPH_EXAMPLES: GraphExample[] = [
  { label: "Linear", expression: "2x + 1" },
  { label: "Quadrática", expression: "x^2 - 4" },
  { label: "Polinomial", expression: "x^3 - 3x" },
  { label: "Racional", expression: "1/x" },
  { label: "Exponencial", expression: "2^x" },
  { label: "Logarítmica", expression: "log(x)" },
  { label: "Modular", expression: "abs(x)" },
  { label: "Trigonométrica", expression: "sin(x)" },
];
