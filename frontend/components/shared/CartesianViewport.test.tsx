import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_VIEWPORT, type Viewport } from "@/lib/math/viewport";

import { CartesianViewport } from "./CartesianViewport";

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

function Harness({ initial = DEFAULT_VIEWPORT }: { initial?: Viewport }) {
  const [viewport, setViewport] = useState(initial);
  return (
    <CartesianViewport viewport={viewport} onViewportChange={setViewport} resetViewport={DEFAULT_VIEWPORT} ariaLabel="Plano de teste">
      {() => null}
    </CartesianViewport>
  );
}

describe("CartesianViewport", () => {
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

  it("renderiza os botões de zoom e reset, mesmo antes de medir o container", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Aumentar zoom" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Diminuir zoom" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Redefinir câmera" })).toBeInTheDocument();
  });

  it("não desenha o SVG antes do container ser medido (evita divisão por zero)", () => {
    const { container } = render(<Harness />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("depois de medido, o SVG carrega o aria-label informado pelo consumidor", () => {
    const { container } = render(<Harness />);
    measure();
    expect(container.querySelector('svg[aria-label="Plano de teste"]')).not.toBeNull();
  });

  it("botão '+' estreita o viewport (zoom in)", () => {
    let latest: Viewport = DEFAULT_VIEWPORT;
    render(
      <CartesianViewport
        viewport={DEFAULT_VIEWPORT}
        onViewportChange={(v) => (latest = v)}
        resetViewport={DEFAULT_VIEWPORT}
        ariaLabel="Plano de teste"
      >
        {() => null}
      </CartesianViewport>
    );

    fireEvent.click(screen.getByRole("button", { name: "Aumentar zoom" }));

    expect(latest.xMax - latest.xMin).toBeLessThan(DEFAULT_VIEWPORT.xMax - DEFAULT_VIEWPORT.xMin);
  });

  it("botão '−' alarga o viewport (zoom out)", () => {
    let latest: Viewport = DEFAULT_VIEWPORT;
    render(
      <CartesianViewport
        viewport={DEFAULT_VIEWPORT}
        onViewportChange={(v) => (latest = v)}
        resetViewport={DEFAULT_VIEWPORT}
        ariaLabel="Plano de teste"
      >
        {() => null}
      </CartesianViewport>
    );

    fireEvent.click(screen.getByRole("button", { name: "Diminuir zoom" }));

    expect(latest.xMax - latest.xMin).toBeGreaterThan(DEFAULT_VIEWPORT.xMax - DEFAULT_VIEWPORT.xMin);
  });

  it("botão de reset volta pro resetViewport informado, mesmo depois de zoom", () => {
    const custom: Viewport = { xMin: -20, xMax: 20, yMin: -20, yMax: 20 };
    let latest: Viewport = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
    render(
      <CartesianViewport
        viewport={latest}
        onViewportChange={(v) => (latest = v)}
        resetViewport={custom}
        ariaLabel="Plano de teste"
      >
        {() => null}
      </CartesianViewport>
    );

    fireEvent.click(screen.getByRole("button", { name: "Redefinir câmera" }));
    expect(latest).toEqual(custom);
  });

  it("scroll (wheel) sobre o SVG faz zoom e previne o scroll da página", () => {
    let latest: Viewport = DEFAULT_VIEWPORT;
    const { container } = render(
      <CartesianViewport
        viewport={DEFAULT_VIEWPORT}
        onViewportChange={(v) => (latest = v)}
        resetViewport={DEFAULT_VIEWPORT}
        ariaLabel="Plano de teste"
      >
        {() => null}
      </CartesianViewport>
    );
    measure();

    const svg = container.querySelector("svg")!;
    expect(svg).not.toBeNull();

    const wheelEvent = new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(wheelEvent, "preventDefault");
    fireEvent(svg, wheelEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(latest.xMax - latest.xMin).toBeLessThan(DEFAULT_VIEWPORT.xMax - DEFAULT_VIEWPORT.xMin);
  });

  it("arrastar (pointer down + move) desloca o viewport (pan)", () => {
    let latest: Viewport = DEFAULT_VIEWPORT;
    const { container } = render(
      <CartesianViewport
        viewport={DEFAULT_VIEWPORT}
        onViewportChange={(v) => (latest = v)}
        resetViewport={DEFAULT_VIEWPORT}
        ariaLabel="Plano de teste"
      >
        {() => null}
      </CartesianViewport>
    );
    measure();

    const svg = container.querySelector("svg")!;
    fireEvent.pointerDown(svg, { clientX: 400, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 350, clientY: 300, pointerId: 1 });

    expect(latest).not.toEqual(DEFAULT_VIEWPORT);
  });

  it("chama onPointerMove com a coordenada de dados sob o cursor", () => {
    const onPointerMove = vi.fn();
    const { container } = render(
      <CartesianViewport
        viewport={DEFAULT_VIEWPORT}
        onViewportChange={vi.fn()}
        resetViewport={DEFAULT_VIEWPORT}
        ariaLabel="Plano de teste"
        onPointerMove={onPointerMove}
      >
        {() => null}
      </CartesianViewport>
    );
    measure();

    const svg = container.querySelector("svg")!;
    fireEvent.pointerMove(svg, { clientX: 400, clientY: 300, pointerId: 1 });

    expect(onPointerMove).toHaveBeenCalled();
  });
});
