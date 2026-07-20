import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FORMULAS } from "@/data/formulas";

import { FormulasReference } from "./FormulasReference";

describe("FormulasReference", () => {
  it("cerca de 25 fórmulas no catálogo (Etapa 3)", () => {
    expect(FORMULAS.length).toBeGreaterThanOrEqual(25);
  });

  it("renderiza todas as categorias, na ordem da Etapa 1/2, com 'Todas' ativo por padrão", () => {
    render(<FormulasReference />);

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Álgebra", "Geometria", "Trigonometria", "Cálculo"]);

    const filterGroup = screen.getByRole("group", { name: "Filtro de categoria" });
    expect(within(filterGroup).getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "true");
  });

  it("renderiza um card (h3) por fórmula do catálogo, todas presentes", () => {
    render(<FormulasReference />);

    for (const formula of FORMULAS) {
      expect(screen.getByRole("heading", { level: 3, name: formula.title })).toBeInTheDocument();
    }
  });

  it("renderiza as fórmulas com KaTeX, uma por card", () => {
    const { container } = render(<FormulasReference />);
    expect(container.querySelectorAll(".katex").length).toBe(FORMULAS.length);
  });

  it("filtra para uma única categoria ao clicar nela", () => {
    render(<FormulasReference />);

    const filterGroup = screen.getByRole("group", { name: "Filtro de categoria" });
    fireEvent.click(within(filterGroup).getByRole("button", { name: "Trigonometria" }));

    expect(screen.getByRole("heading", { level: 2, name: "Trigonometria" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Álgebra" })).not.toBeInTheDocument();
    expect(within(filterGroup).getByRole("button", { name: "Trigonometria" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(within(filterGroup).getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "false");
  });

  it("volta a mostrar tudo ao clicar em 'Todas' de novo", () => {
    render(<FormulasReference />);

    const filterGroup = screen.getByRole("group", { name: "Filtro de categoria" });
    fireEvent.click(within(filterGroup).getByRole("button", { name: "Cálculo" }));
    expect(screen.queryByRole("heading", { level: 2, name: "Álgebra" })).not.toBeInTheDocument();

    fireEvent.click(within(filterGroup).getByRole("button", { name: "Todas" }));
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Álgebra", "Geometria", "Trigonometria", "Cálculo"]);
  });
});
