import { render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { inputToLatex } from "@/lib/math/to-latex";

import { MathPreview } from "./MathPreview";

describe("MathPreview", () => {
  beforeAll(async () => {
    // Aquece o dynamic import do mathjs para os timeouts curtos abaixo serem confiáveis.
    await inputToLatex("x");
  });

  it("mostra o placeholder quando o valor está vazio", () => {
    render(<MathPreview value="  " />);
    expect(screen.getByText("Pré-visualização")).toBeInTheDocument();
  });

  it("envolve o KaTeX num container com scroll horizontal próprio, nunca invade o histórico ao lado", async () => {
    const { container } = render(<MathPreview value="derivative(limit(sin(x)/x, x, 0), x)" />);

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull(), { timeout: 2000 });

    const wrapper = container.querySelector(".katex")?.closest("span.overflow-x-auto");
    expect(wrapper).not.toBeNull();
    // Correção de layout (card cortando matrizes/frações): o wrapper NUNCA
    // mais leva `overflow-y-hidden` — ver `MathFormula.tsx`.
    expect(wrapper).toHaveClass("block", "max-w-full", "overflow-x-auto");
    expect(wrapper).not.toHaveClass("overflow-y-hidden");
    // o próprio <p> nunca deve exceder a largura do container pai.
    expect(container.querySelector("p[aria-hidden='true']")).toHaveClass("max-w-full");
  });

  it("mostra o texto puro imediatamente e promove a KaTeX após o debounce", async () => {
    const { container } = render(<MathPreview value="sqrt(x+1)" />);

    expect(screen.getByText("sqrt(x+1)")).toBeInTheDocument();
    expect(container.querySelector(".katex")).toBeNull();

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull(), {
      timeout: 2000,
    });
    const annotations = Array.from(container.querySelectorAll("annotation")).map(
      (node) => node.textContent
    );
    expect(annotations.some((latex) => latex?.includes("\\sqrt"))).toBe(true);
  });

  it("renderiza fração real para divisão", async () => {
    const { container } = render(<MathPreview value="(x+1)/(x-1)" />);
    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull(), {
      timeout: 2000,
    });
    expect(
      Array.from(container.querySelectorAll("annotation")).some((node) =>
        node.textContent?.includes("\\frac")
      )
    ).toBe(true);
  });

  it("renderiza limite tipográfico com seta ASCII (->)", async () => {
    const { container } = render(<MathPreview value="lim x->0 sin(x)/x" />);
    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull(), {
      timeout: 2000,
    });
    expect(
      Array.from(container.querySelectorAll("annotation")).some((node) =>
        node.textContent?.includes("\\lim")
      )
    ).toBe(true);
  });

  it("entrada incompleta promove a KaTeX via Tier 2 (nunca fica presa em texto cru)", async () => {
    const { container } = render(<MathPreview value="(x+1)/(x-" />);

    expect(screen.getByText("(x+1)/(x-")).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull(), {
      timeout: 2000,
    });
  });

  it("template visual vazio (√()) promove a KaTeX como radical vazio, nunca expõe o nome interno (sqrt) como texto", async () => {
    const { container } = render(<MathPreview value="√()" />);

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull(), {
      timeout: 2000,
    });
    // O nome interno "sqrt" nunca aparece como TEXTO VISÍVEL (a única
    // ocorrência é dentro da <annotation> MathML oculta, lida por leitor
    // de tela) — o radical vazio é desenhado como glifo, não como palavra.
    expect(container.querySelector(".katex-html")?.textContent).not.toContain("sqrt");
    const annotations = Array.from(container.querySelectorAll("annotation")).map(
      (node) => node.textContent
    );
    expect(annotations.some((latex) => latex?.includes("\\sqrt{}"))).toBe(true);
  });

  it("publica em data-latex-source o texto exato que originou o KaTeX", async () => {
    const { container } = render(<MathPreview value="√(9)" />);

    await waitFor(
      () => {
        const preview = container.querySelector("p[data-latex-source]");
        expect(preview?.getAttribute("data-latex-source")).toBe("√(9)");
      },
      { timeout: 2000 }
    );
    expect(
      Array.from(container.querySelectorAll("annotation")).some((node) =>
        node.textContent?.includes("\\sqrt{9}")
      )
    ).toBe(true);
  });

  it("renderiza a raiz cúbica visual (∛) como radical com índice 3", async () => {
    const { container } = render(<MathPreview value="∛(8)" />);
    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull(), {
      timeout: 2000,
    });
    expect(
      Array.from(container.querySelectorAll("annotation")).some((node) =>
        node.textContent?.includes("\\sqrt[3]{8}")
      )
    ).toBe(true);
  });

  it("renderiza o template visual de exponencial (eˣ(2)) como e elevado", async () => {
    const { container } = render(<MathPreview value="eˣ(2)" />);
    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull(), {
      timeout: 2000,
    });
    expect(
      Array.from(container.querySelectorAll("annotation")).some((node) =>
        node.textContent?.includes("e^{2}")
      )
    ).toBe(true);
  });

  it("renderiza o template visual de potência ((2)ⁿ) com expoente n", async () => {
    const { container } = render(<MathPreview value="(2)ⁿ" />);
    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull(), {
      timeout: 2000,
    });
    expect(
      Array.from(container.querySelectorAll("annotation")).some((node) =>
        node.textContent?.replace(/\s/g, "").includes("^{n}")
      )
    ).toBe(true);
  });

  it("mostra o tratamento cosmético de ** antes do debounce, depois promove a KaTeX com o expoente correto", async () => {
    const { container } = render(<MathPreview value="x**2 +" />);

    expect(container.querySelector("sup")).not.toBeNull();
    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull(), {
      timeout: 2000,
    });
    const annotations = Array.from(container.querySelectorAll("annotation")).map(
      (node) => node.textContent
    );
    expect(annotations.some((latex) => latex?.replace(/\s/g, "").includes("^{2}"))).toBe(true);
  });

  it("clique sequencial em vários botões continua atualizando a pré-visualização via KaTeX a cada passo", async () => {
    const { container, rerender } = render(<MathPreview value="" />);
    expect(screen.getByText("Pré-visualização")).toBeInTheDocument();

    rerender(<MathPreview value="π" />);
    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull(), { timeout: 2000 });

    rerender(<MathPreview value="π≠" />);
    await waitFor(
      () => {
        const annotations = Array.from(container.querySelectorAll("annotation")).map(
          (node) => node.textContent
        );
        expect(annotations.some((latex) => latex?.includes("\\neq"))).toBe(true);
      },
      { timeout: 2000 }
    );

    rerender(<MathPreview value="π≠∫" />);
    await waitFor(
      () => {
        const annotations = Array.from(container.querySelectorAll("annotation")).map(
          (node) => node.textContent
        );
        expect(annotations.some((latex) => latex?.includes("\\int"))).toBe(true);
      },
      { timeout: 2000 }
    );
  });
});
