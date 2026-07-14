"use client";

import { useMemo } from "react";

import { useElementSize } from "@/hooks/useElementSize";
import { sampleEllipse, sampleHyperbolaBranch, sampleParabola } from "@/lib/math/geometry-render";
import { buildGridValues, dataToPixelX, dataToPixelY, fitViewportToAspect, niceStep, type Viewport } from "@/lib/math/viewport";

import type { GeometryShape } from "./types";

export const GEOMETRY_VIEWPORT: Viewport = { xMin: -12, xMax: 12, yMin: -12, yMax: 12 };

function pointsToPath(points: { x: number; y: number }[], viewport: Viewport, width: number, height: number, closed = false): string {
  if (points.length === 0) return "";
  const commands = points.map((point, index) => {
    const px = dataToPixelX(point.x, viewport, width);
    const py = dataToPixelY(point.y, viewport, height);
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
 * (Etapa 3).
 *
 * Hotfix de alinhamento: container medido via `useElementSize`
 * (`ResizeObserver`) em vez de `GEOMETRY_SIZE` fixo — `fitViewportToAspect`
 * expande o eixo que sobra para preencher o container real sem distorcer
 * (mesma técnica do `GraphCanvas`).
 */
export function GeometryCanvas({ shape, viewport = GEOMETRY_VIEWPORT }: GeometryCanvasProps) {
  const [containerRef, { width, height }] = useElementSize<HTMLDivElement>();
  const measured = width > 0 && height > 0;
  const renderViewport = useMemo(
    () => (measured ? fitViewportToAspect(viewport, width, height) : viewport),
    [viewport, width, height, measured]
  );

  const xStep = niceStep(renderViewport.xMax - renderViewport.xMin);
  const yStep = niceStep(renderViewport.yMax - renderViewport.yMin);
  const xGridValues = useMemo(
    () => buildGridValues(renderViewport.xMin, renderViewport.xMax, xStep),
    [renderViewport.xMin, renderViewport.xMax, xStep]
  );
  const yGridValues = useMemo(
    () => buildGridValues(renderViewport.yMin, renderViewport.yMax, yStep),
    [renderViewport.yMin, renderViewport.yMax, yStep]
  );

  return (
    <div
      ref={containerRef}
      className="h-[clamp(520px,68vh,760px)] w-full overflow-hidden rounded-lg border border-border bg-surface"
    >
      {measured && (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={shape ? `Construção geométrica: ${shape.kind}` : "Nenhuma figura para desenhar ainda"}
          className="h-full w-full"
        >
          {xGridValues.map((x) => (
            <line
              key={`grid-x-${x}`}
              x1={dataToPixelX(x, renderViewport, width)}
              x2={dataToPixelX(x, renderViewport, width)}
              y1={0}
              y2={height}
              stroke="var(--border)"
              strokeWidth={1}
            />
          ))}
          {yGridValues.map((y) => (
            <line
              key={`grid-y-${y}`}
              y1={dataToPixelY(y, renderViewport, height)}
              y2={dataToPixelY(y, renderViewport, height)}
              x1={0}
              x2={width}
              stroke="var(--border)"
              strokeWidth={1}
            />
          ))}
          <line
            x1={dataToPixelX(0, renderViewport, width)}
            x2={dataToPixelX(0, renderViewport, width)}
            y1={0}
            y2={height}
            stroke="var(--text-muted)"
            strokeWidth={1.5}
          />
          <line
            y1={dataToPixelY(0, renderViewport, height)}
            y2={dataToPixelY(0, renderViewport, height)}
            x1={0}
            x2={width}
            stroke="var(--text-muted)"
            strokeWidth={1.5}
          />

          {shape?.kind === "triangle" && (
            <path
              d={pointsToPath(shape.points, renderViewport, width, height, true)}
              fill="var(--accent)"
              fillOpacity={0.12}
              stroke="var(--accent)"
              strokeWidth={2}
            />
          )}

          {shape?.kind === "circle" && (
            <circle
              cx={dataToPixelX(shape.center.x, renderViewport, width)}
              cy={dataToPixelY(shape.center.y, renderViewport, height)}
              r={Math.abs(shape.radius) * (width / (renderViewport.xMax - renderViewport.xMin))}
              fill="var(--accent)"
              fillOpacity={0.12}
              stroke="var(--accent)"
              strokeWidth={2}
            />
          )}

          {shape?.kind === "line" && (
            <line
              x1={dataToPixelX(shape.p1.x, renderViewport, width)}
              y1={dataToPixelY(shape.p1.y, renderViewport, height)}
              x2={dataToPixelX(shape.p2.x, renderViewport, width)}
              y2={dataToPixelY(shape.p2.y, renderViewport, height)}
              stroke="var(--accent)"
              strokeWidth={2}
            />
          )}

          {shape?.kind === "parabola" && (
            <path
              d={pointsToPath(sampleParabola(shape.vertex, shape.focus, renderViewport), renderViewport, width, height)}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
            />
          )}

          {shape?.kind === "ellipse" && (
            <path
              d={pointsToPath(sampleEllipse(shape.center, shape.a, shape.b), renderViewport, width, height, true)}
              fill="var(--accent)"
              fillOpacity={0.12}
              stroke="var(--accent)"
              strokeWidth={2}
            />
          )}

          {shape?.kind === "hyperbola" && (
            <>
              <path
                d={pointsToPath(sampleHyperbolaBranch(shape.center, shape.a, shape.b, 1), renderViewport, width, height)}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={2}
              />
              <path
                d={pointsToPath(sampleHyperbolaBranch(shape.center, shape.a, shape.b, -1), renderViewport, width, height)}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={2}
              />
            </>
          )}

          {shape &&
            shape.kind !== "line" &&
            shape.kind !== "parabola" &&
            shape.kind !== "hyperbola" &&
            "center" in shape && (
              <circle
                cx={dataToPixelX(shape.center.x, renderViewport, width)}
                cy={dataToPixelY(shape.center.y, renderViewport, height)}
                r={3}
                fill="var(--text-primary)"
              />
            )}
        </svg>
      )}
    </div>
  );
}
