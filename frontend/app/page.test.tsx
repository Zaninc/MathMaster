import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  apiClient: { solve: vi.fn() },
}));

import Home from "./page";

/**
 * Smoke test de composição — Hero/Pillars/ProgressPreview/FutureTeaser são
 * puramente apresentacionais e não recebem teste dedicado; este único
 * teste confirma que a Home renderiza sem erro e que a copy oficial está
 * presente. Lógica de verdade (estados da calculadora rápida) é coberta
 * em `components/home/QuickCalculator.test.tsx`.
 */
describe("Home", () => {
  it("renderiza o slogan oficial e as seções principais", () => {
    render(<Home />);

    expect(screen.getByText("Ensinar. Acompanhar. Motivar.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ensinar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Acompanhar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Motivar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Seu progresso" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Math Mentor" })).toBeInTheDocument();
  });
});
