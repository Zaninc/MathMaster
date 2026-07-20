import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { plotExpressionToLatex } from "@/lib/math/graph-normalize";

import { GraphsWorkspace } from "./GraphsWorkspace";

describe("GraphsWorkspace", () => {
  beforeAll(async () => {
    // Aquece o dynamic import do mathjs para os waitFor abaixo serem confiáveis.
    await plotExpressionToLatex("x");
  });

  it("adiciona uma função válida sem erro", async () => {
    render(<GraphsWorkspace />);

    fireEvent.change(screen.getByLabelText(/adicionar função/i), { target: { value: "x^2 - 4" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    // A lista agora renderiza a expressão via KaTeX — consulta pelo aria-label
    // do checkbox (texto cru, inalterado) em vez do texto visual.
    await screen.findByLabelText(/ocultar função x\^2 - 4/i);
    const list = screen.getByRole("list");
    await waitFor(() => expect(within(list).queryByText(/não foi possível/i)).not.toBeInTheDocument());
  });

  it("mostra uma mensagem de erro para expressão bloqueada pela whitelist", async () => {
    render(<GraphsWorkspace />);

    fireEvent.change(screen.getByLabelText(/adicionar função/i), { target: { value: "f(x) = x^2" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(await screen.findByText(/não permitid[ao]/i)).toBeInTheDocument();
  });

  it("adiciona um exemplo pré-definido ao clicar", async () => {
    render(<GraphsWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: /adicionar exemplo trigonométrica/i }));

    const list = screen.getByRole("list");
    await screen.findByLabelText(/ocultar função sin\(x\)/i);
    await waitFor(() => expect(list.querySelector(".katex")).not.toBeNull(), { timeout: 2000 });
  });

  it("alterna a visibilidade de uma função", async () => {
    render(<GraphsWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: /adicionar exemplo linear/i }));

    const checkbox = await screen.findByLabelText(/ocultar função 2x \+ 1/i);
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("remove uma função da lista", async () => {
    render(<GraphsWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: /adicionar exemplo linear/i }));
    await screen.findByLabelText(/ocultar função 2x \+ 1/i);

    fireEvent.click(screen.getByRole("button", { name: /remover função 2x \+ 1/i }));

    await waitFor(() =>
      expect(screen.queryByLabelText(/ocultar função 2x \+ 1/i)).not.toBeInTheDocument()
    );
  });

  describe("entrada natural — mesmo resultado da sintaxe técnica", () => {
    it("x² compila e plota sem erro, igual a x^2", async () => {
      render(<GraphsWorkspace />);

      fireEvent.change(screen.getByLabelText(/adicionar função/i), { target: { value: "x² - 4" } });
      fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

      await screen.findByLabelText(/ocultar função x² - 4/i);
      await waitFor(() =>
        expect(screen.queryByText(/não foi possível|não permitid[ao]/i)).not.toBeInTheDocument()
      );
    });

    it("sen(x) compila e plota sem erro, igual a sin(x)", async () => {
      render(<GraphsWorkspace />);

      fireEvent.change(screen.getByLabelText(/adicionar função/i), { target: { value: "sen(x)" } });
      fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

      await screen.findByLabelText(/ocultar função sen\(x\)/i);
      await waitFor(() =>
        expect(screen.queryByText(/não foi possível|não permitid[ao]/i)).not.toBeInTheDocument()
      );
    });

    it("x(x+1) compila e plota sem erro (ambíguo com chamada de função sem normalização)", async () => {
      render(<GraphsWorkspace />);

      fireEvent.change(screen.getByLabelText(/adicionar função/i), { target: { value: "x(x+1)" } });
      fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

      await screen.findByLabelText(/ocultar função x\(x\+1\)/i);
      await waitFor(() =>
        expect(screen.queryByText(/não foi possível|não permitid[ao]/i)).not.toBeInTheDocument()
      );
    });
  });
});
