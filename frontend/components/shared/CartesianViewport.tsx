"use client";

import { PointerEvent as ReactPointerEvent, ReactNode, useMemo, useRef, WheelEvent as ReactWheelEvent } from "react";

import { useElementSize } from "@/hooks/useElementSize";
import {
  buildGridValues,
  dataToPixelX,
  dataToPixelY,
  fitViewportToAspect,
  niceStep,
  panViewport,
  pixelToDataX,
  zoomViewport,
  type Viewport,
} from "@/lib/math/viewport";

function formatGridLabel(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export interface CartesianRenderContext {
  /** Viewport JÁ ajustado à proporção real do container (`fitViewportToAspect`) — use este, não o `viewport` bruto, para desenhar. */
  viewport: Viewport;
  width: number;
  height: number;
}

export interface CartesianViewportProps {
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
  /** Viewport restaurado pelo botão "Redefinir câmera" — cada consumidor define seu próprio (funções vs. geometria têm escalas naturais diferentes). */
  resetViewport: Viewport;
  ariaLabel: string;
  /** Coordenada X (espaço de dados) sob o cursor a cada movimento — para hover/tooltip específico do consumidor (ex. Gráficos). */
  onPointerMove?: (dataX: number, context: CartesianRenderContext) => void;
  onPointerLeave?: () => void;
  /** Conteúdo SVG específico do domínio (curvas, figuras), desenhado por cima da grade/eixos. */
  children?: (context: CartesianRenderContext) => ReactNode;
  /** Conteúdo HTML sobreposto ao canvas (ex. tooltip de hover) — fora do `<svg>`, posicionado com `context.width/height`. */
  overlay?: (context: CartesianRenderContext) => ReactNode;
}

/**
 * Motor compartilhado de visualização cartesiana — dimensões/escala,
 * grade, eixos, pan (arraste) e zoom (scroll + botões) + reset. Extraído
 * de `GraphCanvas` (Sprint "Unificar interação /graficos e /geometria")
 * pra `/geometria` ganhar a mesma navegação sem duplicar a lógica de
 * pan/zoom — cada página continua responsável só pelo que desenha por
 * cima (curvas de função vs. figuras geométricas), via `children`.
 *
 * `lib/math/viewport.ts` (pan/zoom/transformação pixel<->dado) já era
 * compartilhado antes desta sprint; o que faltava compartilhar era a
 * CASCA interativa (SVG, eventos de ponteiro/roda, botões) — é isso que
 * este componente fecha.
 */
export function CartesianViewport({
  viewport,
  onViewportChange,
  resetViewport,
  ariaLabel,
  onPointerMove,
  onPointerLeave,
  children,
  overlay,
}: CartesianViewportProps) {
  const [containerRef, { width, height }] = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragState = useRef<{ startClientX: number; startClientY: number; startViewport: Viewport } | null>(null);

  const measured = width > 0 && height > 0;
  const renderViewport = useMemo(
    () => (measured ? fitViewportToAspect(viewport, width, height) : viewport),
    [viewport, width, height, measured]
  );
  const context: CartesianRenderContext = { viewport: renderViewport, width, height };

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

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    (event.target as Element).setPointerCapture(event.pointerId);
    dragState.current = { startClientX: event.clientX, startClientY: event.clientY, startViewport: viewport };
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (onPointerMove && measured) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        const px = ((event.clientX - rect.left) / rect.width) * width;
        onPointerMove(pixelToDataX(px, renderViewport, width), context);
      }
    }

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
    onPointerLeave?.();
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
          aria-label={ariaLabel}
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

          {children?.(context)}
        </svg>
      )}

      {measured && overlay?.(context)}

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
          onClick={() => onViewportChange(resetViewport)}
          aria-label="Redefinir câmera"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-elevated text-text-primary transition-colors duration-(--motion-fast) hover:border-border-hover"
        >
          ⟲
        </button>
      </div>
    </div>
  );
}
