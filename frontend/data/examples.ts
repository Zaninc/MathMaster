export interface QuickExample {
  label: string;
  expression: string;
}

/**
 * Os 6 exemplos pedidos no briefing da Sprint Frontend V1 — todos
 * confirmados contra o backend real (smoke test manual, Etapa 1).
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
  { label: "inv([[2,0],[0,2]])", expression: "inv([[2,0],[0,2]])" },
  { label: "transpose([[1,2,3],[4,5,6]])", expression: "transpose([[1,2,3],[4,5,6]])" },
  {
    label: "[[1,2],[3,4]]*[[5,6],[7,8]]",
    expression: "[[1,2],[3,4]]*[[5,6],[7,8]]",
  },
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
