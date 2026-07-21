import type { FormulaEntry } from "@/data/formulas";

import { FormulaCard } from "./FormulaCard";

interface FormulaCategoryProps {
  label: string;
  formulas: FormulaEntry[];
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
}

/**
 * Uma categoria da Biblioteca de Fórmulas: título (`h2`, a página é quem
 * tem o `h1`) + grade de cards (1 coluna no mobile por padrão, mais
 * colunas conforme o espaço — mesmo padrão de grid usado no resto do
 * projeto, ex. TOOLS em /ferramentas).
 */
export function FormulaCategory({ label, formulas, isFavorite, onToggleFavorite }: FormulaCategoryProps) {
  return (
    <section aria-label={label} className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-text-primary">{label}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {formulas.map((formula) => (
          <FormulaCard
            key={formula.id}
            formula={formula}
            isFavorite={isFavorite(formula.id)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </section>
  );
}
