import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Exercise } from "@/lib/supabase/types";

import { ExerciseCard } from "./ExerciseCard";

const EXERCISE: Exercise = {
  id: "ex-1",
  topic_id: "t-1",
  difficulty: "facil",
  statement: "Resolva a equação:",
  statement_latex: "2x + 6 = 0",
  choices: ["x = 3", "x = -3", "x = -6", "x = 6"],
  correct_index: 1,
  explanation: "2x = −6, logo x = −3.",
  position: 1,
};

describe("ExerciseCard", () => {
  it("renderiza enunciado, badge de dificuldade e as 4 alternativas", () => {
    render(<ExerciseCard exercise={EXERCISE} />);

    expect(screen.getByText("Resolva a equação:")).toBeInTheDocument();
    expect(screen.getByText("Fácil")).toBeInTheDocument();
    for (const choice of EXERCISE.choices) {
      expect(screen.getByRole("button", { name: choice })).toBeInTheDocument();
    }
  });

  it("acerto mostra feedback positivo e a explicação", () => {
    render(<ExerciseCard exercise={EXERCISE} />);

    fireEvent.click(screen.getByRole("button", { name: "x = -3" }));

    expect(screen.getByRole("status")).toHaveTextContent("Resposta correta!");
    expect(screen.getByText("2x = −6, logo x = −3.")).toBeInTheDocument();
  });

  it("erro mostra feedback negativo e desabilita novas tentativas", () => {
    render(<ExerciseCard exercise={EXERCISE} />);

    fireEvent.click(screen.getByRole("button", { name: "x = 3" }));

    expect(screen.getByRole("status")).toHaveTextContent("Resposta incorreta");
    for (const choice of EXERCISE.choices) {
      expect(screen.getByRole("button", { name: choice })).toBeDisabled();
    }
  });

  it("Refazer zera o estado e reabilita as alternativas", () => {
    render(<ExerciseCard exercise={EXERCISE} />);

    fireEvent.click(screen.getByRole("button", { name: "x = 6" }));
    fireEvent.click(screen.getByRole("button", { name: "Refazer" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "x = -3" })).toBeEnabled();
  });
});
