import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AttemptList, type AttemptView } from "./AttemptList";

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
  {
    id: "a-2",
    statement: "Fatore completamente:",
    topicTitle: "Álgebra básica",
    difficulty: "medio",
    selectedChoice: "x(x−9)",
    isCorrect: false,
    createdAt: "2026-07-19T18:00:00.000Z",
  },
];

describe("AttemptList", () => {
  it("mostra estado vazio orientando para o Aprendizado", () => {
    render(<AttemptList attempts={[]} />);
    expect(screen.getByText(/nenhum exercício respondido ainda/i)).toBeInTheDocument();
  });

  it("renderiza enunciado, tópico, dificuldade e a resposta escolhida", () => {
    render(<AttemptList attempts={ATTEMPTS} />);

    expect(screen.getByText("Resolva a equação:")).toBeInTheDocument();
    expect(screen.getByText(/Equações · Fácil/)).toBeInTheDocument();
    expect(screen.getByText("x = -3")).toBeInTheDocument();
    expect(screen.getByText(/Álgebra básica · Médio/)).toBeInTheDocument();
  });

  it("distingue acerto e erro", () => {
    render(<AttemptList attempts={ATTEMPTS} />);

    expect(screen.getByText("Acertou")).toBeInTheDocument();
    expect(screen.getByText("Errou")).toBeInTheDocument();
  });

  it("formata a data no fuso de São Paulo (determinístico)", () => {
    render(<AttemptList attempts={[ATTEMPTS[0]]} />);

    // 18:30 UTC = 15:30 em America/Sao_Paulo (UTC-3)
    expect(screen.getByText("19/07/2026, 15:30")).toBeInTheDocument();
  });
});
