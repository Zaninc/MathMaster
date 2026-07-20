import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { compilePlotFunction } from "@/lib/math/plot-evaluator";
import { DEFAULT_VIEWPORT, type Viewport } from "@/lib/math/viewport";

import { GraphCanvas } from "./GraphCanvas";
import type { PlotFunction } from "./types";

type ResizeCallback = (entries: Array<{ contentRect: { width: number; height: number } }>) => void;
let observedCallback: ResizeCallback | null = null;

class MockResizeObserver {
  callback: ResizeCallback;
  constructor(callback: ResizeCallback) {
    this.callback = callback;
    observedCallback = callback;
  }
  observe() {}
  disconnect() {}
}

function measure(width = 800, height = 600) {
  act(() => {
    observedCallback?.([{ contentRect: { width, height } }]);
  });
}

const IDENTITY: PlotFunction = { id: "fn-1", expression: "x", color: "#3d6eff", visible: true };

describe("GraphCanvas", () => {
  beforeEach(() => {
    observedCallback = null;
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = vi.fn();
      Element.prototype.releasePointerCapture = vi.fn();
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("desenha um path pra função visível compilada", () => {
    const compiled = new Map([["fn-1", (x: number) => x]]);
    const { container } = render(
      <GraphCanvas functions={[IDENTITY]} compiled={compiled} viewport={DEFAULT_VIEWPORT} onViewportChange={vi.fn()} />
    );
    measure();

    const path = container.querySelector("path");
    expect(path).not.toBeNull();
    expect(path?.getAttribute("stroke")).toBe("#3d6eff");
    expect(path?.getAttribute("d")).not.toBe("");
  });

  it("não desenha path pra função oculta (visible: false)", () => {
    const compiled = new Map([["fn-1", (x: number) => x]]);
    const { container } = render(
      <GraphCanvas
        functions={[{ ...IDENTITY, visible: false }]}
        compiled={compiled}
        viewport={DEFAULT_VIEWPORT}
        onViewportChange={vi.fn()}
      />
    );
    measure();

    expect(container.querySelector("path")).toBeNull();
  });

  it("continua com os controles de zoom/reset (motor compartilhado)", () => {
    let latest: Viewport = DEFAULT_VIEWPORT;
    const compiled = new Map([["fn-1", (x: number) => x]]);
    const { getByRole } = render(
      <GraphCanvas
        functions={[IDENTITY]}
        compiled={compiled}
        viewport={DEFAULT_VIEWPORT}
        onViewportChange={(v) => (latest = v)}
      />
    );

    fireEvent.click(getByRole("button", { name: "Aumentar zoom" }));
    expect(latest.xMax - latest.xMin).toBeLessThan(DEFAULT_VIEWPORT.xMax - DEFAULT_VIEWPORT.xMin);
  });

  it.each(["cot(x)", "sec(x)", "csc(x)"])(
    "desenha um path real pra %s (novas funções trigonométricas, compiladas de verdade)",
    async (expression) => {
      const evaluate = await compilePlotFunction(expression);
      const compiled = new Map([["fn-1", evaluate]]);
      const { container } = render(
        <GraphCanvas
          functions={[{ ...IDENTITY, expression }]}
          compiled={compiled}
          viewport={DEFAULT_VIEWPORT}
          onViewportChange={vi.fn()}
        />
      );
      measure();

      const path = container.querySelector("path");
      expect(path).not.toBeNull();
      expect(path?.getAttribute("d")).not.toBe("");
    }
  );

  it("continua funcionando com zoom depois de desenhar uma função nova (cot(x))", async () => {
    const evaluate = await compilePlotFunction("cot(x)");
    const compiled = new Map([["fn-1", evaluate]]);
    let latest: Viewport = DEFAULT_VIEWPORT;
    const { getByRole } = render(
      <GraphCanvas
        functions={[{ ...IDENTITY, expression: "cot(x)" }]}
        compiled={compiled}
        viewport={DEFAULT_VIEWPORT}
        onViewportChange={(v) => (latest = v)}
      />
    );
    measure();

    fireEvent.click(getByRole("button", { name: "Aumentar zoom" }));
    expect(latest.xMax - latest.xMin).toBeLessThan(DEFAULT_VIEWPORT.xMax - DEFAULT_VIEWPORT.xMin);
  });

  it("mostra o tooltip de hover ao mover o ponteiro sobre uma função visível", () => {
    const compiled = new Map([["fn-1", (x: number) => x]]);
    const { container } = render(
      <GraphCanvas functions={[IDENTITY]} compiled={compiled} viewport={DEFAULT_VIEWPORT} onViewportChange={vi.fn()} />
    );
    measure();

    const svg = container.querySelector("svg")!;
    // jsdom não calcula layout real — getBoundingClientRect() volta tudo
    // zero por padrão; mockado aqui pra bater com o tamanho medido acima.
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON() {} }) as DOMRect;
    fireEvent.pointerMove(svg, { clientX: 400, clientY: 300, pointerId: 1 });

    expect(container.querySelector("circle")).not.toBeNull();
  });
});
