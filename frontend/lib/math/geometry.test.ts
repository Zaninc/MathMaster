import { describe, expect, it } from "vitest";

import {
  circleArea,
  circleCircumference,
  classifyTriangleByAngle,
  classifyTriangleBySides,
  distance,
  isValidTriangle,
  triangleArea,
  trianglePerimeter,
} from "./geometry";

describe("distance", () => {
  it("calcula a distância euclidiana entre dois pontos", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe("triangleArea", () => {
  it("calcula a área de um triângulo retângulo simples (base=8, altura=5, via vértices)", () => {
    expect(triangleArea({ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 5 })).toBe(20);
  });
});

describe("trianglePerimeter", () => {
  it("soma os três lados", () => {
    expect(trianglePerimeter({ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 4 })).toBe(12);
  });
});

describe("classifyTriangleBySides", () => {
  it("identifica equilátero", () => {
    expect(classifyTriangleBySides({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: Math.sqrt(3) })).toBe("equilátero");
  });

  it("identifica isósceles", () => {
    expect(classifyTriangleBySides({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 })).toBe("isósceles");
  });

  it("identifica escaleno", () => {
    expect(classifyTriangleBySides({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 1, y: 4 })).toBe("escaleno");
  });
});

describe("classifyTriangleByAngle", () => {
  it("identifica retângulo (3-4-5)", () => {
    expect(classifyTriangleByAngle({ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 4 })).toBe("retângulo");
  });

  it("identifica obtusângulo", () => {
    expect(classifyTriangleByAngle({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 0.5 })).toBe("obtusângulo");
  });

  it("identifica acutângulo (equilátero)", () => {
    expect(classifyTriangleByAngle({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: Math.sqrt(3) })).toBe("acutângulo");
  });
});

describe("isValidTriangle", () => {
  it("rejeita pontos colineares", () => {
    expect(isValidTriangle({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 })).toBe(false);
  });

  it("aceita um triângulo com área positiva", () => {
    expect(isValidTriangle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 })).toBe(true);
  });
});

describe("círculo", () => {
  it("calcula área (πr²)", () => {
    expect(circleArea(4)).toBeCloseTo(16 * Math.PI);
  });

  it("calcula comprimento (2πr)", () => {
    expect(circleCircumference(4)).toBeCloseTo(8 * Math.PI);
  });
});
