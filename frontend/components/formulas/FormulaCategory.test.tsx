import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FormulaEntry } from "@/data/formulas";

import { FormulaCategory } from "./FormulaCategory";

const FORMULAS: FormulaEntry[] = [
  { id: "a", title: "Fórmula A", latex: "a^2", category: "algebra" },
  { id: "b", title: "Fórmula B", latex: "b^2", category: "algebra" },
];

const noop = () => {};

describe("FormulaCategory", () => {
  it("renderiza o título da categoria como heading", () => {
    render(<FormulaCategory label="Álgebra" formulas={FORMULAS} isFavorite={() => false} onToggleFavorite={noop} />);
    expect(screen.getByRole("heading", { name: "Álgebra" })).toBeInTheDocument();
  });

  it("renderiza um card por fórmula", () => {
    render(<FormulaCategory label="Álgebra" formulas={FORMULAS} isFavorite={() => false} onToggleFavorite={noop} />);
    expect(screen.getByRole("heading", { name: "Fórmula A" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fórmula B" })).toBeInTheDocument();
  });

  it("repassa isFavorite por fórmula para o estado da estrela de cada card", () => {
    render(
      <FormulaCategory label="Álgebra" formulas={FORMULAS} isFavorite={(id) => id === "a"} onToggleFavorite={noop} />
    );

    const cardA = screen.getByRole("heading", { name: "Fórmula A" }).closest("article")!;
    const cardB = screen.getByRole("heading", { name: "Fórmula B" }).closest("article")!;
    expect(within(cardA).getByRole("button", { name: "Remover dos favoritos" })).toBeInTheDocument();
    expect(within(cardB).getByRole("button", { name: "Adicionar aos favoritos" })).toBeInTheDocument();
  });
});
