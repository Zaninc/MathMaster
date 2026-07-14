import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const searchParamsMock = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock(),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: { solve: vi.fn(), getHistory: vi.fn() },
}));

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import { CalculatorWorkspace } from "./CalculatorWorkspace";

describe("CalculatorWorkspace", () => {
  afterEach(() => {
    vi.mocked(apiClient.solve).mockReset();
    vi.mocked(apiClient.getHistory).mockReset();
    searchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it("resolve com sucesso e atualiza o histórico", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    vi.mocked(apiClient.solve).mockResolvedValue({ expression: "2+2", result: "4" });

    render(<CalculatorWorkspace />);

    fireEvent.change(screen.getByLabelText("Expressão matemática"), { target: { value: "2+2" } });
    fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

    expect(await screen.findByText("4")).toBeInTheDocument();
  });

  it("mostra mensagem amigável de erro quando o backend rejeita a expressão", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    vi.mocked(apiClient.solve).mockRejectedValue(
      new ApiError("invalid_expression", "Não foi possível interpretar.")
    );

    render(<CalculatorWorkspace />);

    fireEvent.change(screen.getByLabelText("Expressão matemática"), { target: { value: "@@@" } });
    fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

    expect(await screen.findByText("Não foi possível interpretar.")).toBeInTheDocument();
  });

  it("insere uma tecla do teclado matemático no campo", () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    render(<CalculatorWorkspace />);

    fireEvent.click(screen.getByRole("tab", { name: "Trigonometria" }));
    fireEvent.click(screen.getByRole("button", { name: "Inserir seno" }));

    expect(screen.getByLabelText("Expressão matemática")).toHaveValue("sen()");
  });

  it("pré-preenche a partir da query string sem resolver automaticamente", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("expression=x%C2%B2-4%3D0"));
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);

    render(<CalculatorWorkspace />);

    expect(screen.getByLabelText("Expressão matemática")).toHaveValue("x²-4=0");
    expect(apiClient.solve).not.toHaveBeenCalled();
  });

  it("preenche o campo ao clicar num item do histórico", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([
      { expression: "2+2", result: "4", timestamp: "2026-01-01T00:00:00Z" },
    ]);

    render(<CalculatorWorkspace />);

    const historyButton = await screen.findByRole("button", { name: /reutilizar expressão: 2\+2/i });
    fireEvent.click(historyButton);

    expect(screen.getByLabelText("Expressão matemática")).toHaveValue("2+2");
  });

  it("oculta um item do histórico localmente ao clicar em Ocultar", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([
      { expression: "2+2", result: "4", timestamp: "2026-01-01T00:00:00Z" },
    ]);

    render(<CalculatorWorkspace />);

    await screen.findByText("2+2 = 4");
    fireEvent.click(screen.getByRole("button", { name: /ocultar da lista: 2\+2/i }));

    await waitFor(() => expect(screen.queryByText("2+2 = 4")).not.toBeInTheDocument());
  });
});
