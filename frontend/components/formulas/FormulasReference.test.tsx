import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FORMULAS } from "@/data/formulas";

import { FormulasReference } from "./FormulasReference";

describe("FormulasReference", () => {
  it("renderiza todas as categorias, na ordem da Etapa 1", () => {
    render(<FormulasReference />);

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Álgebra", "Geometria", "Trigonometria", "Cálculo"]);
  });

  it("renderiza um card (h3) por fórmula do catálogo, todas presentes", () => {
    render(<FormulasReference />);

    for (const formula of FORMULAS) {
      expect(screen.getByRole("heading", { level: 3, name: formula.title })).toBeInTheDocument();
    }
  });

  it("renderiza as fórmulas com KaTeX, não como texto Unicode solto", () => {
    const { container } = render(<FormulasReference />);

    expect(container.querySelectorAll(".katex").length).toBe(FORMULAS.length);
    expect(screen.queryByText(/√\(b² - 4ac\)/)).not.toBeInTheDocument();
  });
});
