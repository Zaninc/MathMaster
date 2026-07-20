import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DashboardStatsData } from "@/lib/dashboard/aggregate";

import { DashboardStats } from "./DashboardStats";

describe("DashboardStats", () => {
  it("mostra os quatro números reais formatados", () => {
    const stats: DashboardStatsData = {
      distinctExercisesAttempted: 7,
      totalAttempts: 18,
      accuracyRate: 72,
      topicsStarted: 2,
      topicsTotal: 5,
    };
    render(<DashboardStats stats={stats} />);

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();
    expect(screen.getByText("2/5")).toBeInTheDocument();
  });

  it("conta nova: taxa de acerto mostra travessão, não 0%", () => {
    const stats: DashboardStatsData = {
      distinctExercisesAttempted: 0,
      totalAttempts: 0,
      accuracyRate: null,
      topicsStarted: 0,
      topicsTotal: 5,
    };
    render(<DashboardStats stats={stats} />);

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(screen.getByText("0/5")).toBeInTheDocument();
  });
});
