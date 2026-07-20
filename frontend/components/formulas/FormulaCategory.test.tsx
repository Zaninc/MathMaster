import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FormulaEntry } from "@/data/formulas";

import { FormulaCategory } from "./FormulaCategory";

const FORMULAS: FormulaEntry[] = [
  { id: "a", title: "Fórmula A", latex: "a^2", category: "algebra" },
  { id: "b", title: "Fórmula B", latex: "b^2", category: "algebra" },
];

describe("FormulaCategory", () => {
  it("renderiza o título da categoria como heading", () => {
    render(<FormulaCategory label="Álgebra" formulas={FORMULAS} />);
    expect(screen.getByRole("heading", { name: "Álgebra" })).toBeInTheDocument();
  });

  it("renderiza um card por fórmula", () => {
    render(<FormulaCategory label="Álgebra" formulas={FORMULAS} />);
    expect(screen.getByRole("heading", { name: "Fórmula A" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fórmula B" })).toBeInTheDocument();
  });
});
