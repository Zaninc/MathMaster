"use client";

import { PointerEvent as ReactPointerEvent, useMemo, useRef, useState, WheelEvent as ReactWheelEvent } from "react";

import { useElementSize } from "@/hooks/useElementSize";
import type { PlotFn } from "@/lib/math/plot-evaluator";
import {
  buildGridValues,
  dataToPixelX,
  dataToPixelY,
  DEFAULT_VIEWPORT,
  fitViewportToAspect,
  niceStep,
  panViewport,
  pixelToDataX,
  zoomViewport,
  type Viewport,
} from "@/lib/math/viewport";

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

/**
 * Plano cartesiano próprio em SVG (não uma lib de "business charts" —
 * decisão da auditoria: Recharts/visx não são feitos para curva contínua
 * com pan/zoom). Amostragem síncrona (as funções já vêm compiladas do
 * `GraphsWorkspace`); pan/zoom via Pointer Events (unifica mouse e touch)
 * + botões de zoom (sem pinch-to-zoom nesta V1 — simplificação de escopo
 * documentada, os botões cobrem touch também).
 *
 * Hotfix de alinhamento: o container é medido via `useElementSize`
 * (`ResizeObserver`) em vez de um `viewBox` fixo pequeno — o `viewBox`
 * passa a usar as dimensões REAIS em pixels, então o canvas sempre
 * preenche 100% do espaço disponível. `fitViewportToAspect` expande (só
 * para renderização, nunca muda o viewport "lógico" que pan/zoom
 * controla) o eixo de dados que sobra para casar com a proporção real em
 * pixels, sem distorcer círculos/curvas.
 */
export function GraphCanvas({ functions, compiled, viewport, onViewportChange }: GraphCanvasProps) {
  const [containerRef, { width, height }] = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragState = useRef<{ startClientX: number; startClientY: number; startViewport: Viewport } | null>(null);
  const [hover, setHover] = useState<HoverPoint | null>(null);

  const measured = width > 0 && height > 0;
  const renderViewport = useMemo(
    () => (measured ? fitViewportToAspect(viewport, width, height) : viewport),
    [viewport, width, height, measured]
  );

  const paths = useMemo(() => {
    if (!measured) return [];
    const rangeSpan = renderViewport.yMax - renderViewport.yMin;
    return functions
      .filter((fn) => fn.visible)
      .map((fn) => {
        const evaluate = compiled.get(fn.id);
        if (!evaluate) return { id: fn.id, color: fn.color, d: "" };

        let d = "";
        let penDown = false;
        for (let i = 0; i <= SAMPLE_COUNT; i += 1) {
          const x = renderViewport.xMin + (i / SAMPLE_COUNT) * (renderViewport.xMax - renderViewport.xMin);
          const y = evaluate(x);
          const withinRange =
            Number.isFinite(y) && y >= renderViewport.yMin - rangeSpan && y <= renderViewport.yMax + rangeSpan;
          if (!withinRange) {
            penDown = false;
            continue;
          }
          const px = dataToPixelX(x, renderViewport, width);
          const py = dataToPixelY(y, renderViewport, height);
          d += `${penDown ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)} `;
          penDown = true;
        }
        return { id: fn.id, color: fn.color, d };
      });
  }, [functions, compiled, renderViewport, measured, width, height]);

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

  function updateHoverFromClientPoint(clientX: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !measured) return;
    const px = ((clientX - rect.left) / rect.width) * width;
    const x = pixelToDataX(px, renderViewport, width);

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
      pixelX: dataToPixelX(x, renderViewport, width),
      pixelY: dataToPixelY(y, renderViewport, height),
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
    const startRenderViewport = measured ? fitViewportToAspect(drag.startViewport, width, height) : drag.startViewport;
    const dataPerPixelX = (startRenderViewport.xMax - startRenderViewport.xMin) / rect.width;
    const dataPerPixelY = (startRenderViewport.yMax - startRenderViewport.yMin) / rect.height;
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
    <div
      ref={containerRef}
      className="relative h-[clamp(520px,68vh,760px)] w-full overflow-hidden rounded-lg border border-border bg-surface"
    >
      {measured && (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Plano cartesiano com as funções plotadas. Use os botões de zoom ou arraste para navegar."
          className="h-full w-full touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onWheel={handleWheel}
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

          {renderViewport.xMin <= 0 && renderViewport.xMax >= 0 && (
            <line
              x1={dataToPixelX(0, renderViewport, width)}
              x2={dataToPixelX(0, renderViewport, width)}
              y1={0}
              y2={height}
              stroke="var(--text-muted)"
              strokeWidth={1.5}
            />
          )}
          {renderViewport.yMin <= 0 && renderViewport.yMax >= 0 && (
            <line
              y1={dataToPixelY(0, renderViewport, height)}
              y2={dataToPixelY(0, renderViewport, height)}
              x1={0}
              x2={width}
              stroke="var(--text-muted)"
              strokeWidth={1.5}
            />
          )}

          {xGridValues
            .filter((x) => x !== 0)
            .map((x) => (
              <text
                key={`label-x-${x}`}
                x={dataToPixelX(x, renderViewport, width) + 4}
                y={height - 4}
                fontSize={11}
                fill="var(--text-muted)"
              >
                {formatGridLabel(x)}
              </text>
            ))}
          {yGridValues
            .filter((y) => y !== 0)
            .map((y) => (
              <text
                key={`label-y-${y}`}
                x={4}
                y={dataToPixelY(y, renderViewport, height) - 4}
                fontSize={11}
                fill="var(--text-muted)"
              >
                {formatGridLabel(y)}
              </text>
            ))}

          {paths.map((path) => (
            <path key={path.id} d={path.d} fill="none" stroke={path.color} strokeWidth={2} />
          ))}

          {hover && <circle aria-hidden="true" cx={hover.pixelX} cy={hover.pixelY} r={4} fill={hover.color} />}
        </svg>
      )}

      {hover && measured && (
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
      )}

      <div className="absolute right-3 top-3 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => onViewportChange(zoomViewport(viewport, 0.8))}
          aria-label="Aumentar zoom"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-elevated text-text-primary transition-colors duration-(--motion-fast) hover:border-border-hover"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => onViewportChange(zoomViewport(viewport, 1.25))}
          aria-label="Diminuir zoom"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-elevated text-text-primary transition-colors duration-(--motion-fast) hover:border-border-hover"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => onViewportChange(DEFAULT_VIEWPORT)}
          aria-label="Redefinir câmera"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-elevated text-text-primary transition-colors duration-(--motion-fast) hover:border-border-hover"
        >
          ⟲
        </button>
      </div>
    </div>
  );
}
