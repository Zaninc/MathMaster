import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resultToLatex } from "@/lib/math/to-latex";

import { HistoryPanel } from "./HistoryPanel";

const NOOP = vi.fn();

function item(expression: string, result: string, timestamp: string, approx: string | null = null) {
  return { expression, result, approx, timestamp };
}

type ResizeCallback = () => void;
let observedCallbacks: ResizeCallback[] = [];

class MockResizeObserver {
  callback: ResizeCallback;
  constructor(callback: ResizeCallback) {
    this.callback = callback;
    observedCallbacks.push(callback);
  }
  observe() {}
  disconnect() {}
}

function forceOverflow(node: Element): void {
  Object.defineProperty(node, "scrollWidth", { value: 400, configurable: true });
  Object.defineProperty(node, "clientWidth", { value: 200, configurable: true });
}

describe("HistoryPanel", () => {
  beforeAll(async () => {
    // Aquece o dynamic import do mathjs para os timeouts curtos abaixo serem confiáveis.
    await resultToLatex("x = 2");
  });

  it("mostra o estado vazio quando não há itens visíveis", () => {
    render(
      <HistoryPanel items={[]} hiddenTimestamps={new Set()} onSelect={NOOP} onHide={NOOP} />
    );
    expect(screen.getByText("Nenhuma expressão resolvida ainda.")).toBeInTheDocument();
  });

  it("promove expressão e resultado a KaTeX quando a conversão resolve", async () => {
    const { container } = render(
      <HistoryPanel
        items={[item("√8", "2√2", "2026-01-01T00:00:00Z")]}
        hiddenTimestamps={new Set()}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());
    const annotations = Array.from(container.querySelectorAll("annotation")).map(
      (node) => node.textContent
    );
    expect(annotations.some((latex) => latex?.includes("\\sqrt"))).toBe(true);
  });

  it("promove a expressão de geometria a KaTeX via Tier 2, mas mantém o resultado sem forma reconhecida como texto puro", async () => {
    const { container } = render(
      <HistoryPanel
        items={[
          item(
            "relacao_retas([(0,0),(1,0)],[(0,0),(0,1)])",
            "Relação entre as retas: Perpendiculares ⊥",
            "2026-01-01T00:00:00Z"
          ),
        ]}
        hiddenTimestamps={new Set()}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );

    // A EXPRESSÃO (entrada do usuário) agora passa pelo mesmo pipeline
    // tolerante do preview — nunca mais fica presa em texto cru.
    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());
    // O RESULTADO (rótulo vindo do backend, "Perpendiculares ⊥") continua
    // sem forma reconhecida em `resultToLatex` — comportamento intocado.
    expect(screen.getByText("Relação entre as retas: Perpendiculares ⊥")).toBeInTheDocument();
  });

  it("preserva reutilizar/ocultar com nome acessível em texto cru", async () => {
    const onSelect = vi.fn();
    const onHide = vi.fn();
    render(
      <HistoryPanel
        items={[item("2+2", "4", "2026-01-01T00:00:00Z")]}
        hiddenTimestamps={new Set()}
        onSelect={onSelect}
        onHide={onHide}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Reutilizar expressão: 2+2 igual a 4" }));
    expect(onSelect).toHaveBeenCalledWith("2+2");

    fireEvent.click(screen.getByRole("button", { name: "Ocultar da lista: 2+2" }));
    expect(onHide).toHaveBeenCalledWith("2026-01-01T00:00:00Z");
  });

  // --- Sprint V2.1, BUG 1: mesmo tratamento de overflow do ResultPanel ---

  it("resultado longo no histórico fica em wrapper com rolagem própria (min-w-0 na linha/botão), sem truncar", async () => {
    const longResult = Array.from({ length: 30 }, (_, i) => `sin(${i + 1})`).join(" + ");
    const { container } = render(
      <HistoryPanel
        items={[item("Σ(i=1..30) sin(i)", longResult, "2026-01-01T00:00:00Z")]}
        hiddenTimestamps={new Set()}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());

    const formulaWrappers = Array.from(container.querySelectorAll(".katex")).map(
      (node) => node.parentElement
    );
    expect(formulaWrappers.length).toBeGreaterThan(0);
    for (const wrapper of formulaWrappers) {
      expect(wrapper?.className).toContain("overflow-x-auto");
      expect(wrapper?.className).toContain("max-w-full");
    }

    const button = screen.getByRole("button", { name: new RegExp(`Reutilizar expressão`) });
    expect(button.className).toContain("min-w-0");

    const annotations = Array.from(container.querySelectorAll("annotation")).map(
      (node) => node.textContent
    );
    expect(annotations.some((latex) => latex?.includes("sin") && latex.includes("30"))).toBe(true);
  });

  // --- Sprint V2.1 (apresentação progressiva): aproximação fixa, sem toggle ---

  describe("com aproximação (approx)", () => {
    beforeEach(() => {
      observedCallbacks = [];
      vi.stubGlobal("ResizeObserver", MockResizeObserver);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("com overflow real detectado, mostra a aproximação e NUNCA um botão de toggle (evitaria <button> dentro de <button>)", async () => {
      const { container } = render(
        <HistoryPanel
          items={[item("Σ(i=1..30) sin(i)", "sin(1) + sin(2)", "2026-01-01T00:00:00Z", "1.87")]}
          hiddenTimestamps={new Set()}
          onSelect={NOOP}
          onHide={NOOP}
        />
      );

      await waitFor(() => expect(container.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(2));

      // A expressão (1º ProgressiveMathResult) nunca recebe approx — só o
      // segmento do RESULTADO (2º KaTeX renderizado) é relevante aqui.
      const wrappers = Array.from(container.querySelectorAll(".katex")).map((node) => node.parentElement);
      expect(wrappers.length).toBeGreaterThanOrEqual(2);
      forceOverflow(wrappers[1]!);
      act(() => {
        observedCallbacks.forEach((callback) => callback());
      });

      expect(await screen.findByText("≈ 1.87")).toBeInTheDocument();
      // só o botão "Reutilizar"/"Ocultar" do item — nenhum toggle aninhado.
      const buttons = screen.getAllByRole("button").map((button) => button.textContent);
      expect(buttons.some((text) => text?.includes("Ver resultado exato"))).toBe(false);
    });

    it("sem overflow, mostra o valor exato normalmente (approx não usado)", async () => {
      render(
        <HistoryPanel
          items={[item("Σ(i=1..10) i", "55", "2026-01-01T00:00:00Z", "55.0000000000")]}
          hiddenTimestamps={new Set()}
          onSelect={NOOP}
          onHide={NOOP}
        />
      );

      await waitFor(() => expect(screen.getAllByText("55").length).toBeGreaterThan(0));
      expect(screen.queryByText(/^≈/)).not.toBeInTheDocument();
    });
  });

  it("filtra itens ocultos", () => {
    render(
      <HistoryPanel
        items={[item("2+2", "4", "2026-01-01T00:00:00Z")]}
        hiddenTimestamps={new Set(["2026-01-01T00:00:00Z"])}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );
    expect(
      screen.queryByRole("button", { name: /reutilizar expressão: 2\+2/i })
    ).not.toBeInTheDocument();
  });
});
