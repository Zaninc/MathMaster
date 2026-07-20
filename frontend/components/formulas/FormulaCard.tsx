import { MathFormula } from "@/components/shared/MathFormula";
import type { FormulaEntry } from "@/data/formulas";

interface FormulaCardProps {
  formula: FormulaEntry;
}

/**
 * Card de uma única fórmula (Biblioteca de Fórmulas — Etapa 2). Não é
 * clicável — de propósito sem hover/cursor de link, para não parecer um
 * botão. O fallback de LaTeX inválido já vem de dentro do MathFormula
 * (nunca lança, nunca derruba a página) — o título continua visível
 * mesmo nesse caso.
 */
export function FormulaCard({ formula }: FormulaCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-text-primary">{formula.title}</h3>
      <MathFormula formula={formula.latex} displayMode className="text-text-primary" />
    </article>
  );
}
