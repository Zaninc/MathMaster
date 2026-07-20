import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dataToPixelX, dataToPixelY, type Viewport } from "@/lib/math/viewport";

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

  it("mostra os rótulos de marcação da figura ativa (círculo: Centro + raio)", () => {
    render(<GeometryCanvas shape={CIRCLE} viewport={GEOMETRY_VIEWPORT} onViewportChange={vi.fn()} />);
    measure();

    expect(screen.getByText("Centro")).toBeInTheDocument();
    expect(screen.getByText("r = 5")).toBeInTheDocument();
  });

  it("nenhuma figura deixa de ser desenhada com marcações ligadas (triângulo mantém o path + ganha A/B/C)", () => {
    const triangle: GeometryShape = {
      kind: "triangle",
      points: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 5 }],
    };
    const { container } = render(
      <GeometryCanvas shape={triangle} viewport={GEOMETRY_VIEWPORT} onViewportChange={vi.fn()} />
    );
    measure();

    expect(container.querySelector("path[fill='var(--accent)']")).not.toBeNull();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  function Harness({ shape }: { shape: GeometryShape }) {
    const [viewport, setViewport] = useState<Viewport>(GEOMETRY_VIEWPORT);
    return <GeometryCanvas shape={shape} viewport={viewport} onViewportChange={setViewport} />;
  }

  it("a marcação do centro continua alinhada com a figura depois de zoom e de reset", () => {
    const { container, getByRole } = render(<Harness shape={CIRCLE} />);
    measure();

    fireEvent.click(getByRole("button", { name: "Aumentar zoom" }));

    let dot = container.querySelector("circle[fill='var(--text-primary)']")!;
    let shapeCircle = container.querySelector("circle[fill='var(--accent)']")!;
    expect(dot.getAttribute("cx")).toBe(shapeCircle.getAttribute("cx"));
    expect(dot.getAttribute("cy")).toBe(shapeCircle.getAttribute("cy"));

    fireEvent.click(getByRole("button", { name: "Redefinir câmera" }));

    dot = container.querySelector("circle[fill='var(--text-primary)']")!;
    shapeCircle = container.querySelector("circle[fill='var(--accent)']")!;
    expect(Number(dot.getAttribute("cx"))).toBeCloseTo(dataToPixelX(0, GEOMETRY_VIEWPORT, 800));
    expect(Number(dot.getAttribute("cy"))).toBeCloseTo(dataToPixelY(0, GEOMETRY_VIEWPORT, 800));
    expect(dot.getAttribute("cx")).toBe(shapeCircle.getAttribute("cx"));
  });

  it("mudar as coordenadas da figura move as marcações junto", () => {
    const { container, rerender } = render(
      <GeometryCanvas shape={CIRCLE} viewport={GEOMETRY_VIEWPORT} onViewportChange={vi.fn()} />
    );
    measure();

    const originalCx = container.querySelector("circle[fill='var(--text-primary)']")?.getAttribute("cx");

    const moved: GeometryShape = { kind: "circle", center: { x: 5, y: 5 }, radius: 5 };
    rerender(<GeometryCanvas shape={moved} viewport={GEOMETRY_VIEWPORT} onViewportChange={vi.fn()} />);

    const newCx = container.querySelector("circle[fill='var(--text-primary)']")?.getAttribute("cx");
    expect(newCx).not.toBe(originalCx);
    expect(Number(newCx)).toBeCloseTo(dataToPixelX(5, GEOMETRY_VIEWPORT, 800));
  });
});
