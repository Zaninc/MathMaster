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
      approx: null,
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
      approx: null,
    });

    render(<GeometryWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: "Círculo" }));
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
    await screen.findByText(/Equação: x² \+ y² = 25/);

    fireEvent.click(screen.getByRole("tab", { name: "Reta" }));

    expect(screen.queryByText(/Equação: x² \+ y² = 25/)).not.toBeInTheDocument();
  });

  describe("Ferramentas relacionadas (sistema de conexões internas)", () => {
    it("triângulo mostra fórmulas e exercícios, mas NUNCA 'Enviar equação' (cálculo é 100% local)", () => {
      render(<GeometryWorkspace />);

      expect(screen.getByRole("link", { name: "Ver fórmulas" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Exercícios relacionados" })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Enviar equação para a calculadora" })).not.toBeInTheDocument();
    });

    it("círculo mostra fórmulas da circunferência E enviar equação (com a expressão real da figura)", () => {
      render(<GeometryWorkspace />);
      fireEvent.click(screen.getByRole("tab", { name: "Círculo" }));

      expect(screen.getByRole("link", { name: "Ver fórmulas da circunferência" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Enviar equação para a calculadora" })).toHaveAttribute(
        "href",
        expect.stringContaining(encodeURIComponent("circunferencia((0,0), 5)"))
      );
    });

    it("parábola (eixo vertical, preset padrão) mostra 'Abrir nos gráficos' e 'Enviar equação'", () => {
      render(<GeometryWorkspace />);
      fireEvent.click(screen.getByRole("tab", { name: "Parábola" }));

      expect(screen.getByRole("link", { name: "Abrir nos gráficos" })).toHaveAttribute(
        "href",
        expect.stringContaining("/graficos?fn=")
      );
      expect(screen.getByRole("link", { name: "Enviar equação para a calculadora" })).toBeInTheDocument();
    });

    it("parábola de eixo horizontal NÃO mostra 'Abrir nos gráficos' (não é função de x) mas mantém 'Enviar equação'", () => {
      render(<GeometryWorkspace />);
      fireEvent.click(screen.getByRole("tab", { name: "Parábola" }));

      // Foco em (2,0) com vértice em (0,0): mesmo y, eixo horizontal.
      const [, focusX] = screen.getAllByLabelText("x");
      fireEvent.change(focusX, { target: { value: "2" } });
      const [, focusY] = screen.getAllByLabelText("y");
      fireEvent.change(focusY, { target: { value: "0" } });

      expect(screen.queryByRole("link", { name: "Abrir nos gráficos" })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Enviar equação para a calculadora" })).toBeInTheDocument();
    });

    it("elipse/hipérbole/reta mostram só 'Enviar equação' (sem fórmula própria no catálogo)", () => {
      render(<GeometryWorkspace />);

      fireEvent.click(screen.getByRole("tab", { name: "Reta" }));
      expect(screen.getByRole("link", { name: "Enviar equação para a calculadora" })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Ver fórmulas" })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("tab", { name: "Elipse" }));
      expect(screen.getByRole("link", { name: "Enviar equação para a calculadora" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("tab", { name: "Hipérbole" }));
      expect(screen.getByRole("link", { name: "Enviar equação para a calculadora" })).toBeInTheDocument();
    });

    it("todo link tem foco visível e é navegável por teclado (herdado do Button)", () => {
      render(<GeometryWorkspace />);
      const link = screen.getByRole("link", { name: "Ver fórmulas" });
      expect(link.className).toContain("focus-visible:ring-2");
      expect(link.tabIndex).not.toBe(-1);
    });
  });
});
