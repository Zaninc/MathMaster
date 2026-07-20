/**
 * Dados da Biblioteca de Fórmulas (/formulas). Separado de data/tools.ts
 * (Sprint "Biblioteca de Fórmulas — Etapa 1") porque deixou de ser um
 * complemento de /ferramentas e virou seu próprio domínio — próximas
 * etapas (KaTeX, filtros, catálogo maior) crescem aqui, sem acoplar de
 * volta a Ferramentas.
 */
export interface FormulaEntry {
  category: string;
  name: string;
  formula: string;
}

export const FORMULAS: FormulaEntry[] = [
  { category: "Álgebra", name: "Bhaskara", formula: "x = (-b ± √(b² - 4ac)) / 2a" },
  { category: "Geometria", name: "Teorema de Pitágoras", formula: "a² + b² = c²" },
  { category: "Geometria", name: "Área do círculo", formula: "A = πr²" },
  { category: "Geometria", name: "Área do triângulo", formula: "A = (base × altura) / 2" },
  { category: "Trigonometria", name: "Relação fundamental", formula: "sen²(x) + cos²(x) = 1" },
  { category: "Cálculo", name: "Derivada da potência", formula: "d/dx(xⁿ) = n·xⁿ⁻¹" },
  { category: "Cálculo", name: "Integral da potência", formula: "∫xⁿ dx = xⁿ⁺¹/(n+1) + C" },
];
