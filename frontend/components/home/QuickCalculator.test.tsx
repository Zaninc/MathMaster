import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  apiClient: { solve: vi.fn() },
}));

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import { QuickCalculator } from "./QuickCalculator";

describe("QuickCalculator", () => {
  afterEach(() => {
    vi.mocked(apiClient.solve).mockReset();
  });

  it("resolve uma expressão com sucesso e mostra o resultado", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({ expression: "2+2", result: "4" });
    render(<QuickCalculator />);

    fireEvent.change(screen.getByLabelText("Expressão matemática"), { target: { value: "2+2" } });
    fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

    expect(await screen.findByText("4")).toBeInTheDocument();
  });

  it("mostra a mensagem amigável de erro quando o backend rejeita a expressão", async () => {
    vi.mocked(apiClient.solve).mockRejectedValue(
      new ApiError("invalid_expression", "Não foi possível interpretar a expressão: @@@")
    );
    render(<QuickCalculator />);

    fireEvent.change(screen.getByLabelText("Expressão matemática"), { target: { value: "@@@" } });
    fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

    expect(await screen.findByText("Não foi possível interpretar a expressão: @@@")).toBeInTheDocument();
  });

  it("preenche o campo ao clicar em um exemplo, sem enviar automaticamente", () => {
    render(<QuickCalculator />);

    fireEvent.click(screen.getByRole("button", { name: /preencher exemplo: x² - 4 = 0/i }));

    expect(screen.getByLabelText("Expressão matemática")).toHaveValue("x² - 4 = 0");
    expect(apiClient.solve).not.toHaveBeenCalled();
  });

  it("preenche o campo ao clicar em um atalho de categoria", () => {
    render(<QuickCalculator />);

    fireEvent.click(screen.getByRole("button", { name: /preencher exemplo de derivada/i }));

    expect(screen.getByLabelText("Expressão matemática")).toHaveValue("d/dx(x²)");
  });

  it("desabilita o botão Resolver quando o campo está vazio", () => {
    render(<QuickCalculator />);
    expect(screen.getByRole("button", { name: /^resolver$/i })).toBeDisabled();
  });
});
