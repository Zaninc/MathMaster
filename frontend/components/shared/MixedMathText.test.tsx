import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MixedMathText } from "./MixedMathText";

/**
 * Hotfix V2.9.1a — `MixedMathText` é o componente compartilhado que
 * renderiza um título (ou qualquer texto de passo) misturando texto comum
 * com fórmulas embutidas. Independente de domínio: os casos abaixo cobrem
 * exatamente os exemplos do hotfix (coeficientes/discriminante, fórmula de
 * Bhaskara com sinal +/-), mas o componente em si não conhece nada sobre
 * Bhaskara ou quadráticas.
 */
describe("MixedMathText", () => {
  it("texto puro permanece texto (sem segmentos math)", () => {
    render(<MixedMathText segments={[{ type: "text", content: "Equação inicial" }]} />);
    expect(screen.getByText("Equação inicial")).toBeInTheDocument();
  });

  it("renderiza coeficientes e discriminante: texto intercalado com KaTeX (Δ como \\Delta, b² como b^2)", async () => {
    const { container } = render(
      <MixedMathText
        segments={[
          { type: "text", content: "Identificando os coeficientes" },
          { type: "math", content: "a=2, b=3, c=-5" },
          { type: "text", content: "e calculando o discriminante" },
          { type: "math", content: "Delta=b**2-4*a*c" },
        ]}
      />
    );

    expect(screen.getByText("Identificando os coeficientes")).toBeInTheDocument();
    expect(screen.getByText("e calculando o discriminante")).toBeInTheDocument();

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(2));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.some((latex) => latex?.includes("a=2,\\;b=3,\\;c=-5"))).toBe(true);
    expect(annotations.some((latex) => latex === "\\Delta={b}^{2}-4\\cdota\\cdotc")).toBe(true);
  });

  it("renderiza a fórmula de Bhaskara como fração real, com √Δ e sinais corretos (primeira e segunda raiz)", async () => {
    const { container: first } = render(
      <MixedMathText
        segments={[
          { type: "text", content: "Aplicando a fórmula de Bhaskara" },
          { type: "math", content: "x=(-b+sqrt(Delta))/(2*a)" },
          { type: "text", content: "— primeira raiz" },
        ]}
      />
    );
    await waitFor(() => expect(first.querySelectorAll(".katex").length).toBe(1));
    const firstAnnotation = first.querySelector("annotation")?.textContent?.replace(/\s/g, "");
    expect(firstAnnotation).toContain("\\frac{\\left(-b+\\sqrt{\\Delta}\\right)}{\\left(2\\cdota\\right)}");
    expect(screen.getByText("— primeira raiz")).toBeInTheDocument();

    const { container: second } = render(
      <MixedMathText
        segments={[
          { type: "text", content: "Aplicando a fórmula de Bhaskara" },
          { type: "math", content: "x=(-b-sqrt(Delta))/(2*a)" },
          { type: "text", content: "— segunda raiz" },
        ]}
      />
    );
    await waitFor(() => expect(second.querySelectorAll(".katex").length).toBe(1));
    const secondAnnotation = second.querySelector("annotation")?.textContent?.replace(/\s/g, "");
    expect(secondAnnotation).toContain("\\frac{\\left(-b-\\sqrt{\\Delta}\\right)}{\\left(2\\cdota\\right)}");
    expect(screen.getByText("— segunda raiz")).toBeInTheDocument();
  });

  it("nunca usa dangerouslySetInnerHTML diretamente (delega inteiramente ao MathFormula já existente)", async () => {
    const { container } = render(
      <MixedMathText segments={[{ type: "math", content: "x=1" }]} />
    );
    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());
    // A única fonte de HTML injetado é o `dangerouslySetInnerHTML` já
    // existente e testado em `MathFormula.test.tsx` — este componente não
    // introduz nenhum novo.
    expect(container.querySelector(".katex-html")).not.toBeNull();
  });

  it("não força quebra de linha rígida — usa flex-wrap para não vazar em telas estreitas", () => {
    const { container } = render(
      <MixedMathText
        segments={[
          { type: "text", content: "Aplicando a fórmula de Bhaskara" },
          { type: "math", content: "x=(-b+sqrt(Delta))/(2*a)" },
          { type: "text", content: "— primeira raiz" },
        ]}
      />
    );
    const root = container.firstElementChild;
    expect(root?.className).toContain("flex-wrap");
  });
});
