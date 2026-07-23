import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIsOverflowing } from "./useIsOverflowing";

type ResizeCallback = () => void;

let observedCallback: ResizeCallback | null = null;
let disconnectedCount = 0;

class MockResizeObserver {
  callback: ResizeCallback;
  constructor(callback: ResizeCallback) {
    this.callback = callback;
    observedCallback = callback;
  }
  observe() {}
  disconnect() {
    disconnectedCount += 1;
  }
}

/** jsdom não calcula layout de verdade — scrollWidth/clientWidth são sempre 0 por padrão. */
function setBoxMetrics(node: HTMLElement, scrollWidth: number, clientWidth: number): void {
  Object.defineProperty(node, "scrollWidth", { value: scrollWidth, configurable: true });
  Object.defineProperty(node, "clientWidth", { value: clientWidth, configurable: true });
}

function TestTarget({ mounted = true }: { mounted?: boolean }) {
  const [ref, isOverflowing] = useIsOverflowing<HTMLDivElement>();
  return (
    <div>
      <span data-testid="status">{isOverflowing ? "overflowing" : "fits"}</span>
      {mounted && <div ref={ref} data-testid="target" />}
    </div>
  );
}

describe("useIsOverflowing", () => {
  beforeEach(() => {
    observedCallback = null;
    disconnectedCount = 0;
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("começa como 'não estoura' antes de qualquer medição real de overflow", () => {
    render(<TestTarget />);
    expect(screen.getByTestId("status")).toHaveTextContent("fits");
  });

  it("detecta overflow quando scrollWidth excede clientWidth", () => {
    render(<TestTarget />);
    const node = screen.getByTestId("target");
    setBoxMetrics(node, 400, 200);

    act(() => {
      observedCallback?.();
    });

    expect(screen.getByTestId("status")).toHaveTextContent("overflowing");
  });

  it("volta a 'cabe' quando o container cresce (reage a redimensionamento enquanto montado)", () => {
    render(<TestTarget />);
    const node = screen.getByTestId("target");

    setBoxMetrics(node, 400, 200);
    act(() => observedCallback?.());
    expect(screen.getByTestId("status")).toHaveTextContent("overflowing");

    setBoxMetrics(node, 400, 500);
    act(() => observedCallback?.());
    expect(screen.getByTestId("status")).toHaveTextContent("fits");
  });

  it("não considera overflow uma diferença de 1px (margem de arredondamento)", () => {
    render(<TestTarget />);
    const node = screen.getByTestId("target");
    setBoxMetrics(node, 201, 200);

    act(() => observedCallback?.());

    expect(screen.getByTestId("status")).toHaveTextContent("fits");
  });

  it("preserva a última medição conhecida quando o elemento desmonta (nunca reseta para 'fits')", () => {
    const { rerender } = render(<TestTarget />);
    const node = screen.getByTestId("target");
    setBoxMetrics(node, 400, 200);
    act(() => observedCallback?.());
    expect(screen.getByTestId("status")).toHaveTextContent("overflowing");

    rerender(<TestTarget mounted={false} />);
    expect(screen.getByTestId("status")).toHaveTextContent("overflowing");
    expect(disconnectedCount).toBeGreaterThan(0);
  });

  it("reconecta o observer a um novo nó ao remontar (não fica preso ao nó antigo)", () => {
    const { rerender } = render(<TestTarget />);
    setBoxMetrics(screen.getByTestId("target"), 400, 200);
    act(() => observedCallback?.());
    expect(screen.getByTestId("status")).toHaveTextContent("overflowing");

    rerender(<TestTarget mounted={false} />);
    rerender(<TestTarget mounted={true} />);

    // Nó novo, ainda sem métricas definidas (0x0) — a checagem síncrona no
    // re-anexo já deveria ter rodado e reportado "cabe".
    expect(screen.getByTestId("status")).toHaveTextContent("fits");
  });
});
