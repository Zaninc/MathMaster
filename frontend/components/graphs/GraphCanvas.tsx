"use client";

import { PointerEvent as ReactPointerEvent, useMemo, useRef, useState, WheelEvent as ReactWheelEvent } from "react";

import type { PlotFn } from "@/lib/math/plot-evaluator";
import {
  buildGridValues,
  dataToPixelX,
  dataToPixelY,
  DEFAULT_VIEWPORT,
  niceStep,
  panViewport,
  pixelToDataX,
  zoomViewport,
  type Viewport,
} from "@/lib/math/viewport";

import type { PlotFunction } from "./types";

const WIDTH = 800;
const HEIGHT = 480;
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

/**
 * Plano cartesiano próprio em SVG (não uma lib de "business charts" —
 * decisão da auditoria: Recharts/visx não são feitos para curva contínua
 * com pan/zoom). Amostragem síncrona (as funções já vêm compiladas do
 * `GraphsWorkspace`); pan/zoom via Pointer Events (unifica mouse e touch)
 * + botões de zoom (sem pinch-to-zoom nesta V1 — simplificação de escopo
 * documentada, os botões cobrem touch também).
 */
export function GraphCanvas({ functions, compiled, viewport, onViewportChange }: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragState = useRef<{ startClientX: number; startClientY: number; startViewport: Viewport } | null>(null);
  const [hover, setHover] = useState<HoverPoint | null>(null);

  const paths = useMemo(() => {
    const rangeSpan = viewport.yMax - viewport.yMin;
    return functions
      .filter((fn) => fn.visible)
      .map((fn) => {
        const evaluate = compiled.get(fn.id);
        if (!evaluate) return { id: fn.id, color: fn.color, d: "" };

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
          const px = dataToPixelX(x, viewport, WIDTH);
          const py = dataToPixelY(y, viewport, HEIGHT);
          d += `${penDown ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)} `;
          penDown = true;
        }
        return { id: fn.id, color: fn.color, d };
      });
  }, [functions, compiled, viewport]);

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

  function updateHoverFromClientPoint(clientX: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((clientX - rect.left) / rect.width) * WIDTH;
    const x = pixelToDataX(px, viewport, WIDTH);

    const firstVisible = functions.find((fn) => fn.visible && compiled.has(fn.id));
    if (!firstVisible) {
      setHover(null);
      return;
    }
    const y = compiled.get(firstVisible.id)!(x);
    if (!Number.isFinite(y)) {
      setHover(null);
      return;
    }
    setHover({
      x,
      y,
      pixelX: dataToPixelX(x, viewport, WIDTH),
      pixelY: dataToPixelY(y, viewport, HEIGHT),
      color: firstVisible.color,
    });
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    (event.target as Element).setPointerCapture(event.pointerId);
    dragState.current = { startClientX: event.clientX, startClientY: event.clientY, startViewport: viewport };
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    updateHoverFromClientPoint(event.clientX);

    const drag = dragState.current;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!drag || !rect) return;

    const dxPx = event.clientX - drag.startClientX;
    const dyPx = event.clientY - drag.startClientY;
    const dataPerPixelX = (drag.startViewport.xMax - drag.startViewport.xMin) / rect.width;
    const dataPerPixelY = (drag.startViewport.yMax - drag.startViewport.yMin) / rect.height;
    onViewportChange(panViewport(drag.startViewport, -dxPx * dataPerPixelX, dyPx * dataPerPixelY));
  }

  function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    dragState.current = null;
    (event.target as Element).releasePointerCapture(event.pointerId);
  }

  function handlePointerLeave() {
    dragState.current = null;
    setHover(null);
  }

  function handleWheel(event: ReactWheelEvent<SVGSVGElement>) {
    event.preventDefault();
    onViewportChange(zoomViewport(viewport, event.deltaY > 0 ? 1.1 : 0.9));
  }

  return (
    <div className="relative rounded-lg border border-border bg-surface">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Plano cartesiano com as funções plotadas. Use os botões de zoom ou arraste para navegar."
        className="w-full touch-none rounded-lg"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onWheel={handleWheel}
      >
        {xGridValues.map((x) => (
          <line
            key={`grid-x-${x}`}
            x1={dataToPixelX(x, viewport, WIDTH)}
            x2={dataToPixelX(x, viewport, WIDTH)}
            y1={0}
            y2={HEIGHT}
            stroke="var(--border)"
            strokeWidth={1}
          />
        ))}
        {yGridValues.map((y) => (
          <line
            key={`grid-y-${y}`}
            y1={dataToPixelY(y, viewport, HEIGHT)}
            y2={dataToPixelY(y, viewport, HEIGHT)}
            x1={0}
            x2={WIDTH}
            stroke="var(--border)"
            strokeWidth={1}
          />
        ))}

        {viewport.xMin <= 0 && viewport.xMax >= 0 && (
          <line
            x1={dataToPixelX(0, viewport, WIDTH)}
            x2={dataToPixelX(0, viewport, WIDTH)}
            y1={0}
            y2={HEIGHT}
            stroke="var(--text-muted)"
            strokeWidth={1.5}
          />
        )}
        {viewport.yMin <= 0 && viewport.yMax >= 0 && (
          <line
            y1={dataToPixelY(0, viewport, HEIGHT)}
            y2={dataToPixelY(0, viewport, HEIGHT)}
            x1={0}
            x2={WIDTH}
            stroke="var(--text-muted)"
            strokeWidth={1.5}
          />
        )}

        {xGridValues
          .filter((x) => x !== 0)
          .map((x) => (
            <text key={`label-x-${x}`} x={dataToPixelX(x, viewport, WIDTH) + 4} y={HEIGHT - 4} fontSize={11} fill="var(--text-muted)">
              {formatGridLabel(x)}
            </text>
          ))}
        {yGridValues
          .filter((y) => y !== 0)
          .map((y) => (
            <text key={`label-y-${y}`} x={4} y={dataToPixelY(y, viewport, HEIGHT) - 4} fontSize={11} fill="var(--text-muted)">
              {formatGridLabel(y)}
            </text>
          ))}

        {paths.map((path) => (
          <path key={path.id} d={path.d} fill="none" stroke={path.color} strokeWidth={2} />
        ))}

        {hover && <circle aria-hidden="true" cx={hover.pixelX} cy={hover.pixelY} r={4} fill={hover.color} />}
      </svg>

      {hover && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-md border border-border bg-surface-elevated px-2 py-1 text-xs text-text-primary"
          style={{
            left: `${(hover.pixelX / WIDTH) * 100}%`,
            top: `${(hover.pixelY / HEIGHT) * 100}%`,
            transform: "translate(-50%, -130%)",
          }}
        >
          ({formatGridLabel(hover.x)}, {formatGridLabel(hover.y)})
        </div>
      )}

      <div className="absolute right-3 top-3 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => onViewportChange(zoomViewport(viewport, 0.8))}
          aria-label="Aumentar zoom"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-elevated text-text-primary hover:border-border-hover"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => onViewportChange(zoomViewport(viewport, 1.25))}
          aria-label="Diminuir zoom"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-elevated text-text-primary hover:border-border-hover"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => onViewportChange(DEFAULT_VIEWPORT)}
          aria-label="Redefinir câmera"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-elevated text-text-primary hover:border-border-hover"
        >
          ⟲
        </button>
      </div>
    </div>
  );
}
