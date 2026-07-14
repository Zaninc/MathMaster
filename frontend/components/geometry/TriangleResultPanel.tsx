import { formatNumber } from "@/lib/utils/format";

import { ResultGroup } from "./ResultGroup";
import type { TriangleAngleClass, TriangleSideClass } from "@/lib/math/geometry";

export interface TriangleStats {
  area: number;
  perimeter: number;
  sideClass: TriangleSideClass;
  angleClass: TriangleAngleClass;
  ab: number;
  bc: number;
  ca: number;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

interface TriangleResultPanelProps {
  stats: TriangleStats | null;
}

/**
 * Puramente de apresentação — recebe os valores já calculados por
 * `GeometryWorkspace` (`lib/math/geometry.ts`), nunca recalcula nada.
 * `<sub>` HTML real para os índices A/B/C (não um lookalike Unicode —
 * Unicode não tem subscrito real para "b"/"c"). `break-words` +
 * `overflow-wrap:anywhere` (via `ResultGroup`) em vez de `break-all`:
 * quebra em espaços/pontos naturais primeiro, só força quebra no meio de
 * um token se não houver alternativa — a coluna lateral (280-340px) nunca
 * estoura horizontalmente.
 */
export function TriangleResultPanel({ stats }: TriangleResultPanelProps) {
  if (!stats) {
    return <p className="text-sm text-danger">Os três pontos não formam um triângulo válido (estão alinhados).</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
      <ResultGroup label="Área">
        <p className="break-words text-text-secondary">
          |x<sub>A</sub>(y<sub>B</sub> − y<sub>C</sub>) + x<sub>B</sub>(y<sub>C</sub> − y<sub>A</sub>) + x
          <sub>C</sub>(y<sub>A</sub> − y<sub>B</sub>)| / 2
        </p>
        <p className="mt-1 text-lg font-semibold text-text-primary">{formatNumber(stats.area)}</p>
      </ResultGroup>

      <ResultGroup label="Perímetro">
        <p>
          AB + BC + CA = <span className="font-semibold text-text-primary">{formatNumber(stats.perimeter)}</span>
        </p>
      </ResultGroup>

      <ResultGroup label="Lados">
        <div className="flex flex-col gap-0.5">
          <p>AB = {formatNumber(stats.ab)}</p>
          <p>BC = {formatNumber(stats.bc)}</p>
          <p>CA = {formatNumber(stats.ca)}</p>
        </div>
      </ResultGroup>

      <ResultGroup label="Classificação">
        <p>
          {capitalize(stats.sideClass)}, {stats.angleClass}
        </p>
      </ResultGroup>
    </div>
  );
}
