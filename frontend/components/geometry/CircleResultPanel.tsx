import { MathFormula } from "@/components/shared/MathFormula";
import { formatNumber } from "@/lib/utils/format";

import { ResultGroup } from "./ResultGroup";

export interface CircleStats {
  area: number;
  circumference: number;
}

interface CircleResultPanelProps {
  stats: CircleStats | null;
}

/**
 * Mesmo padrão visual de `TriangleResultPanel` — fórmula simbólica em
 * destaque discreto (KaTeX via `MathFormula`), resultado numérico em
 * destaque forte logo abaixo.
 */
export function CircleResultPanel({ stats }: CircleResultPanelProps) {
  if (!stats) return null;

  return (
    <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
      <ResultGroup label="Área">
        <MathFormula
          formula="A = \pi r^2"
          displayMode
          className="text-text-secondary [&_.katex-display]:text-left"
        />
        <p className="mt-1 text-lg font-semibold text-text-primary">{formatNumber(stats.area)}</p>
      </ResultGroup>

      <ResultGroup label="Comprimento">
        <MathFormula
          formula="C = 2\pi r"
          displayMode
          className="text-text-secondary [&_.katex-display]:text-left"
        />
        <p className="mt-1 text-lg font-semibold text-text-primary">{formatNumber(stats.circumference)}</p>
      </ResultGroup>
    </div>
  );
}
