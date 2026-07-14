import { formatNumber } from "@/lib/utils/format";

import { ResultGroup } from "./ResultGroup";

export interface CircleStats {
  area: number;
  circumference: number;
}

interface CircleResultPanelProps {
  stats: CircleStats | null;
}

/** Mesmo padrão visual de `TriangleResultPanel` — fórmula em destaque discreto, resultado em destaque forte. */
export function CircleResultPanel({ stats }: CircleResultPanelProps) {
  if (!stats) return null;

  return (
    <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
      <ResultGroup label="Área">
        <p className="text-text-secondary">πr²</p>
        <p className="mt-1 text-lg font-semibold text-text-primary">{formatNumber(stats.area)}</p>
      </ResultGroup>

      <ResultGroup label="Comprimento">
        <p className="text-text-secondary">2πr</p>
        <p className="mt-1 text-lg font-semibold text-text-primary">{formatNumber(stats.circumference)}</p>
      </ResultGroup>
    </div>
  );
}
