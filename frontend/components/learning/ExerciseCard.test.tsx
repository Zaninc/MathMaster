import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const insertMock = vi.fn();
const getSupabaseBrowserClientMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => getSupabaseBrowserClientMock(),
}));

import { exerciseChoiceContent, type Exercise } from "@/lib/supabase/types";

import { ExerciseCard } from "./ExerciseCard";

const EXERCISE: Exercise = {
  id: "ex-1",
  slug: "equacoes-primeiro-grau-teste",
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
  beforeEach(() => {
    vi.clearAllMocks();
    // padrão: Supabase indisponível (unconfigured) — os testes de UI não
    // dependem da gravação; os testes de histórico configuram o mock.
    getSupabaseBrowserClientMock.mockReturnValue(null);
    insertMock.mockReturnValue({ then: (cb: (r: { error: null }) => void) => cb({ error: null }) });
  });

  it("renderiza enunciado, badge de dificuldade e as 4 alternativas", () => {
    render(<ExerciseCard exercise={EXERCISE} />);

    expect(screen.getByText("Resolva a equação:")).toBeInTheDocument();
    expect(screen.getByText("Fácil")).toBeInTheDocument();
    for (const choice of EXERCISE.choices) {
      expect(screen.getByRole("button", { name: exerciseChoiceContent(choice) })).toBeInTheDocument();
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
      expect(screen.getByRole("button", { name: exerciseChoiceContent(choice) })).toBeDisabled();
    }
  });

  it("Refazer zera o estado e reabilita as alternativas", () => {
    render(<ExerciseCard exercise={EXERCISE} />);

    fireEvent.click(screen.getByRole("button", { name: "x = 6" }));
    fireEvent.click(screen.getByRole("button", { name: "Refazer" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "x = -3" })).toBeEnabled();
  });

  it("registra a tentativa no histórico ao responder (só exercise_id + selected_index)", async () => {
    getSupabaseBrowserClientMock.mockReturnValue({
      from: (table: string) => {
        expect(table).toBe("exercise_attempts");
        return { insert: insertMock };
      },
    });
    render(<ExerciseCard exercise={EXERCISE} />);

    fireEvent.click(screen.getByRole("button", { name: "x = 3" }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith({ exercise_id: "ex-1", selected_index: 0 });
    });
  });

  it("sem Supabase configurado, responder funciona e nada é gravado", () => {
    render(<ExerciseCard exercise={EXERCISE} />);

    fireEvent.click(screen.getByRole("button", { name: "x = -3" }));

    expect(screen.getByRole("status")).toHaveTextContent("Resposta correta!");
    expect(insertMock).not.toHaveBeenCalled();
  });

  describe("Sprint 'KaTeX em alternativas' — alternativas com format: math", () => {
    const MATH_EXERCISE: Exercise = {
      ...EXERCISE,
      slug: "equacoes-primeiro-grau-teste-math",
      choices: [
        { content: "x = 3", format: "math" },
        { content: "x = -3", format: "math" },
        { content: "x = -6", format: "math" },
        { content: "x = 6", format: "math" },
      ],
    };

    it("o nome acessível do botão continua o texto puro da alternativa, mesmo renderizada em KaTeX", () => {
      render(<ExerciseCard exercise={MATH_EXERCISE} />);

      // aria-label força o nome acessível ao content original — o mesmo
      // contrato de getByRole com string bare, independente do que o
      // KaTeX injeta visualmente dentro do botão.
      for (const choice of MATH_EXERCISE.choices) {
        const content = typeof choice === "string" ? choice : choice.content;
        expect(screen.getByRole("button", { name: content })).toBeInTheDocument();
      }
    });

    it("seleção e feedback de correto/incorreto continuam funcionando com alternativas em KaTeX", () => {
      render(<ExerciseCard exercise={MATH_EXERCISE} />);

      fireEvent.click(screen.getByRole("button", { name: "x = -3" }));

      expect(screen.getByRole("status")).toHaveTextContent("Resposta correta!");
    });

    it("resposta errada com alternativas em KaTeX desabilita e destaca corretamente", () => {
      render(<ExerciseCard exercise={MATH_EXERCISE} />);

      fireEvent.click(screen.getByRole("button", { name: "x = 3" }));

      expect(screen.getByRole("status")).toHaveTextContent("Resposta incorreta");
      for (const choice of MATH_EXERCISE.choices) {
        const content = typeof choice === "string" ? choice : choice.content;
        expect(screen.getByRole("button", { name: content })).toBeDisabled();
      }
    });
  });
});
