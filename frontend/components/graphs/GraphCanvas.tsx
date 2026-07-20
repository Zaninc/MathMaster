"use client";

import { useState } from "react";

import { CartesianViewport, type CartesianRenderContext } from "@/components/shared/CartesianViewport";
import type { PlotFn } from "@/lib/math/plot-evaluator";
import { dataToPixelX, dataToPixelY, DEFAULT_VIEWPORT, type Viewport } from "@/lib/math/viewport";

import type { PlotFunction } from "./types";

const SAMPLE_COUNT = 400;

interface GraphCanvasProps {
  functions: PlotFunction[];
  compiled: Map<string, PlotFn>;
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
}

interface HoverPoint {
  x: number;
  y: number;
  pixelX: number;
  pixelY: number;
  color: string;
}

function formatGridLabel(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function samplePath(
  evaluate: PlotFn,
  context: CartesianRenderContext
): string {
  const { viewport, width, height } = context;
  const rangeSpan = viewport.yMax - viewport.yMin;
  let d = "";
  let penDown = false;
  for (let i = 0; i <= SAMPLE_COUNT; i += 1) {
    const x = viewport.xMin + (i / SAMPLE_COUNT) * (viewport.xMax - viewport.xMin);
    const y = evaluate(x);
    const withinRange = Number.isFinite(y) && y >= viewport.yMin - rangeSpan && y <= viewport.yMax + rangeSpan;
    if (!withinRange) {
      penDown = false;
      continue;
    }
    const px = dataToPixelX(x, viewport, width);
    const py = dataToPixelY(y, viewport, height);
    d += `${penDown ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)} `;
    penDown = true;
  }
  return d;
}

/**
 * Curvas de função sobre o motor compartilhado `CartesianViewport`
 * (dimensões, grade, eixos, pan/zoom/reset — extraído nesta sprint pra
 * `/geometria` reaproveitar). Este componente cuida só do que é
 * específico de Gráficos: amostragem síncrona das funções já compiladas
 * (vindas do `GraphsWorkspace`) e o tooltip de hover no ponto mais
 * próximo do cursor.
 */
export function GraphCanvas({ functions, compiled, viewport, onViewportChange }: GraphCanvasProps) {
  const [hover, setHover] = useState<HoverPoint | null>(null);

  function handlePointerMove(dataX: number, context: CartesianRenderContext) {
    const firstVisible = functions.find((fn) => fn.visible && compiled.has(fn.id));
    if (!firstVisible) {
      setHover(null);
      return;
    }
    const y = compiled.get(firstVisible.id)!(dataX);
    if (!Number.isFinite(y)) {
      setHover(null);
      return;
    }
    setHover({
      x: dataX,
      y,
      pixelX: dataToPixelX(dataX, context.viewport, context.width),
      pixelY: dataToPixelY(y, context.viewport, context.height),
      color: firstVisible.color,
    });
  }

  return (
    <CartesianViewport
      viewport={viewport}
      onViewportChange={onViewportChange}
      resetViewport={DEFAULT_VIEWPORT}
      ariaLabel="Plano cartesiano com as funções plotadas. Use os botões de zoom ou arraste para navegar."
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setHover(null)}
      overlay={({ width, height }) =>
        hover && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-md border border-border bg-surface-elevated px-2 py-1 text-xs text-text-primary"
            style={{
              left: `${(hover.pixelX / width) * 100}%`,
              top: `${(hover.pixelY / height) * 100}%`,
              transform: "translate(-50%, -130%)",
            }}
          >
            ({formatGridLabel(hover.x)}, {formatGridLabel(hover.y)})
          </div>
        )
      }
    >
      {(context) => (
        <>
          {functions
            .filter((fn) => fn.visible)
            .map((fn) => {
              const evaluate = compiled.get(fn.id);
              return (
                <path
                  key={fn.id}
                  d={evaluate ? samplePath(evaluate, context) : ""}
                  fill="none"
                  stroke={fn.color}
                  strokeWidth={2}
                />
              );
            })}
          {hover && <circle aria-hidden="true" cx={hover.pixelX} cy={hover.pixelY} r={4} fill={hover.color} />}
        </>
      )}
    </CartesianViewport>
  );
}
