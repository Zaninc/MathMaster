import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GraphsWorkspace } from "./GraphsWorkspace";

describe("GraphsWorkspace", () => {
  it("adiciona uma função válida sem erro", async () => {
    render(<GraphsWorkspace />);

    fireEvent.change(screen.getByLabelText(/adicionar função/i), { target: { value: "x^2 - 4" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    const list = screen.getByRole("list");
    expect(await within(list).findByText("x^2 - 4")).toBeInTheDocument();
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
    expect(await within(list).findByText("sin(x)")).toBeInTheDocument();
  });

  it("alterna a visibilidade de uma função", async () => {
    render(<GraphsWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: /adicionar exemplo linear/i }));
    await screen.findByText("2x + 1");

    const checkbox = screen.getByLabelText(/ocultar função 2x \+ 1/i);
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("remove uma função da lista", async () => {
    render(<GraphsWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: /adicionar exemplo linear/i }));
    await screen.findByText("2x + 1");

    fireEvent.click(screen.getByRole("button", { name: /remover função 2x \+ 1/i }));

    await waitFor(() => expect(screen.queryByText("2x + 1")).not.toBeInTheDocument());
  });
});
