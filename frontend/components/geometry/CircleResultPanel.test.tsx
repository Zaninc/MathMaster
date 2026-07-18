import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CircleResultPanel } from "./CircleResultPanel";

/** LaTeX original de cada fórmula KaTeX renderizada (via MathML `<annotation>`). */
function renderedFormulas(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("annotation")).map((node) => node.textContent ?? "");
}

describe("CircleResultPanel", () => {
  it("não renderiza nada quando não há estatísticas", () => {
    const { container } = render(<CircleResultPanel stats={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza as fórmulas de área e comprimento em KaTeX, separadas dos resultados", () => {
    const { container } = render(<CircleResultPanel stats={{ area: 78.54, circumference: 31.42 }} />);

    expect(renderedFormulas(container)).toEqual(
      expect.arrayContaining(["A = \\pi r^2", "C = 2\\pi r"])
    );
    expect(screen.getByText("78.54")).toBeInTheDocument();
    expect(screen.getByText("31.42")).toBeInTheDocument();
  });
});
