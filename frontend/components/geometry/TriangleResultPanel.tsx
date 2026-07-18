import { MathFormula } from "@/components/shared/MathFormula";
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
 * Fórmulas simbólicas renderizadas via `MathFormula` (KaTeX): notação
 * real (frações, barras de valor absoluto, subscritos), não aproximação
 * textual. A fórmula da área quebra em duas linhas (`aligned`, quebra
 * antes do último termo) para caber inteira na coluna lateral
 * (280-340px) sem scroll horizontal — `\bigl|`/`\bigr|` porque
 * `\left|`/`\right|` não podem cruzar quebras de linha, `\tfrac` para
 * altura compacta. Centralizada (padrão do display mode do KaTeX).
 */
export function TriangleResultPanel({ stats }: TriangleResultPanelProps) {
  if (!stats) {
    return <p className="text-sm text-danger">Os três pontos não formam um triângulo válido (estão alinhados).</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
      <ResultGroup label="Área">
        <MathFormula
          formula="\begin{aligned} A &= \tfrac{1}{2}\,\bigl|\,x_A(y_B - y_C) + x_B(y_C - y_A) \\ &\quad + x_C(y_A - y_B)\,\bigr| \end{aligned}"
          displayMode
          className="text-text-secondary"
        />
        <p className="mt-1 text-lg font-semibold text-text-primary">{formatNumber(stats.area)}</p>
      </ResultGroup>

      <ResultGroup label="Perímetro">
        <p>
          <MathFormula
            formula="P = \overline{AB} + \overline{BC} + \overline{CA} ="
            className="text-text-secondary"
          />{" "}
          <span className="font-semibold text-text-primary">{formatNumber(stats.perimeter)}</span>
        </p>
      </ResultGroup>

      <ResultGroup label="Lados">
        <div className="flex flex-col gap-0.5">
          <p>
            <MathFormula formula={`\\overline{AB} = ${formatNumber(stats.ab)}`} />
          </p>
          <p>
            <MathFormula formula={`\\overline{BC} = ${formatNumber(stats.bc)}`} />
          </p>
          <p>
            <MathFormula formula={`\\overline{CA} = ${formatNumber(stats.ca)}`} />
          </p>
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
