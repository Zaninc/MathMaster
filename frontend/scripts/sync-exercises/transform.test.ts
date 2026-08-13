import { describe, expect, it } from "vitest";

import type { ExerciseDraft } from "../../data/exercises/types";
import { toExerciseRow } from "./transform";

const DRAFT: ExerciseDraft = {
  slug: "algebra-basica-simplificacao-001",
  topicSlug: "algebra-basica",
  difficulty: "facil",
  position: 1,
  statement: "Simplifique a expressão:",
  statementLatex: "3x + 2x - x",
  choices: ["5x", "4x", "6x", "x"],
  correctIndex: 1,
  explanation: "3x + 2x - x = 4x.",
};

describe("toExerciseRow", () => {
  it("transforma o draft no formato exato da tabela exercises", () => {
    const row = toExerciseRow(DRAFT, new Map([["algebra-basica", "topic-uuid-123"]]));

    expect(row).toEqual({
      slug: "algebra-basica-simplificacao-001",
      topic_id: "topic-uuid-123",
      difficulty: "facil",
      statement: "Simplifique a expressão:",
      statement_latex: "3x + 2x - x",
      choices: ["5x", "4x", "6x", "x"],
      correct_index: 1,
      explanation: "3x + 2x - x = 4x.",
      position: 1,
    });
  });

  it("statementLatex ausente vira null (nunca undefined) — coerente com a coluna nullable do banco", () => {
    const { statementLatex, ...withoutLatex } = DRAFT;
    void statementLatex;
    const row = toExerciseRow(withoutLatex, new Map([["algebra-basica", "topic-uuid-123"]]));
    expect(row.statement_latex).toBeNull();
  });

  it("nunca inclui id no resultado — upsert por slug preserva o id existente", () => {
    const row = toExerciseRow(DRAFT, new Map([["algebra-basica", "topic-uuid-123"]]));
    expect(row).not.toHaveProperty("id");
  });

  it("lança quando o topicSlug não foi resolvido", () => {
    expect(() => toExerciseRow(DRAFT, new Map())).toThrow(/Tópico "algebra-basica" não encontrado/);
  });

  it("Sprint 'KaTeX em alternativas' — alternativas ricas ({content, format}) passam intactas para a linha", () => {
    const draftWithRichChoices: ExerciseDraft = {
      ...DRAFT,
      choices: [
        { content: "5x", format: "math" },
        { content: "4x", format: "math" },
        "Nenhuma das anteriores",
        { content: "6x", format: "math" },
      ],
    };
    const row = toExerciseRow(draftWithRichChoices, new Map([["algebra-basica", "topic-uuid-123"]]));
    expect(row.choices).toEqual([
      { content: "5x", format: "math" },
      { content: "4x", format: "math" },
      "Nenhuma das anteriores",
      { content: "6x", format: "math" },
    ]);
  });
});
