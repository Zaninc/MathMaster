import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TriangleResultPanel, type TriangleStats } from "./TriangleResultPanel";

const STATS: TriangleStats = {
  area: 20,
  perimeter: 22.43,
  sideClass: "escaleno",
  angleClass: "retângulo",
  ab: 8,
  bc: 9.43,
  ca: 5,
};

describe("TriangleResultPanel", () => {
  it("mostra a mensagem de erro quando não há estatísticas (pontos colineares)", () => {
    render(<TriangleResultPanel stats={null} />);
    expect(screen.getByText(/não formam um triângulo válido/i)).toBeInTheDocument();
  });

  it("renderiza os índices A/B/C como <sub> HTML real, não como texto", () => {
    render(<TriangleResultPanel stats={STATS} />);
    const subscripts = document.querySelectorAll("sub");
    expect(subscripts.length).toBeGreaterThan(0);
    expect(Array.from(subscripts).map((node) => node.textContent)).toEqual(
      expect.arrayContaining(["A", "B", "C"])
    );
  });

  it("separa a fórmula do resultado numérico da área", () => {
    render(<TriangleResultPanel stats={STATS} />);
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("lista os três lados em linhas separadas", () => {
    render(<TriangleResultPanel stats={STATS} />);
    expect(screen.getByText("AB = 8")).toBeInTheDocument();
    expect(screen.getByText("BC = 9.43")).toBeInTheDocument();
    expect(screen.getByText("CA = 5")).toBeInTheDocument();
  });

  it("capitaliza só a classificação por lados na exibição, sem alterar o valor recebido", () => {
    render(<TriangleResultPanel stats={STATS} />);
    expect(screen.getByText("Escaleno, retângulo")).toBeInTheDocument();
    expect(STATS.sideClass).toBe("escaleno");
  });
});
