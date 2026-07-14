import { describe, expect, it } from "vitest";

import {
  buildGridValues,
  dataToPixelX,
  dataToPixelY,
  fitViewportToAspect,
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

describe("fitViewportToAspect", () => {
  it("expande o eixo x quando o container é proporcionalmente mais largo que os dados", () => {
    const result = fitViewportToAspect(VIEWPORT, 1200, 500);
    expect(result.yMin).toBe(-6);
    expect(result.yMax).toBe(6);
    expect(result.xMax - result.xMin).toBeCloseTo(12 * (1200 / 500));
  });

  it("expande o eixo y quando o container é proporcionalmente mais alto que os dados", () => {
    const square: Viewport = { xMin: -12, xMax: 12, yMin: -12, yMax: 12 };
    const result = fitViewportToAspect(square, 600, 900);
    expect(result.xMin).toBe(-12);
    expect(result.xMax).toBe(12);
    expect(result.yMax - result.yMin).toBeCloseTo(24 / (600 / 900));
  });

  it("preserva a escala igual nos dois eixos (não distorce círculos)", () => {
    const square: Viewport = { xMin: -12, xMax: 12, yMin: -12, yMax: 12 };
    const result = fitViewportToAspect(square, 900, 600);
    const scaleX = 900 / (result.xMax - result.xMin);
    const scaleY = 600 / (result.yMax - result.yMin);
    expect(scaleX).toBeCloseTo(scaleY);
  });

  it("não altera o viewport quando o container ainda não foi medido", () => {
    expect(fitViewportToAspect(VIEWPORT, 0, 0)).toEqual(VIEWPORT);
  });

  it("mantém o centro fixo", () => {
    const offCenter: Viewport = { xMin: -4, xMax: 16, yMin: -6, yMax: 6 };
    const result = fitViewportToAspect(offCenter, 1200, 400);
    expect((result.xMin + result.xMax) / 2).toBeCloseTo((offCenter.xMin + offCenter.xMax) / 2);
  });
});
