import { describe, expect, it } from "vitest";

import {
  buildGridValues,
  dataToPixelX,
  dataToPixelY,
  niceStep,
  panViewport,
  pixelToDataX,
  pixelToDataY,
  zoomViewport,
  type Viewport,
} from "./viewport";

const VIEWPORT: Viewport = { xMin: -10, xMax: 10, yMin: -6, yMax: 6 };

describe("panViewport", () => {
  it("desloca os quatro limites pelo mesmo delta", () => {
    expect(panViewport(VIEWPORT, 2, -1)).toEqual({ xMin: -8, xMax: 12, yMin: -7, yMax: 5 });
  });
});

describe("zoomViewport", () => {
  it("reduz a janela mantendo o centro ao aproximar (factor < 1)", () => {
    const result = zoomViewport(VIEWPORT, 0.5);
    expect(result).toEqual({ xMin: -5, xMax: 5, yMin: -3, yMax: 3 });
  });

  it("amplia a janela mantendo o centro ao afastar (factor > 1)", () => {
    const result = zoomViewport(VIEWPORT, 2);
    expect(result).toEqual({ xMin: -20, xMax: 20, yMin: -12, yMax: 12 });
  });
});

describe("conversões pixel <-> dado", () => {
  it("dataToPixelX/pixelToDataX são inversas", () => {
    const px = dataToPixelX(3, VIEWPORT, 800);
    expect(pixelToDataX(px, VIEWPORT, 800)).toBeCloseTo(3);
  });

  it("dataToPixelY/pixelToDataY são inversas", () => {
    const py = dataToPixelY(-2, VIEWPORT, 480);
    expect(pixelToDataY(py, VIEWPORT, 480)).toBeCloseTo(-2);
  });

  it("eixo Y é invertido (y maior -> pixel menor)", () => {
    expect(dataToPixelY(6, VIEWPORT, 480)).toBe(0);
    expect(dataToPixelY(-6, VIEWPORT, 480)).toBe(480);
  });
});

describe("niceStep", () => {
  it("escolhe um passo redondo (1/2/5 × 10ⁿ) para o intervalo", () => {
    expect(niceStep(20)).toBe(5);
    expect(niceStep(100)).toBe(20);
  });
});

describe("buildGridValues", () => {
  it("gera valores igualmente espaçados dentro do intervalo", () => {
    expect(buildGridValues(-10, 10, 5)).toEqual([-10, -5, 0, 5, 10]);
  });
});
