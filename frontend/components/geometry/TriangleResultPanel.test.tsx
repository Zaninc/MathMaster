import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TriangleResultPanel, type TriangleStats } from "./TriangleResultPanel";

const STATS: TriangleStats = {
  area: 20,
  perimeter: 22.43,
  sideClass: "escaleno",
  angleClass: "retângulo",
  ab: 8,
  bc: 9.43,
  ca: 5,
};

/** LaTeX original de cada fórmula KaTeX renderizada (via MathML `<annotation>`). */
function renderedFormulas(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("annotation")).map((node) => node.textContent ?? "");
}

describe("TriangleResultPanel", () => {
  it("mostra a mensagem de erro quando não há estatísticas (pontos colineares)", () => {
    render(<TriangleResultPanel stats={null} />);
    expect(screen.getByText(/não formam um triângulo válido/i)).toBeInTheDocument();
  });

  it("renderiza a fórmula da área em duas linhas (aligned) com subscritos reais", () => {
    const { container } = render(<TriangleResultPanel stats={STATS} />);
    expect(container.querySelector(".katex-display")).not.toBeNull();
    const areaFormula = renderedFormulas(container).find((formula) =>
      formula.includes("\\begin{aligned}")
    );
    expect(areaFormula).toContain("\\tfrac{1}{2}");
    expect(areaFormula).toContain("x_A(y_B - y_C) + x_B(y_C - y_A) \\\\");
    expect(areaFormula).toContain("+ x_C(y_A - y_B)");
  });

  it("separa a fórmula do resultado numérico da área", () => {
    render(<TriangleResultPanel stats={STATS} />);
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("lista os três lados como segmentos (\\overline) com seus valores", () => {
    const { container } = render(<TriangleResultPanel stats={STATS} />);
    const formulas = renderedFormulas(container);
    expect(formulas).toEqual(
      expect.arrayContaining([
        "\\overline{AB} = 8",
        "\\overline{BC} = 9.43",
        "\\overline{CA} = 5",
      ])
    );
  });

  it("exibe o perímetro simbólico em KaTeX e o valor numérico como texto", () => {
    const { container } = render(<TriangleResultPanel stats={STATS} />);
    expect(renderedFormulas(container)).toEqual(
      expect.arrayContaining(["P = \\overline{AB} + \\overline{BC} + \\overline{CA} ="])
    );
    expect(screen.getByText("22.43")).toBeInTheDocument();
  });

  it("capitaliza só a classificação por lados na exibição, sem alterar o valor recebido", () => {
    render(<TriangleResultPanel stats={STATS} />);
    expect(screen.getByText("Escaleno, retângulo")).toBeInTheDocument();
    expect(STATS.sideClass).toBe("escaleno");
  });
});
