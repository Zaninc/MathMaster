import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  apiClient: { solve: vi.fn() },
}));

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import { GeometryWorkspace } from "./GeometryWorkspace";

describe("GeometryWorkspace", () => {
  afterEach(() => {
    vi.mocked(apiClient.solve).mockReset();
  });

  it("calcula área/perímetro/classificação do triângulo localmente, sem chamar o backend", () => {
    render(<GeometryWorkspace />);

    // valores padrão: A(0,0) B(8,0) C(0,5) -> retângulo, área 20
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText(/retângulo/)).toBeInTheDocument();
    expect(apiClient.solve).not.toHaveBeenCalled();
  });

  it("mostra erro pedagógico quando os três pontos do triângulo são colineares", () => {
    render(<GeometryWorkspace />);

    const [, , cY] = screen.getAllByLabelText("y");
    fireEvent.change(cY, { target: { value: "0" } });

    expect(screen.getByText(/não formam um triângulo válido/i)).toBeInTheDocument();
  });

  it("calcula área/comprimento do círculo localmente e chama o backend para a equação real", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({
      expression: "circunferencia((0,0), 5)",
      result: "Tipo: circunferência; Centro: (0, 0); Raio: 5; Equação: x² + y² = 25",
    });

    render(<GeometryWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: "Círculo" }));

    const areaFormula = Array.from(document.querySelectorAll("annotation")).find(
      (node) => node.textContent === "A = \\pi r^2"
    );
    expect(areaFormula).toBeDefined();
    expect(screen.getByText("78.54")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));

    expect(await screen.findByText(/Equação: x² \+ y² = 25/)).toBeInTheDocument();
    expect(apiClient.solve).toHaveBeenCalledWith("circunferencia((0,0), 5)");
  });

  it("mostra a mensagem amigável quando o backend rejeita a figura (ex. parábola diagonal)", async () => {
    vi.mocked(apiClient.solve).mockRejectedValue(
      new ApiError("invalid_expression", "Esta versão só suporta parábolas com eixo paralelo aos eixos coordenados.")
    );

    render(<GeometryWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: "Parábola" }));

    const [, focusX] = screen.getAllByLabelText("x");
    fireEvent.change(focusX, { target: { value: "1" } });
    const [, focusY] = screen.getAllByLabelText("y");
    fireEvent.change(focusY, { target: { value: "1" } });

    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));

    expect(await screen.findByText(/eixo paralelo aos eixos coordenados/i)).toBeInTheDocument();
  });

  it("reseta o resultado do backend ao trocar de figura", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({
      expression: "circunferencia((0,0), 5)",
      result: "Tipo: circunferência; Centro: (0, 0); Raio: 5; Equação: x² + y² = 25",
    });

    render(<GeometryWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: "Círculo" }));
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
    await screen.findByText(/Equação: x² \+ y² = 25/);

    fireEvent.click(screen.getByRole("tab", { name: "Reta" }));

    expect(screen.queryByText(/Equação: x² \+ y² = 25/)).not.toBeInTheDocument();
  });
});
