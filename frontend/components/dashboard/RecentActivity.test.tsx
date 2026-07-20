import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AttemptView } from "@/components/learning/AttemptList";

import { RecentActivity } from "./RecentActivity";

const ATTEMPTS: AttemptView[] = [
  {
    id: "a-1",
    statement: "Resolva a equação:",
    topicTitle: "Equações",
    difficulty: "facil",
    selectedChoice: "x = -3",
    isCorrect: true,
    createdAt: "2026-07-19T18:30:00.000Z",
  },
];

describe("RecentActivity", () => {
  it("renderiza as tentativas recebidas via AttemptList", () => {
    render(<RecentActivity attempts={ATTEMPTS} />);
    expect(screen.getByText("Resolva a equação:")).toBeInTheDocument();
  });

  it("sempre mostra o link para o histórico completo", () => {
    render(<RecentActivity attempts={ATTEMPTS} />);
    expect(screen.getByRole("link", { name: /ver histórico completo/i })).toHaveAttribute(
      "href",
      "/dashboard/historico"
    );
  });

  it("estado vazio: mostra a mesma orientação do AttemptList, sem duplicar a página de histórico", () => {
    render(<RecentActivity attempts={[]} />);
    expect(screen.getByText(/nenhum exercício respondido ainda/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ver histórico completo/i })).toBeInTheDocument();
  });
});
