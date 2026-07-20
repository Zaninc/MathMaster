import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { QUICK_EXAMPLES } from "@/data/examples";
import { inputToLatex } from "@/lib/math/to-latex";

import { ExampleButton } from "./ExampleButton";

const DERIVATIVE_EXAMPLE = QUICK_EXAMPLES.find((example) => example.expression.startsWith("d/dx"))!;

describe("ExampleButton", () => {
  beforeAll(async () => {
    // Aquece o dynamic import do mathjs para os waitFor abaixo serem confiáveis.
    await inputToLatex("x");
  });

  it("renderiza a expressão com KaTeX quando a conversão é reconhecida", async () => {
    const { container } = render(<ExampleButton example={DERIVATIVE_EXAMPLE} onSelect={vi.fn()} />);

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull(), { timeout: 2000 });
    expect(
      Array.from(container.querySelectorAll("annotation")).some((node) =>
        node.textContent?.includes(String.raw`\frac{d}{dx}`)
      )
    ).toBe(true);
  });

  it("ao clicar, chama onSelect com a expressão EXATA enviada, não o LaTeX exibido", async () => {
    const onSelect = vi.fn();
    const { container } = render(<ExampleButton example={DERIVATIVE_EXAMPLE} onSelect={onSelect} />);

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull(), { timeout: 2000 });
    fireEvent.click(screen.getByRole("button"));

    expect(onSelect).toHaveBeenCalledWith(DERIVATIVE_EXAMPLE.expression);
    expect(onSelect).toHaveBeenCalledWith("d/dx(x² + 3x)");
  });

  it("mantém o aria-label em texto cru, com ou sem KaTeX", async () => {
    render(<ExampleButton example={DERIVATIVE_EXAMPLE} onSelect={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: `Preencher exemplo: ${DERIVATIVE_EXAMPLE.label}` })
    ).toBeInTheDocument();
  });

  it("expressão não reconhecida cai no fallback de texto puro (label), sem quebrar nem chamar onSelect errado", async () => {
    const onSelect = vi.fn();
    const example = { label: "crescente", expression: "crescente" };
    const { container } = render(<ExampleButton example={example} onSelect={onSelect} />);

    expect(screen.getByText("crescente")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(container.querySelector(".katex")).toBeNull();
    expect(screen.getByText("crescente")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("crescente");
  });
});
