import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { plotExpressionToLatex } from "@/lib/math/graph-normalize";

import { FunctionList } from "./FunctionList";
import type { PlotFunction } from "./types";

function makeFunction(overrides: Partial<PlotFunction> = {}): PlotFunction {
  return { id: "fn-1", expression: "x^2 - 4", color: "#3d6eff", visible: true, ...overrides };
}

describe("FunctionList", () => {
  beforeAll(async () => {
    // Aquece o dynamic import do mathjs para os waitFor abaixo serem confiáveis.
    await plotExpressionToLatex("x");
  });

  it("mostra estado vazio quando não há funções", () => {
    render(<FunctionList functions={[]} errors={new Map()} onAdd={vi.fn()} onToggle={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(/nenhuma função adicionada ainda/i)).toBeInTheDocument();
  });

  it("renderiza a expressão da função via KaTeX", async () => {
    const { container } = render(
      <FunctionList
        functions={[makeFunction()]}
        errors={new Map()}
        onAdd={vi.fn()}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull(), { timeout: 2000 });
    // annotation carrega o LaTeX resultante (saída do toTex), não o texto original digitado.
    expect(
      Array.from(container.querySelectorAll("annotation")).some((node) => node.textContent?.includes("^{2}"))
    ).toBe(true);
  });

  it("mostra mensagem de erro associada à função, quando existe", () => {
    const errors = new Map([["fn-1", "Não foi possível plotar esta função."]]);
    render(
      <FunctionList
        functions={[makeFunction()]}
        errors={errors}
        onAdd={vi.fn()}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText("Não foi possível plotar esta função.")).toBeInTheDocument();
  });

  it("chama onToggle/onRemove com o id correto, independente da renderização KaTeX", () => {
    const onToggle = vi.fn();
    const onRemove = vi.fn();
    render(
      <FunctionList
        functions={[makeFunction()]}
        errors={new Map()}
        onAdd={vi.fn()}
        onToggle={onToggle}
        onRemove={onRemove}
      />
    );

    fireEvent.click(screen.getByLabelText(/ocultar função x\^2 - 4/i));
    expect(onToggle).toHaveBeenCalledWith("fn-1");

    fireEvent.click(screen.getByRole("button", { name: /remover função x\^2 - 4/i }));
    expect(onRemove).toHaveBeenCalledWith("fn-1");
  });

  it("submete o texto digitado via onAdd, sem alterá-lo", () => {
    const onAdd = vi.fn();
    render(<FunctionList functions={[]} errors={new Map()} onAdd={onAdd} onToggle={vi.fn()} onRemove={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/adicionar função/i), { target: { value: "x² - 4" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(onAdd).toHaveBeenCalledWith("x² - 4");
  });

  it("botões de exemplo continuam mostrando o rótulo da categoria (não mudam nesta tarefa)", () => {
    render(<FunctionList functions={[]} errors={new Map()} onAdd={vi.fn()} onToggle={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByRole("button", { name: /adicionar exemplo linear/i })).toHaveTextContent("Linear");
  });
});
