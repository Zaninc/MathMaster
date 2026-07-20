/**
 * Dados da Biblioteca de Fórmulas (/formulas). Separado de data/tools.ts
 * desde a Etapa 1; na Etapa 2 as expressões migraram de texto Unicode
 * solto para LaTeX compatível com KaTeX (components/shared/MathFormula),
 * e ganharam `id` estável — categoria virou slug estável (`category`)
 * com rótulo PT-BR à parte (`FORMULA_CATEGORY_LABELS`), preparando
 * filtro por categoria nas próximas etapas sem duplicar o texto exibido
 * como chave.
 */
export type FormulaCategoryId = "algebra" | "geometria" | "trigonometria" | "calculo";

export const FORMULA_CATEGORY_LABELS: Record<FormulaCategoryId, string> = {
  algebra: "Álgebra",
  geometria: "Geometria",
  trigonometria: "Trigonometria",
  calculo: "Cálculo",
};

export interface FormulaEntry {
  id: string;
  title: string;
  /** LaTeX sem delimitadores `$`/`\[`, pronto para MathFormula. */
  latex: string;
  category: FormulaCategoryId;
}

/** Ordem de exibição das categorias = ordem de 1ª aparição aqui (preserva a ordem da Etapa 1). */
export const FORMULAS: FormulaEntry[] = [
  {
    id: "bhaskara",
    title: "Fórmula de Bhaskara",
    latex: String.raw`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`,
    category: "algebra",
  },
  {
    id: "teorema-pitagoras",
    title: "Teorema de Pitágoras",
    latex: String.raw`a^2 + b^2 = c^2`,
    category: "geometria",
  },
  {
    id: "area-circulo",
    title: "Área do círculo",
    latex: String.raw`A = \pi r^2`,
    category: "geometria",
  },
  {
    id: "area-triangulo",
    title: "Área do triângulo",
    latex: String.raw`A = \frac{bh}{2}`,
    category: "geometria",
  },
  {
    id: "relacao-fundamental-trigonometrica",
    title: "Relação fundamental",
    latex: String.raw`\sin^2(x) + \cos^2(x) = 1`,
    category: "trigonometria",
  },
  {
    id: "derivada-potencia",
    title: "Derivada da potência",
    latex: String.raw`\frac{d}{dx}\left(x^n\right) = nx^{n-1}`,
    category: "calculo",
  },
  {
    id: "integral-potencia",
    title: "Integral da potência",
    latex: String.raw`\int x^n\,dx = \frac{x^{n+1}}{n+1} + C`,
    category: "calculo",
  },
];
