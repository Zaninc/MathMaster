import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  apiClient: { getHistory: vi.fn() },
}));

import { apiClient } from "@/lib/api/client";

import { LearningDashboard } from "./LearningDashboard";

describe("LearningDashboard", () => {
  it("marca claramente as seções demonstrativas como preview", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    render(<LearningDashboard />);

    expect(screen.getAllByText("Preview").length).toBeGreaterThan(0);
    expect(screen.getByText(/dados demonstrativos/i)).toBeInTheDocument();
  });

  it("separa pontos fortes e pontos de atenção pelo limiar de 70%", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    render(<LearningDashboard />);

    expect(screen.getByText(/Álgebra — 92%/)).toBeInTheDocument();
    expect(screen.getByText(/Cálculo — 24%/)).toBeInTheDocument();
  });

  it("mostra a atividade recente real vinda do histórico do backend", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([
      { expression: "2+2", result: "4", timestamp: "2026-01-01T00:00:00Z" },
    ]);

    render(<LearningDashboard />);

    expect(await screen.findByText("2+2 = 4")).toBeInTheDocument();
  });

  it("lista os conceitos futuros da Learning Engine como planejados", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    render(<LearningDashboard />);

    expect(screen.getByText("Learning Graph")).toBeInTheDocument();
    expect(screen.getByText("Confidence Engine")).toBeInTheDocument();
  });
});
