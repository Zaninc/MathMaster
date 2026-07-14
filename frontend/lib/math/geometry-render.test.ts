import { describe, expect, it } from "vitest";

import { sampleEllipse, sampleHyperbolaBranch, sampleParabola } from "./geometry-render";

const VIEWPORT = { xMin: -12, xMax: 12, yMin: -12, yMax: 12 };

describe("sampleParabola", () => {
  it("passa pelo vértice quando o eixo é vertical", () => {
    const points = sampleParabola({ x: 0, y: 0 }, { x: 0, y: 2 }, VIEWPORT);
    const atVertex = points.find((p) => Math.abs(p.x) < 1e-6);
    expect(atVertex?.y).toBeCloseTo(0);
  });

  it("abre para cima quando o foco está acima do vértice", () => {
    const points = sampleParabola({ x: 0, y: 0 }, { x: 0, y: 2 }, VIEWPORT);
    expect(points.every((p) => p.y >= -1e-6)).toBe(true);
  });

  it("retorna vazio quando o foco está fora dos eixos (diagonal)", () => {
    expect(sampleParabola({ x: 0, y: 0 }, { x: 1, y: 1 }, VIEWPORT)).toEqual([]);
  });
});

describe("sampleEllipse", () => {
  it("começa no ponto (centro.x + a, centro.y)", () => {
    const points = sampleEllipse({ x: 1, y: 2 }, 5, 3);
    expect(points[0].x).toBeCloseTo(6);
    expect(points[0].y).toBeCloseTo(2);
  });
});

describe("sampleHyperbolaBranch", () => {
  it("o ramo direito nunca cruza x = centro.x + a", () => {
    const points = sampleHyperbolaBranch({ x: 0, y: 0 }, 3, 2, 1);
    expect(points.every((p) => p.x >= 3 - 1e-9)).toBe(true);
  });

  it("o ramo esquerdo nunca cruza x = centro.x - a", () => {
    const points = sampleHyperbolaBranch({ x: 0, y: 0 }, 3, 2, -1);
    expect(points.every((p) => p.x <= -3 + 1e-9)).toBe(true);
  });
});
