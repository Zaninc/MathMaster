import type { Point } from "./geometry";
import type { Viewport } from "./viewport";

const EPS = 1e-6;

/**
 * Amostra pontos de uma parábola a partir de vértice+foco — só eixo
 * vertical ou horizontal (mesma restrição que `analytic_geometry/` impõe
 * no backend: foco fora dos eixos é rejeitado, aqui simplesmente não
 * desenhamos nada em vez de adivinhar uma orientação).
 */
export function sampleParabola(vertex: Point, focus: Point, viewport: Viewport, steps = 200): Point[] {
  const dx = focus.x - vertex.x;
  const dy = focus.y - vertex.y;

  if (Math.abs(dx) < EPS && Math.abs(dy) > EPS) {
    const p = dy;
    const points: Point[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const x = viewport.xMin + (i / steps) * (viewport.xMax - viewport.xMin);
      points.push({ x, y: vertex.y + (x - vertex.x) ** 2 / (4 * p) });
    }
    return points;
  }

  if (Math.abs(dy) < EPS && Math.abs(dx) > EPS) {
    const p = dx;
    const points: Point[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const y = viewport.yMin + (i / steps) * (viewport.yMax - viewport.yMin);
      points.push({ x: vertex.x + (y - vertex.y) ** 2 / (4 * p), y });
    }
    return points;
  }

  return [];
}

export function sampleEllipse(center: Point, a: number, b: number, steps = 100): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    points.push({ x: center.x + a * Math.cos(t), y: center.y + b * Math.sin(t) });
  }
  return points;
}

/** Um ramo (direito: sign=1, esquerdo: sign=-1) de uma hipérbole com eixo transverso paralelo a x. */
export function sampleHyperbolaBranch(
  center: Point,
  a: number,
  b: number,
  sign: 1 | -1,
  steps = 100,
  tMax = 2
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = -tMax + (i / steps) * (2 * tMax);
    points.push({ x: center.x + sign * a * Math.cosh(t), y: center.y + b * Math.sinh(t) });
  }
  return points;
}
