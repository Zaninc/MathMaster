"use client";

import { CartesianViewport } from "@/components/shared/CartesianViewport";
import { sampleEllipse, sampleHyperbolaBranch, sampleParabola } from "@/lib/math/geometry-render";
import { dataToPixelX, dataToPixelY, type Viewport } from "@/lib/math/viewport";

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
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
}

/**
 * Figuras geométricas sobre o motor compartilhado `CartesianViewport`
 * (dimensões, grade, eixos, pan/zoom/reset — mesma base de `/graficos`,
 * extraída nesta sprint). Este componente cuida só do que é específico
 * de Geometria: desenhar o `GeometryShape` já calculado a partir dos
 * NÚMEROS que o usuário digitou (nunca da resposta em texto do
 * backend) — cálculos e desenhos de triângulo/círculo/reta/parábola/
 * elipse/hipérbole intocados por esta sprint.
 */
export function GeometryCanvas({ shape, viewport, onViewportChange }: GeometryCanvasProps) {
  return (
    <CartesianViewport
      viewport={viewport}
      onViewportChange={onViewportChange}
      resetViewport={GEOMETRY_VIEWPORT}
      ariaLabel={shape ? `Construção geométrica: ${shape.kind}` : "Nenhuma figura para desenhar ainda"}
    >
      {({ viewport: renderViewport, width, height }) => (
        <>
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
        </>
      )}
    </CartesianViewport>
  );
}
