import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useElementSize } from "./useElementSize";

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

function TestTarget() {
  const [ref, size] = useElementSize<HTMLDivElement>();
  return (
    <div ref={ref} data-testid="target">
      {size.width}x{size.height}
    </div>
  );
}

describe("useElementSize", () => {
  beforeEach(() => {
    observedCallback = null;
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("começa em 0x0 antes da primeira medição", () => {
    render(<TestTarget />);
    expect(screen.getByTestId("target")).toHaveTextContent("0x0");
  });

  it("atualiza o tamanho quando o ResizeObserver reporta uma mudança", () => {
    render(<TestTarget />);

    act(() => {
      observedCallback?.([{ contentRect: { width: 640, height: 400 } }]);
    });

    expect(screen.getByTestId("target")).toHaveTextContent("640x400");
  });
});
