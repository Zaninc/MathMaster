import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FormulaEntry } from "@/data/formulas";

import { FormulaCard } from "./FormulaCard";

const BHASKARA: FormulaEntry = {
  id: "bhaskara",
  title: "Fórmula de Bhaskara",
  latex: String.raw`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`,
  category: "algebra",
};

describe("FormulaCard", () => {
  it("mostra o título e renderiza a expressão com KaTeX (não como texto bruto)", () => {
    const { container } = render(<FormulaCard formula={BHASKARA} />);

    expect(screen.getByRole("heading", { name: "Fórmula de Bhaskara" })).toBeInTheDocument();
    expect(container.querySelector(".katex")).not.toBeNull();
    // O LaTeX cru só deve existir dentro da <annotation> do MathML (acessibilidade),
    // nunca como um <code>/texto solto visível (esse é o caminho de fallback).
    expect(container.querySelector("code[role='math']")).toBeNull();
  });

  it("não é anunciado como interativo (sem link/botão)", () => {
    render(<FormulaCard formula={BHASKARA} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("LaTeX inválido não derruba o card — título continua visível", () => {
    const broken: FormulaEntry = { ...BHASKARA, latex: String.raw`\frac{a` };

    expect(() => render(<FormulaCard formula={broken} />)).not.toThrow();
    render(<FormulaCard formula={broken} />);
    expect(screen.getAllByRole("heading", { name: "Fórmula de Bhaskara" }).length).toBeGreaterThan(0);
  });
});
