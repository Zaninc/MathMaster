"use client";

import { useMemo } from "react";

import { sampleEllipse, sampleHyperbolaBranch, sampleParabola } from "@/lib/math/geometry-render";
import { buildGridValues, dataToPixelX, dataToPixelY, niceStep, type Viewport } from "@/lib/math/viewport";

import type { GeometryShape } from "./types";

export const GEOMETRY_SIZE = 520;
export const GEOMETRY_VIEWPORT: Viewport = { xMin: -12, xMax: 12, yMin: -12, yMax: 12 };

function pointsToPath(points: { x: number; y: number }[], viewport: Viewport, closed = false): string {
  if (points.length === 0) return "";
  const commands = points.map((point, index) => {
    const px = dataToPixelX(point.x, viewport, GEOMETRY_SIZE);
    const py = dataToPixelY(point.y, viewport, GEOMETRY_SIZE);
    return `${index === 0 ? "M" : "L"}${px.toFixed(2)},${py.toFixed(2)}`;
  });
  return commands.join(" ") + (closed ? " Z" : "");
}

interface GeometryCanvasProps {
  shape: GeometryShape | null;
  viewport?: Viewport;
}

/**
 * Renderer genérico, dirigido por um `GeometryShape` já calculado a
 * partir dos NÚMEROS que o usuário digitou (nunca da resposta em texto do
 * backend) — reaproveita a mesma grade/eixos de `lib/math/viewport.ts`
 * (Etapa 3), viewport quadrado para que círculos não apareçam ovalados.
 */
export function GeometryCanvas({ shape, viewport = GEOMETRY_VIEWPORT }: GeometryCanvasProps) {
  const xStep = niceStep(viewport.xMax - viewport.xMin);
  const yStep = niceStep(viewport.yMax - viewport.yMin);
  const xGridValues = useMemo(
    () => buildGridValues(viewport.xMin, viewport.xMax, xStep),
    [viewport.xMin, viewport.xMax, xStep]
  );
  const yGridValues = useMemo(
    () => buildGridValues(viewport.yMin, viewport.yMax, yStep),
    [viewport.yMin, viewport.yMax, yStep]
  );

  return (
    <div className="rounded-lg border border-border bg-surface">
      <svg
        viewBox={`0 0 ${GEOMETRY_SIZE} ${GEOMETRY_SIZE}`}
        role="img"
        aria-label={shape ? `Construção geométrica: ${shape.kind}` : "Nenhuma figura para desenhar ainda"}
        className="w-full rounded-lg"
      >
        {xGridValues.map((x) => (
          <line
            key={`grid-x-${x}`}
            x1={dataToPixelX(x, viewport, GEOMETRY_SIZE)}
            x2={dataToPixelX(x, viewport, GEOMETRY_SIZE)}
            y1={0}
            y2={GEOMETRY_SIZE}
            stroke="var(--border)"
            strokeWidth={1}
          />
        ))}
        {yGridValues.map((y) => (
          <line
            key={`grid-y-${y}`}
            y1={dataToPixelY(y, viewport, GEOMETRY_SIZE)}
            y2={dataToPixelY(y, viewport, GEOMETRY_SIZE)}
            x1={0}
            x2={GEOMETRY_SIZE}
            stroke="var(--border)"
            strokeWidth={1}
          />
        ))}
        <line
          x1={dataToPixelX(0, viewport, GEOMETRY_SIZE)}
          x2={dataToPixelX(0, viewport, GEOMETRY_SIZE)}
          y1={0}
          y2={GEOMETRY_SIZE}
          stroke="var(--text-muted)"
          strokeWidth={1.5}
        />
        <line
          y1={dataToPixelY(0, viewport, GEOMETRY_SIZE)}
          y2={dataToPixelY(0, viewport, GEOMETRY_SIZE)}
          x1={0}
          x2={GEOMETRY_SIZE}
          stroke="var(--text-muted)"
          strokeWidth={1.5}
        />

        {shape?.kind === "triangle" && (
          <path
            d={pointsToPath(shape.points, viewport, true)}
            fill="var(--accent)"
            fillOpacity={0.12}
            stroke="var(--accent)"
            strokeWidth={2}
          />
        )}

        {shape?.kind === "circle" && (
          <circle
            cx={dataToPixelX(shape.center.x, viewport, GEOMETRY_SIZE)}
            cy={dataToPixelY(shape.center.y, viewport, GEOMETRY_SIZE)}
            r={Math.abs(shape.radius) * (GEOMETRY_SIZE / (viewport.xMax - viewport.xMin))}
            fill="var(--accent)"
            fillOpacity={0.12}
            stroke="var(--accent)"
            strokeWidth={2}
          />
        )}

        {shape?.kind === "line" && (
          <line
            x1={dataToPixelX(shape.p1.x, viewport, GEOMETRY_SIZE)}
            y1={dataToPixelY(shape.p1.y, viewport, GEOMETRY_SIZE)}
            x2={dataToPixelX(shape.p2.x, viewport, GEOMETRY_SIZE)}
            y2={dataToPixelY(shape.p2.y, viewport, GEOMETRY_SIZE)}
            stroke="var(--accent)"
            strokeWidth={2}
          />
        )}

        {shape?.kind === "parabola" && (
          <path
            d={pointsToPath(sampleParabola(shape.vertex, shape.focus, viewport), viewport)}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
          />
        )}

        {shape?.kind === "ellipse" && (
          <path
            d={pointsToPath(sampleEllipse(shape.center, shape.a, shape.b), viewport, true)}
            fill="var(--accent)"
            fillOpacity={0.12}
            stroke="var(--accent)"
            strokeWidth={2}
          />
        )}

        {shape?.kind === "hyperbola" && (
          <>
            <path
              d={pointsToPath(sampleHyperbolaBranch(shape.center, shape.a, shape.b, 1), viewport)}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
            />
            <path
              d={pointsToPath(sampleHyperbolaBranch(shape.center, shape.a, shape.b, -1), viewport)}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
            />
          </>
        )}

        {shape && shape.kind !== "line" && shape.kind !== "parabola" && shape.kind !== "hyperbola" && "center" in shape && (
          <circle
            cx={dataToPixelX(shape.center.x, viewport, GEOMETRY_SIZE)}
            cy={dataToPixelY(shape.center.y, viewport, GEOMETRY_SIZE)}
            r={3}
            fill="var(--text-primary)"
          />
        )}
      </svg>
    </div>
  );
}
