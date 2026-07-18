import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MathFormula } from "./MathFormula";

describe("MathFormula", () => {
  it("renderiza LaTeX válido como markup KaTeX", () => {
    const { container } = render(<MathFormula formula="\frac{a+b}{c+d}" />);
    expect(container.querySelector(".katex")).not.toBeNull();
  });

  it("renderiza inline por padrão e em bloco com displayMode", () => {
    const inline = render(<MathFormula formula="x^2" />);
    expect(inline.container.querySelector(".katex-display")).toBeNull();

    const block = render(<MathFormula formula="x^2" displayMode />);
    expect(block.container.querySelector(".katex-display")).not.toBeNull();
  });

  it("embute MathML com o LaTeX original para leitores de tela", () => {
    const { container } = render(<MathFormula formula="\int_0^1 x^2\,dx" displayMode />);
    const annotation = container.querySelector("annotation");
    expect(annotation?.getAttribute("encoding")).toBe("application/x-tex");
    expect(annotation?.textContent).toBe("\\int_0^1 x^2\\,dx");
  });

  it("não lança para LaTeX inválido — degrada para exibição do código-fonte", () => {
    expect(() => render(<MathFormula formula="\frac{a" />)).not.toThrow();
    const { container } = render(<MathFormula formula="\frac{a" />);
    expect(container.textContent).toContain("\\frac{a");
  });

  it("propaga className para o wrapper", () => {
    const { container } = render(<MathFormula formula="x" className="text-text-secondary" />);
    expect(container.querySelector(".text-text-secondary")).not.toBeNull();
  });
});
