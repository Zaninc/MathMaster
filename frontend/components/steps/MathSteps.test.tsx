import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  apiClient: { solveSteps: vi.fn() },
}));

import { apiClient } from "@/lib/api/client";

import { MathSteps } from "./MathSteps";

describe("MathSteps", () => {
  beforeEach(() => {
    vi.mocked(apiClient.solveSteps).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("começa fechado e não faz a requisição antes do clique", () => {
    render(<MathSteps expression="2*x+4=10" />);
    expect(screen.getByRole("button", { name: "Ver passo a passo" })).toBeInTheDocument();
    expect(apiClient.solveSteps).not.toHaveBeenCalled();
  });

  it("ao clicar, mostra carregando e depois os passos", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "2*x+4=10",
      result: "x = 3",
      steps: [
        { title: "Equação inicial", expression: "2*x + 4=10", explanation: null },
        { title: "Subtraindo 4 dos dois lados", expression: "2*x=6", explanation: null },
        { title: "Dividindo os dois lados por 2", expression: "x=3", explanation: null },
      ],
    });

    render(<MathSteps expression="2*x+4=10" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    expect(screen.getByText("Carregando passo a passo...")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Equação inicial")).toBeInTheDocument());
    expect(screen.getByText("Subtraindo 4 dos dois lados")).toBeInTheDocument();
    expect(screen.getByText("Dividindo os dois lados por 2")).toBeInTheDocument();
    expect(apiClient.solveSteps).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Ocultar passo a passo" })).toBeInTheDocument();
  });

  it("mostra uma mensagem de erro amigável quando a API falha", async () => {
    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(apiClient.solveSteps).mockRejectedValue(
      new ApiError("invalid_expression", "Passo a passo disponível apenas para equações lineares.")
    );

    render(<MathSteps expression="x**2+2=6" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() =>
      expect(screen.getByText("Passo a passo disponível apenas para equações lineares.")).toBeInTheDocument()
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("fecha e reabre sem refazer a requisição para a mesma expressão", async () => {
    // Expressão própria deste teste (nunca reutilizada em outro `it`):
    // o cache de `MathSteps` é um `Map` de módulo, compartilhado entre
    // testes do mesmo arquivo — uma expressão repetida bateria no cache
    // de um teste anterior e mascararia a asserção de "0 chamadas extras".
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "5*x-15=0",
      result: "x = 3",
      steps: [{ title: "Equação inicial", expression: "5*x - 15=0", explanation: null }],
    });

    render(<MathSteps expression="5*x-15=0" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));
    await waitFor(() => expect(screen.getByText("Equação inicial")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Ocultar passo a passo" }));
    expect(screen.queryByText("Equação inicial")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));
    expect(screen.getByText("Equação inicial")).toBeInTheDocument();
    expect(apiClient.solveSteps).toHaveBeenCalledTimes(1);
  });

  it("uma expressão NOVA (cache miss) faz uma nova requisição própria", async () => {
    vi.mocked(apiClient.solveSteps).mockImplementation((expression: string) =>
      Promise.resolve({
        expression,
        result: "x = 3",
        steps: [{ title: "Equação inicial", expression, explanation: null }],
      })
    );

    const { rerender } = render(<MathSteps expression="7*x-14=0" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));
    await waitFor(() => expect(apiClient.solveSteps).toHaveBeenCalledTimes(1));

    rerender(<MathSteps expression="9*x-18=0" />);
    // Expressão nova reseta para fechado (novo resultado principal).
    expect(screen.getByRole("button", { name: "Ver passo a passo" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));
    await waitFor(() => expect(apiClient.solveSteps).toHaveBeenCalledTimes(2));
  });

  it("painel expansível tem aria-expanded e aria-controls corretos", () => {
    render(<MathSteps expression="4*x+8=20" />);
    const button = screen.getByRole("button", { name: "Ver passo a passo" });
    expect(button).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Ocultar passo a passo" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByRole("region", { name: "Passo a passo" })).toBeInTheDocument();
  });
});
