import { createRef } from "react";

import { render } from "@testing-library/react";
import katex from "katex";
import { describe, expect, it, vi } from "vitest";

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

  // --- Sprint V2.1, BUG 1: fórmulas longas não podem vazar do container ---

  it("por padrão, inline NÃO ganha rolagem própria (preserva o comportamento de rótulos pequenos, ex. FunctionList)", () => {
    const { container } = render(<MathFormula formula="x^2" />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.tagName).toBe("SPAN");
    expect(wrapper?.className).not.toContain("overflow-x-auto");
    expect(wrapper?.className).not.toContain("max-w-full");
  });

  it("scrollable=true envolve o inline num wrapper com rolagem horizontal própria (não vaza do container)", () => {
    const { container } = render(<MathFormula formula="x^2" scrollable />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.tagName).toBe("SPAN");
    expect(wrapper?.className).toContain("overflow-x-auto");
    expect(wrapper?.className).toContain("max-w-full");
    // display:block via CLASSE, não via tag — continua HTML válido dentro de <p>.
    expect(wrapper?.className).toContain("block");
  });

  it("wrapper em bloco (displayMode) também permite rolagem horizontal própria", () => {
    const { container } = render(<MathFormula formula="x^2" displayMode />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.tagName).toBe("DIV");
    expect(wrapper?.className).toContain("overflow-x-auto");
    expect(wrapper?.className).toContain("max-w-full");
  });

  it("não trunca fórmulas longas — o MathML/anotação preserva o LaTeX completo", () => {
    const longFormula = Array.from({ length: 30 }, (_, i) => `\\sin(${i + 1})`).join(" + ");
    const { container } = render(<MathFormula formula={longFormula} scrollable />);
    const annotation = container.querySelector("annotation");
    expect(annotation?.textContent).toBe(longFormula);
  });

  // --- Sprint V2.1 (apresentação progressiva): ref encaminhada para o
  // elemento raiz de fato renderizado, usada por `ProgressiveMathResult`
  // para medir overflow real via `useIsOverflowing`.

  it("encaminha a ref para o span raiz (inline)", () => {
    const ref = createRef<HTMLElement>();
    render(<MathFormula formula="x^2" scrollable ref={ref} />);
    expect(ref.current?.tagName).toBe("SPAN");
    expect(ref.current?.className).toContain("overflow-x-auto");
  });

  it("encaminha a ref para o div raiz (displayMode)", () => {
    const ref = createRef<HTMLElement>();
    render(<MathFormula formula="x^2" displayMode ref={ref} />);
    expect(ref.current?.tagName).toBe("DIV");
  });

  it("encaminha a ref para o <code> de fallback (katex.renderToString lança de verdade)", () => {
    // `throwOnError:false` faz o KaTeX absorver quase todo erro de sintaxe
    // renderizando o próprio texto em cor de erro (não lança) — o caminho
    // `<code>` só é alcançado se `renderToString` lançar mesmo assim.
    const spy = vi.spyOn(katex, "renderToString").mockImplementation(() => {
      throw new Error("boom");
    });
    const ref = createRef<HTMLElement>();
    render(<MathFormula formula="x" ref={ref} />);
    expect(ref.current?.tagName).toBe("CODE");
    spy.mockRestore();
  });
});
