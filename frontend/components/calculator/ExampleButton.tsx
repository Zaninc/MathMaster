"use client";

import { MathFormula } from "@/components/shared/MathFormula";
import type { QuickExample } from "@/data/examples";
import { useInputLatex } from "@/hooks/useSolveLatex";

interface ExampleButtonProps {
  example: QuickExample;
  onSelect: (expression: string) => void;
}

/**
 * Botão de exemplo da Calculadora, renderizado via KaTeX quando possível
 * — mesma infraestrutura de progressive enhancement do MathPreview/
 * HistoryPanel (`useInputLatex`/`MathFormula`): texto puro (`label`)
 * primeiro/fallback, promovido a KaTeX quando a conversão resolve.
 * `delayMs=0` porque o exemplo é estático (não há digitação a debouncer).
 *
 * `example.expression` é o que vai pro clique (`onSelect`) — nunca passa
 * pela conversão LaTeX, que é só decoração visual do que já é exibido.
 */
export function ExampleButton({ example, onSelect }: ExampleButtonProps) {
  const { latex, source } = useInputLatex(example.expression, 0);
  const showLatex = latex !== null && source === example.expression;

  return (
    <button
      type="button"
      onClick={() => onSelect(example.expression)}
      aria-label={`Preencher exemplo: ${example.label}`}
      className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-secondary transition-colors duration-(--motion-fast) hover:border-border-hover hover:text-text-primary"
    >
      {showLatex ? <MathFormula formula={latex} /> : example.label}
    </button>
  );
}
