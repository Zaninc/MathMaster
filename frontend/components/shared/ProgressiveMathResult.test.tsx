import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProgressiveMathResult } from "./ProgressiveMathResult";

type ResizeCallback = () => void;

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

function setBoxMetrics(node: HTMLElement, scrollWidth: number, clientWidth: number): void {
  Object.defineProperty(node, "scrollWidth", { value: scrollWidth, configurable: true });
  Object.defineProperty(node, "clientWidth", { value: clientWidth, configurable: true });
}

/** A fórmula exata é medida diretamente — sem clone: pega o próprio wrapper renderizado por MathFormula. */
function exactWrapper(container: HTMLElement): HTMLElement {
  const katex = container.querySelector(".katex");
  if (!katex?.parentElement) throw new Error("fórmula exata não encontrada");
  return katex.parentElement;
}

function overflow(container: HTMLElement): void {
  setBoxMetrics(exactWrapper(container), 400, 200);
  act(() => observedCallback?.());
}

function fits(container: HTMLElement): void {
  setBoxMetrics(exactWrapper(container), 200, 200);
  act(() => observedCallback?.());
}

describe("ProgressiveMathResult", () => {
  beforeEach(() => {
    observedCallback = null;
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("latex nulo cai no texto puro de fallback, sem KaTeX", () => {
    const { container } = render(<ProgressiveMathResult latex={null} text="crescente" approx="1.5" />);
    expect(screen.getByText("crescente")).toBeInTheDocument();
    expect(container.querySelector(".katex")).toBeNull();
  });

  it("sem approx, sempre mostra o valor exato mesmo com overflow real (nada para aproximar)", () => {
    const { container } = render(<ProgressiveMathResult latex="55" text="55" approx={null} />);
    overflow(container);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/^≈/)).not.toBeInTheDocument();
    expect(container.querySelector(".katex")).not.toBeNull();
  });

  it("com approx mas sem overflow real, mostra o valor exato como principal (sem toggle)", () => {
    const { container } = render(
      <ProgressiveMathResult latex="\sum_{i=1}^{30}\sin(i)" text="..." approx="1.87" />
    );
    fits(container);
    expect(screen.queryByText("≈ 1.87")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver resultado exato" })).not.toBeInTheDocument();
  });

  it("com approx E overflow real, mostra a aproximação como principal com botão para ver o exato", () => {
    const { container } = render(
      <ProgressiveMathResult latex="\sum_{i=1}^{30}\sin(i)" text="..." approx="1.87" />
    );
    overflow(container);

    expect(screen.getByText("≈ 1.87")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver resultado exato" })).toBeInTheDocument();
  });

  it("o botão 'Ver resultado exato' alterna para o KaTeX exato e volta, sem reverter sozinho", () => {
    const { container } = render(
      <ProgressiveMathResult latex="\sum_{i=1}^{30}\sin(i)" text="..." approx="1.87" />
    );
    overflow(container);
    expect(screen.getByText("≈ 1.87")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver resultado exato" }));
    expect(screen.queryByText("≈ 1.87")).not.toBeInTheDocument();
    expect(container.querySelector(".katex")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Ver aproximado" })).toBeInTheDocument();

    // Mesmo que o exato remontado meça overflow de novo, a escolha manual
    // do usuário é definitiva — não volta sozinho pro aproximado.
    overflow(container);
    expect(container.querySelector(".katex")).not.toBeNull();
    expect(screen.queryByText("≈ 1.87")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver aproximado" }));
    expect(screen.getByText("≈ 1.87")).toBeInTheDocument();
  });

  it("allowToggle=false nunca renderiza o botão, mesmo com overflow (ex. dentro do botão do Histórico)", () => {
    const { container } = render(
      <ProgressiveMathResult latex="\sum_{i=1}^{30}\sin(i)" text="..." approx="1.87" allowToggle={false} />
    );
    overflow(container);

    expect(screen.getByText("≈ 1.87")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("modo controlado ('exact'): mostra o valor exato, ignora overflow real e não renderiza botão interno", () => {
    const { container } = render(
      <ProgressiveMathResult latex="\sum_{i=1}^{30}\sin(i)" text="..." approx="1.87" mode="exact" />
    );
    overflow(container);

    expect(container.querySelector(".katex")).not.toBeNull();
    expect(screen.queryByText("≈ 1.87")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("modo controlado ('approx'): mostra a aproximação mesmo sem overflow e não renderiza botão interno", () => {
    render(<ProgressiveMathResult latex="\sum_{i=1}^{30}\sin(i)" text="..." approx="1.87" mode="approx" />);

    expect(screen.getByText("≈ 1.87")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("reseta para automático quando o latex muda (resultado novo não herda a escolha manual do anterior)", () => {
    const { container, rerender } = render(
      <ProgressiveMathResult latex="\sum_{i=1}^{30}\sin(i)" text="..." approx="1.87" />
    );
    overflow(container);
    fireEvent.click(screen.getByRole("button", { name: "Ver resultado exato" }));
    expect(container.querySelector(".katex")).not.toBeNull();

    rerender(<ProgressiveMathResult latex="465" text="465" approx={null} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector(".katex")).not.toBeNull();
  });
});
