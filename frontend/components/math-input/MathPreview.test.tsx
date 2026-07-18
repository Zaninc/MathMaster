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

  it("mantém o fallback textual sem erro para entrada incompleta", async () => {
    const { container } = render(<MathPreview value="(x+1)/(x-" />);

    expect(screen.getByText("(x+1)/(x-")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(container.querySelector(".katex")).toBeNull();
    expect(screen.getByText("(x+1)/(x-")).toBeInTheDocument();
  });

  it("preserva o tratamento cosmético de ** no fallback", async () => {
    const { container } = render(<MathPreview value="x**2 +" />);

    expect(container.querySelector("sup")).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(container.querySelector(".katex")).toBeNull();
    expect(container.querySelector("sup")).not.toBeNull();
  });
});
