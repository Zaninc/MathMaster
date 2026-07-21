import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FormulaEntry } from "@/data/formulas";

import { FormulaCard } from "./FormulaCard";

const BHASKARA: FormulaEntry = {
  id: "bhaskara",
  title: "Fórmula de Bhaskara",
  latex: String.raw`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`,
  category: "algebra",
};

describe("FormulaCard", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("mostra o título e renderiza a expressão com KaTeX (não como texto bruto)", () => {
    const { container } = render(
      <FormulaCard formula={BHASKARA} isFavorite={false} onToggleFavorite={() => {}} />
    );

    expect(screen.getByRole("heading", { name: "Fórmula de Bhaskara" })).toBeInTheDocument();
    expect(container.querySelector(".katex")).not.toBeNull();
    // O LaTeX cru só deve existir dentro da <annotation> do MathML (acessibilidade),
    // nunca como um <code>/texto solto visível (esse é o caminho de fallback).
    expect(container.querySelector("code[role='math']")).toBeNull();
  });

  it("não é anunciado como link (só a estrela e o botão de copiar são interativos)", () => {
    render(<FormulaCard formula={BHASKARA} isFavorite={false} onToggleFavorite={() => {}} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("LaTeX inválido não derruba o card — título continua visível", () => {
    const broken: FormulaEntry = { ...BHASKARA, latex: String.raw`\frac{a` };

    expect(() =>
      render(<FormulaCard formula={broken} isFavorite={false} onToggleFavorite={() => {}} />)
    ).not.toThrow();
    render(<FormulaCard formula={broken} isFavorite={false} onToggleFavorite={() => {}} />);
    expect(screen.getAllByRole("heading", { name: "Fórmula de Bhaskara" }).length).toBeGreaterThan(0);
  });

  it("estrela reflete isFavorite e chama onToggleFavorite com o id ao clicar", () => {
    const onToggleFavorite = vi.fn();
    const { rerender } = render(
      <FormulaCard formula={BHASKARA} isFavorite={false} onToggleFavorite={onToggleFavorite} />
    );

    const star = screen.getByRole("button", { name: "Adicionar aos favoritos" });
    expect(star).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(star);
    expect(onToggleFavorite).toHaveBeenCalledWith("bhaskara");

    rerender(<FormulaCard formula={BHASKARA} isFavorite onToggleFavorite={onToggleFavorite} />);
    expect(screen.getByRole("button", { name: "Remover dos favoritos" })).toHaveAttribute("aria-pressed", "true");
  });

  it("copiar fórmula escreve o LaTeX no clipboard e mostra feedback 'Copiado!'", async () => {
    render(<FormulaCard formula={BHASKARA} isFavorite={false} onToggleFavorite={() => {}} />);

    const copyButton = screen.getByRole("button", { name: /copiar fórmula/i });
    fireEvent.click(copyButton);

    expect(await screen.findByText("Copiado!")).toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(BHASKARA.latex);
  });
});
