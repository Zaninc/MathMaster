import { FORMULA_CATEGORY_LABELS, FORMULAS } from "@/data/formulas";

import { FormulaCategory } from "./FormulaCategory";

/**
 * Biblioteca de Fórmulas — Etapa 2: agrupa por categoria (ordem = 1ª
 * aparição em FORMULAS, preservando a ordem da Etapa 1) e delega a
 * FormulaCategory/FormulaCard. Puro e sem estado — título/descrição da
 * página ficam em app/formulas/page.tsx.
 */
export function FormulasReference() {
  const categories = Array.from(new Set(FORMULAS.map((formula) => formula.category)));

  return (
    <div className="flex flex-col gap-10">
      {categories.map((category) => (
        <FormulaCategory
          key={category}
          label={FORMULA_CATEGORY_LABELS[category]}
          formulas={FORMULAS.filter((formula) => formula.category === category)}
        />
      ))}
    </div>
  );
}
