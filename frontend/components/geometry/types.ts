import type { Point } from "@/lib/math/geometry";

/**
 * Descreve APENAS o que desenhar, a partir dos mesmos números que o
 * usuário digitou no formulário — nunca derivado da resposta em texto do
 * backend (que é só exibida, não re-interpretada). Puramente geométrico
 * (desenhar um círculo dado centro+raio não é "resolver" nada), nunca
 * duplica classificação/equação simbólica, que vem sempre do backend.
 */
export type GeometryShape =
  | { kind: "triangle"; points: [Point, Point, Point] }
  | { kind: "circle"; center: Point; radius: number }
  | { kind: "line"; p1: Point; p2: Point }
  | { kind: "parabola"; vertex: Point; focus: Point }
  | { kind: "ellipse"; center: Point; a: number; b: number }
  | { kind: "hyperbola"; center: Point; a: number; b: number };
