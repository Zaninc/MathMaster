import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FormulaEntry } from "@/data/formulas";

import { FormulaCard } from "./FormulaCard";

/** Sem entrada em FORMULA_CONNECTIONS (data/connections.ts) — usada pra testar o card "puro", sem ações contextuais. */
const NO_CONNECTIONS: FormulaEntry = {
  id: "formula-sem-conexao-curada",
  title: "Fórmula de Bhaskara",
  latex: String.raw`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`,
  category: "algebra",
};

/** id real com conexões curadas (calculadora + gráfico + exercícios) — ver data/connections.ts. */
const BHASKARA: FormulaEntry = { ...NO_CONNECTIONS, id: "bhaskara" };
/** 2 conexões curadas (calculadora + exercícios) — ver data/connections.ts. */
const DELTA: FormulaEntry = { ...NO_CONNECTIONS, id: "delta", title: "Delta (discriminante)" };
/** 1 conexão curada (calculadora) — ver data/connections.ts. */
const PITAGORAS: FormulaEntry = { ...NO_CONNECTIONS, id: "teorema-pitagoras", title: "Teorema de Pitágoras" };

describe("FormulaCard", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("mostra o título e renderiza a expressão com KaTeX (não como texto bruto)", () => {
    const { container } = render(
      <FormulaCard formula={NO_CONNECTIONS} isFavorite={false} onToggleFavorite={() => {}} />
    );

    expect(screen.getByRole("heading", { name: "Fórmula de Bhaskara" })).toBeInTheDocument();
    expect(container.querySelector(".katex")).not.toBeNull();
    // O LaTeX cru só deve existir dentro da <annotation> do MathML (acessibilidade),
    // nunca como um <code>/texto solto visível (esse é o caminho de fallback).
    expect(container.querySelector("code[role='math']")).toBeNull();
  });

  it("sem conexão curada, não mostra nenhum link de ação (só a estrela e o botão de copiar)", () => {
    render(<FormulaCard formula={NO_CONNECTIONS} isFavorite={false} onToggleFavorite={() => {}} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("LaTeX inválido não derruba o card — título continua visível", () => {
    const broken: FormulaEntry = { ...NO_CONNECTIONS, latex: String.raw`\frac{a` };

    expect(() =>
      render(<FormulaCard formula={broken} isFavorite={false} onToggleFavorite={() => {}} />)
    ).not.toThrow();
    render(<FormulaCard formula={broken} isFavorite={false} onToggleFavorite={() => {}} />);
    expect(screen.getAllByRole("heading", { name: "Fórmula de Bhaskara" }).length).toBeGreaterThan(0);
  });

  it("estrela reflete isFavorite e chama onToggleFavorite com o id ao clicar", () => {
    const onToggleFavorite = vi.fn();
    const { rerender } = render(
      <FormulaCard formula={NO_CONNECTIONS} isFavorite={false} onToggleFavorite={onToggleFavorite} />
    );

    const star = screen.getByRole("button", { name: "Adicionar aos favoritos" });
    expect(star).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(star);
    expect(onToggleFavorite).toHaveBeenCalledWith("formula-sem-conexao-curada");

    rerender(<FormulaCard formula={NO_CONNECTIONS} isFavorite onToggleFavorite={onToggleFavorite} />);
    expect(screen.getByRole("button", { name: "Remover dos favoritos" })).toHaveAttribute("aria-pressed", "true");
  });

  it("copiar fórmula escreve o LaTeX no clipboard e mostra feedback 'Copiado!'", async () => {
    render(<FormulaCard formula={NO_CONNECTIONS} isFavorite={false} onToggleFavorite={() => {}} />);

    const copyButton = screen.getByRole("button", { name: /copiar fórmula/i });
    fireEvent.click(copyButton);

    expect(await screen.findByText("Copiado!")).toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(NO_CONNECTIONS.latex);
  });

  describe("ações contextuais (sistema de conexões internas)", () => {
    it("fórmula com conexão curada mostra os links esperados, cada um com nome acessível", () => {
      render(<FormulaCard formula={BHASKARA} isFavorite={false} onToggleFavorite={() => {}} />);

      const calc = screen.getByRole("link", { name: "Abrir na calculadora" });
      const graph = screen.getByRole("link", { name: "Visualizar nos gráficos" });
      const exercises = screen.getByRole("link", { name: "Exercícios relacionados" });

      expect(calc).toHaveAttribute("href", expect.stringContaining("/calculadora?expression="));
      expect(graph).toHaveAttribute("href", expect.stringContaining("/graficos?fn="));
      expect(exercises).toHaveAttribute("href", "/aprendizado?topico=equacoes");
    });

    it("links de ação ficam visíveis por foco (paridade com hover) via classe group-focus-within", () => {
      render(<FormulaCard formula={BHASKARA} isFavorite={false} onToggleFavorite={() => {}} />);

      const link = screen.getByRole("link", { name: "Abrir na calculadora" });
      expect(link.className).toContain("sm:group-focus-within:opacity-100");
      expect(link.className).toContain("focus-visible:ring-2");
      expect(link.tabIndex).not.toBe(-1);
    });
  });

  describe("grade 2×2 — 'Copiar fórmula' nunca fica isolado sozinho num canto", () => {
    it("3 conexões (par: 4 ações no total) — grade fecha 2×2, ninguém precisa ocupar 2 colunas", () => {
      render(<FormulaCard formula={BHASKARA} isFavorite={false} onToggleFavorite={() => {}} />);
      const copyButton = screen.getByRole("button", { name: /copiar fórmula/i });
      expect(copyButton.className).not.toContain("col-span-2");
    });

    it("2 conexões (ímpar: 3 ações no total) — 'Copiar' é o sobrando e ocupa as 2 colunas", () => {
      render(<FormulaCard formula={DELTA} isFavorite={false} onToggleFavorite={() => {}} />);
      const copyButton = screen.getByRole("button", { name: /copiar fórmula/i });
      expect(copyButton.className).toContain("col-span-2");
    });

    it("1 conexão (par: 2 ações no total) — fecha a fileira sozinha, sem span", () => {
      render(<FormulaCard formula={PITAGORAS} isFavorite={false} onToggleFavorite={() => {}} />);
      const copyButton = screen.getByRole("button", { name: /copiar fórmula/i });
      expect(copyButton.className).not.toContain("col-span-2");
    });

    it("0 conexões (ímpar: 1 ação no total) — 'Copiar' sozinho ocupa as 2 colunas em vez de ficar isolado no canto", () => {
      render(<FormulaCard formula={NO_CONNECTIONS} isFavorite={false} onToggleFavorite={() => {}} />);
      const copyButton = screen.getByRole("button", { name: /copiar fórmula/i });
      expect(copyButton.className).toContain("col-span-2");
    });
  });
});
