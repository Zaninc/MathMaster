import type { Point } from "@/lib/math/geometry";
import { dataToPixelX, dataToPixelY, type Viewport } from "@/lib/math/viewport";

import type { GeometryShape } from "./types";

/**
 * Marcações visuais (pontos, rótulos, segmentos auxiliares) sobre as
 * figuras de `/geometria` — deliberadamente separado de `lib/math/
 * geometry.ts`/`geometry-render.ts` (cálculo/amostragem) e de
 * `GeometryCanvas.tsx` (desenho da figura em si): este arquivo só sabe
 * transformar coordenadas em pixel (via `lib/math/viewport.ts`,
 * reaproveitado, nunca reimplementado) e posicionar texto/marcadores.
 * Nenhuma fórmula geométrica vive aqui.
 */

export interface MarkerContext {
  viewport: Viewport;
  width: number;
  height: number;
}

function formatCoord(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function centroidOf(points: Point[]): Point {
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

const LABEL_DISTANCE_PX = 14;

/** Direção (em pixels) pra afastar o rótulo de um ponto de referência (ex. centroide) — evita sobrepor a figura. */
function labelOffset(point: Point, awayFrom: Point): { dx: number; dy: number } {
  const dx = point.x - awayFrom.x;
  const dy = point.y - awayFrom.y;
  const length = Math.hypot(dx, dy) || 1;
  // Y de dados é invertido no pixel (dataToPixelY sobe = pixel desce) — negado aqui pra manter "afastar" correto na tela.
  return { dx: (dx / length) * LABEL_DISTANCE_PX, dy: (-dy / length) * LABEL_DISTANCE_PX };
}

interface PointMarkerProps {
  point: Point;
  context: MarkerContext;
  label?: string;
  /** Ponto de referência pra calcular a direção do rótulo (ex. centroide/centro) — sem isso, offset fixo (cima-direita). */
  awayFrom?: Point;
  showCoords?: boolean;
}

/** Um ponto marcado (bolinha) com rótulo textual opcional — vértices, focos, centro, extremos de reta. */
export function PointMarker({ point, context, label, awayFrom, showCoords }: PointMarkerProps) {
  const { viewport, width, height } = context;
  const px = dataToPixelX(point.x, viewport, width);
  const py = dataToPixelY(point.y, viewport, height);
  const offset = awayFrom ? labelOffset(point, awayFrom) : { dx: 8, dy: -8 };
  const anchor = offset.dx < 0 ? "end" : "start";

  return (
    <g>
      <circle cx={px} cy={py} r={4} fill="var(--text-primary)" stroke="var(--surface)" strokeWidth={1.5} />
      {label && (
        <text
          x={px + offset.dx}
          y={py + offset.dy}
          fontSize={12}
          fontWeight={600}
          fill="var(--text-primary)"
          textAnchor={anchor}
        >
          {label}
        </text>
      )}
      {showCoords && (
        <text x={px + offset.dx} y={py + offset.dy + 13} fontSize={10} fill="var(--text-muted)" textAnchor={anchor}>
          ({formatCoord(point.x)}, {formatCoord(point.y)})
        </text>
      )}
    </g>
  );
}

const SEGMENT_LABEL_OFFSET_PX = 12;

interface AxisSegmentProps {
  from: Point;
  to: Point;
  label: string;
  context: MarkerContext;
  dashed?: boolean;
  /**
   * "midpoint" (padrão): rótulo no meio do segmento — bom quando `from`
   * é o centro (raio do círculo, semieixos de elipse). "end": rótulo
   * deslocado pra além de `to` — necessário quando o meio do segmento
   * cairia perto demais de outro marcador (ex. o segmento `a` da
   * hipérbole vai de vértice a vértice PASSANDO pelo centro, então o
   * meio dele é literalmente o centro).
   */
  labelAnchor?: "midpoint" | "end";
}

/** Segmento auxiliar rotulado (raio do círculo, semieixos de elipse/hipérbole). */
export function AxisSegment({ from, to, label, context, dashed, labelAnchor = "midpoint" }: AxisSegmentProps) {
  const { viewport, width, height } = context;
  const x1 = dataToPixelX(from.x, viewport, width);
  const y1 = dataToPixelY(from.y, viewport, height);
  const x2 = dataToPixelX(to.x, viewport, width);
  const y2 = dataToPixelY(to.y, viewport, height);

  let labelX: number;
  let labelY: number;
  let textAnchor: "start" | "end";
  if (labelAnchor === "end") {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) || 1;
    labelX = x2 + (dx / length) * SEGMENT_LABEL_OFFSET_PX;
    labelY = y2 + (dy / length) * SEGMENT_LABEL_OFFSET_PX;
    textAnchor = dx >= 0 ? "start" : "end";
  } else {
    labelX = (x1 + x2) / 2 + 6;
    labelY = (y1 + y2) / 2 - 6;
    textAnchor = "start";
  }

  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="var(--text-muted)"
        strokeWidth={1.5}
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      <text x={labelX} y={labelY} fontSize={11} fill="var(--text-secondary)" textAnchor={textAnchor}>
        {label}
      </text>
    </g>
  );
}

export function TriangleMarkers({
  shape,
  context,
}: {
  shape: Extract<GeometryShape, { kind: "triangle" }>;
  context: MarkerContext;
}) {
  const [a, b, c] = shape.points;
  const centroid = centroidOf(shape.points);
  return (
    <>
      <PointMarker point={a} label="A" awayFrom={centroid} showCoords context={context} />
      <PointMarker point={b} label="B" awayFrom={centroid} showCoords context={context} />
      <PointMarker point={c} label="C" awayFrom={centroid} showCoords context={context} />
    </>
  );
}

export function CircleMarkers({
  shape,
  context,
}: {
  shape: Extract<GeometryShape, { kind: "circle" }>;
  context: MarkerContext;
}) {
  const edge = { x: shape.center.x + shape.radius, y: shape.center.y };
  return (
    <>
      <PointMarker point={shape.center} label="Centro" context={context} />
      <AxisSegment from={shape.center} to={edge} label={`r = ${formatCoord(shape.radius)}`} context={context} />
    </>
  );
}

export function LineMarkers({
  shape,
  context,
}: {
  shape: Extract<GeometryShape, { kind: "line" }>;
  context: MarkerContext;
}) {
  const mid = { x: (shape.p1.x + shape.p2.x) / 2, y: (shape.p1.y + shape.p2.y) / 2 };
  return (
    <>
      <PointMarker point={shape.p1} label="P1" awayFrom={mid} context={context} />
      <PointMarker point={shape.p2} label="P2" awayFrom={mid} context={context} />
    </>
  );
}

export function ParabolaMarkers({
  shape,
  context,
}: {
  shape: Extract<GeometryShape, { kind: "parabola" }>;
  context: MarkerContext;
}) {
  return (
    <>
      <PointMarker point={shape.vertex} label="Vértice" awayFrom={shape.focus} context={context} />
      <PointMarker point={shape.focus} label="Foco" awayFrom={shape.vertex} context={context} />
    </>
  );
}

/** `a` = semieixo maior (eixo x), `b` = semieixo menor (eixo y) — mesma convenção de `sampleEllipse`. */
export function EllipseMarkers({
  shape,
  context,
}: {
  shape: Extract<GeometryShape, { kind: "ellipse" }>;
  context: MarkerContext;
}) {
  const majorEnd = { x: shape.center.x + shape.a, y: shape.center.y };
  const minorEnd = { x: shape.center.x, y: shape.center.y + shape.b };
  return (
    <>
      <PointMarker point={shape.center} label="Centro" context={context} />
      <AxisSegment from={shape.center} to={majorEnd} label={`a = ${formatCoord(shape.a)}`} context={context} dashed />
      <AxisSegment from={shape.center} to={minorEnd} label={`b = ${formatCoord(shape.b)}`} context={context} dashed />
    </>
  );
}

/** Eixo transverso sempre paralelo a x (mesma convenção de `sampleHyperbolaBranch`) — vértices reais em center±a. */
export function HyperbolaMarkers({
  shape,
  context,
}: {
  shape: Extract<GeometryShape, { kind: "hyperbola" }>;
  context: MarkerContext;
}) {
  const vertexRight = { x: shape.center.x + shape.a, y: shape.center.y };
  const vertexLeft = { x: shape.center.x - shape.a, y: shape.center.y };
  const bEnd = { x: shape.center.x, y: shape.center.y + shape.b };
  return (
    <>
      <PointMarker point={shape.center} label="Centro" context={context} />
      {/* labelAnchor="end": o segmento a vai de vértice a vértice PASSANDO
          pelo centro — o meio dele é o próprio centro, então o rótulo é
          ancorado perto do vértice direito em vez do meio do segmento. */}
      <AxisSegment
        from={vertexLeft}
        to={vertexRight}
        label={`a = ${formatCoord(shape.a)}`}
        context={context}
        labelAnchor="end"
      />
      <AxisSegment
        from={shape.center}
        to={bEnd}
        label={`b = ${formatCoord(shape.b)}`}
        context={context}
        dashed
        labelAnchor="end"
      />
      <PointMarker point={vertexRight} context={context} />
      <PointMarker point={vertexLeft} context={context} />
    </>
  );
}
