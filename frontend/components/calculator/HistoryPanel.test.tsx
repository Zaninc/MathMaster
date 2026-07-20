import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { resultToLatex } from "@/lib/math/to-latex";

import { HistoryPanel } from "./HistoryPanel";

const NOOP = vi.fn();

function item(expression: string, result: string, timestamp: string) {
  return { expression, result, timestamp };
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
