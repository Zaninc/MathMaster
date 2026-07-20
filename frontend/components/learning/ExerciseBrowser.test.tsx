import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Exercise, Topic } from "@/lib/supabase/types";

import { ExerciseBrowser } from "./ExerciseBrowser";

const TOPICS: Topic[] = [
  { id: "t-1", slug: "algebra", title: "Álgebra", description: "Expressões e fatoração.", position: 1 },
  { id: "t-2", slug: "equacoes", title: "Equações", description: null, position: 2 },
];

function makeExercise(overrides: Partial<Exercise>): Exercise {
  return {
    id: "ex",
    topic_id: "t-1",
    difficulty: "facil",
    statement: "Enunciado",
    statement_latex: null,
    choices: ["a", "b", "c", "d"],
    correct_index: 0,
    explanation: null,
    position: 1,
    ...overrides,
  };
}

const EXERCISES: Exercise[] = [
  makeExercise({ id: "ex-1", statement: "Fácil de álgebra", difficulty: "facil" }),
  makeExercise({ id: "ex-2", statement: "Difícil de álgebra", difficulty: "dificil" }),
  makeExercise({ id: "ex-3", topic_id: "t-2", statement: "Fácil de equações", difficulty: "facil" }),
];

describe("ExerciseBrowser", () => {
  it("mostra o primeiro tópico por padrão, com sua descrição", () => {
    render(<ExerciseBrowser topics={TOPICS} exercises={EXERCISES} />);

    expect(screen.getByText("Fácil de álgebra")).toBeInTheDocument();
    expect(screen.getByText("Difícil de álgebra")).toBeInTheDocument();
    expect(screen.queryByText("Fácil de equações")).not.toBeInTheDocument();
    expect(screen.getByText("Expressões e fatoração.")).toBeInTheDocument();
  });

  it("troca de tópico ao clicar", () => {
    render(<ExerciseBrowser topics={TOPICS} exercises={EXERCISES} />);

    fireEvent.click(screen.getByRole("button", { name: "Equações" }));

    expect(screen.getByText("Fácil de equações")).toBeInTheDocument();
    expect(screen.queryByText("Fácil de álgebra")).not.toBeInTheDocument();
  });

  it("filtra por dificuldade dentro do tópico ativo", () => {
    render(<ExerciseBrowser topics={TOPICS} exercises={EXERCISES} />);

    const difficultyFilter = screen.getByRole("group", { name: "Filtro de dificuldade" });
    fireEvent.click(within(difficultyFilter).getByRole("button", { name: "Difícil" }));

    expect(screen.getByText("Difícil de álgebra")).toBeInTheDocument();
    expect(screen.queryByText("Fácil de álgebra")).not.toBeInTheDocument();
  });

  it("mostra aviso quando a combinação não tem exercícios", () => {
    render(<ExerciseBrowser topics={TOPICS} exercises={EXERCISES} />);

    fireEvent.click(screen.getByRole("button", { name: "Equações" }));
    const difficultyFilter = screen.getByRole("group", { name: "Filtro de dificuldade" });
    fireEvent.click(within(difficultyFilter).getByRole("button", { name: "Difícil" }));

    expect(screen.getByText(/nenhum exercício nesta combinação/i)).toBeInTheDocument();
  });

  it("sem tópicos, orienta a rodar a migração", () => {
    render(<ExerciseBrowser topics={[]} exercises={[]} />);

    expect(screen.getByText(/rode a migração de exercícios/i)).toBeInTheDocument();
  });

  it("com initialTopicId, abre direto no tópico indicado (deep-link do Dashboard)", () => {
    render(<ExerciseBrowser topics={TOPICS} exercises={EXERCISES} initialTopicId="t-2" />);

    expect(screen.getByText("Fácil de equações")).toBeInTheDocument();
    expect(screen.queryByText("Fácil de álgebra")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Equações" })).toHaveAttribute("aria-pressed", "true");
  });
});
