/**
 * Fórmulas elementares e determinísticas (triângulo, círculo) — decisão da
 * auditoria da Sprint Frontend V1 (Etapa 4): calculadas no frontend
 * porque são fixas, sem ambiguidade, e pedagógicas (mostram a
 * substituição). Qualquer operação simbólica ou de geometria analítica
 * (reta, circunferência, parábola, elipse, hipérbole, distância, ponto
 * médio, coeficiente angular) usa o backend real — nunca reimplementada
 * aqui. Ver `components/geometry/GeometryWorkspace.tsx` para onde essa
 * fronteira é aplicada.
 */

export interface Point {
  x: number;
  y: number;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function triangleArea(a: Point, b: Point, c: Point): number {
  return Math.abs(a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2;
}

export function trianglePerimeter(a: Point, b: Point, c: Point): number {
  return distance(a, b) + distance(b, c) + distance(c, a);
}

export type TriangleSideClass = "equilátero" | "isósceles" | "escaleno";
export type TriangleAngleClass = "retângulo" | "acutângulo" | "obtusângulo";

const EPS = 1e-6;

export function classifyTriangleBySides(a: Point, b: Point, c: Point): TriangleSideClass {
  const [s1, s2, s3] = [distance(a, b), distance(b, c), distance(c, a)];
  const equal = (x: number, y: number) => Math.abs(x - y) < EPS;
  if (equal(s1, s2) && equal(s2, s3)) return "equilátero";
  if (equal(s1, s2) || equal(s2, s3) || equal(s1, s3)) return "isósceles";
  return "escaleno";
}

export function classifyTriangleByAngle(a: Point, b: Point, c: Point): TriangleAngleClass {
  const [s1, s2, s3] = [distance(b, c), distance(a, c), distance(a, b)].sort((x, y) => x - y);
  const lhsSquared = s3 * s3;
  const rhsSquared = s1 * s1 + s2 * s2;
  if (Math.abs(lhsSquared - rhsSquared) < EPS) return "retângulo";
  return lhsSquared > rhsSquared ? "obtusângulo" : "acutângulo";
}

export function isValidTriangle(a: Point, b: Point, c: Point): boolean {
  return triangleArea(a, b, c) > EPS;
}

export function circleArea(radius: number): number {
  return Math.PI * radius * radius;
}

export function circleCircumference(radius: number): number {
  return 2 * Math.PI * radius;
}
