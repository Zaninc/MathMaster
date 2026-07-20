import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Viewport } from "@/lib/math/viewport";

import { GEOMETRY_VIEWPORT, GeometryCanvas } from "./GeometryCanvas";
import type { GeometryShape } from "./types";

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

function measure(width = 800, height = 800) {
  act(() => {
    observedCallback?.([{ contentRect: { width, height } }]);
  });
}

const CIRCLE: GeometryShape = { kind: "circle", center: { x: 0, y: 0 }, radius: 5 };

describe("GeometryCanvas", () => {
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

  it("desenha o círculo com centro e raio corretos", () => {
    const { container } = render(
      <GeometryCanvas shape={CIRCLE} viewport={GEOMETRY_VIEWPORT} onViewportChange={vi.fn()} />
    );
    measure();

    const circle = container.querySelector("circle[fill='var(--accent)']");
    expect(circle).not.toBeNull();
    // centro (0,0) no viewport -12..12/800px -> pixel 400,400
    expect(circle?.getAttribute("cx")).toBe("400");
    expect(circle?.getAttribute("cy")).toBe("400");
  });

  it("sem figura, não desenha nenhuma forma (mas a grade/eixos continuam)", () => {
    const { container } = render(
      <GeometryCanvas shape={null} viewport={GEOMETRY_VIEWPORT} onViewportChange={vi.fn()} />
    );
    measure();

    expect(container.querySelector("circle[fill='var(--accent)']")).toBeNull();
    expect(container.querySelector("path")).toBeNull();
  });

  it("aria-label descreve a figura ativa", () => {
    const { container } = render(
      <GeometryCanvas shape={CIRCLE} viewport={GEOMETRY_VIEWPORT} onViewportChange={vi.fn()} />
    );
    measure();
    expect(container.querySelector('svg[aria-label="Construção geométrica: circle"]')).not.toBeNull();
  });

  it("ganhou zoom (roda/botões) e reset — não existia antes desta sprint", () => {
    let latest: Viewport = GEOMETRY_VIEWPORT;
    const { getByRole, container } = render(
      <GeometryCanvas shape={CIRCLE} viewport={latest} onViewportChange={(v) => (latest = v)} />
    );
    measure();

    fireEvent.click(getByRole("button", { name: "Aumentar zoom" }));
    expect(latest.xMax - latest.xMin).toBeLessThan(GEOMETRY_VIEWPORT.xMax - GEOMETRY_VIEWPORT.xMin);

    const svg = container.querySelector("svg")!;
    const wheelEvent = new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true });
    fireEvent(svg, wheelEvent);
    expect(latest.xMax - latest.xMin).toBeLessThan(GEOMETRY_VIEWPORT.xMax - GEOMETRY_VIEWPORT.xMin);
  });

  it("reset volta pro GEOMETRY_VIEWPORT (escala natural da geometria, diferente de /graficos)", () => {
    const zoomedIn: Viewport = { xMin: -2, xMax: 2, yMin: -2, yMax: 2 };
    let latest: Viewport = zoomedIn;
    const { getByRole } = render(
      <GeometryCanvas shape={CIRCLE} viewport={latest} onViewportChange={(v) => (latest = v)} />
    );

    fireEvent.click(getByRole("button", { name: "Redefinir câmera" }));
    expect(latest).toEqual(GEOMETRY_VIEWPORT);
  });
});
