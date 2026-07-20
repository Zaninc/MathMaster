import { describe, expect, it } from "vitest";

import type { ExerciseDraft } from "../../data/exercises/types";
import { validateCatalog, validateTopicReferences } from "./validate";

function makeExercise(overrides: Partial<ExerciseDraft> = {}): ExerciseDraft {
  return {
    slug: "topico-exemplo-001",
    topicSlug: "topico-exemplo",
    difficulty: "facil",
    position: 1,
    statement: "Enunciado de teste",
    choices: ["a", "b", "c", "d"],
    correctIndex: 0,
    explanation: "Explicação de teste",
    ...overrides,
  };
}

describe("validateCatalog — catálogo válido", () => {
  it("não retorna erros para um catálogo bem formado", () => {
    const catalog = [
      makeExercise({ slug: "topico-exemplo-001", position: 1 }),
      makeExercise({ slug: "topico-exemplo-002", position: 2 }),
    ];
    expect(validateCatalog(catalog)).toEqual([]);
  });
});

describe("validateCatalog — regras individuais", () => {
  it("slug ausente", () => {
    const errors = validateCatalog([makeExercise({ slug: "" })]);
    expect(errors.some((e) => e.message.includes("slug ausente"))).toBe(true);
  });

  it("slug duplicado no catálogo", () => {
    const errors = validateCatalog([
      makeExercise({ slug: "dup-001", position: 1 }),
      makeExercise({ slug: "dup-001", position: 2 }),
    ]);
    expect(errors.some((e) => e.message.includes("slug duplicado"))).toBe(true);
  });

  it("dificuldade inválida", () => {
    // @ts-expect-error valor inválido de propósito
    const errors = validateCatalog([makeExercise({ difficulty: "easy" })]);
    expect(errors.some((e) => e.message.includes("dificuldade inválida"))).toBe(true);
  });

  it("enunciado vazio", () => {
    const errors = validateCatalog([makeExercise({ statement: "   " })]);
    expect(errors.some((e) => e.message.includes("enunciado"))).toBe(true);
  });

  it("quantidade inválida de alternativas", () => {
    // @ts-expect-error tamanho errado de propósito
    const errors = validateCatalog([makeExercise({ choices: ["a", "b", "c"] })]);
    expect(errors.some((e) => e.message.includes("quantidade inválida de alternativas"))).toBe(true);
  });

  it("alternativa vazia", () => {
    const errors = validateCatalog([makeExercise({ choices: ["a", "", "c", "d"] })]);
    expect(errors.some((e) => e.message.includes("alternativa vazia"))).toBe(true);
  });

  it("alternativas duplicadas", () => {
    const errors = validateCatalog([makeExercise({ choices: ["a", "a", "c", "d"] })]);
    expect(errors.some((e) => e.message.includes("alternativas duplicadas"))).toBe(true);
  });

  it("correctIndex fora dos limites", () => {
    // @ts-expect-error valor fora do range de propósito
    const errors = validateCatalog([makeExercise({ correctIndex: 5 })]);
    expect(errors.some((e) => e.message.includes("correctIndex fora dos limites"))).toBe(true);
  });

  it("explicação vazia", () => {
    const errors = validateCatalog([makeExercise({ explanation: "" })]);
    expect(errors.some((e) => e.message.includes("explicação"))).toBe(true);
  });

  it("posição inválida", () => {
    const errors = validateCatalog([makeExercise({ position: -1 })]);
    expect(errors.some((e) => e.message.includes("posição inválida"))).toBe(true);
  });

  it("posição duplicada dentro do mesmo tópico", () => {
    const errors = validateCatalog([
      makeExercise({ slug: "a-001", topicSlug: "algebra", position: 1 }),
      makeExercise({ slug: "a-002", topicSlug: "algebra", position: 1 }),
    ]);
    expect(errors.some((e) => e.message.includes("posição 1 duplicada"))).toBe(true);
  });

  it("a mesma posição em tópicos DIFERENTES não é erro", () => {
    const errors = validateCatalog([
      makeExercise({ slug: "a-001", topicSlug: "algebra", position: 1 }),
      makeExercise({ slug: "b-001", topicSlug: "equacoes", position: 1 }),
    ]);
    expect(errors).toEqual([]);
  });

  it("campos extras não reconhecidos pelo schema do banco", () => {
    const withExtra = { ...makeExercise(), tags: ["algo"] } as ExerciseDraft;
    const errors = validateCatalog([withExtra]);
    expect(errors.some((e) => e.message.includes("campos não reconhecidos"))).toBe(true);
  });

  it("mensagem de erro indica o arquivo provável e o slug", () => {
    const errors = validateCatalog([makeExercise({ slug: "meu-slug", topicSlug: "equacoes", statement: "" })]);
    const error = errors.find((e) => e.message.includes("enunciado"))!;
    expect(error.file).toBe("data/exercises/equacoes.ts");
    expect(error.slug).toBe("meu-slug");
  });
});

describe("validateTopicReferences", () => {
  it("aceita quando o tópico existe no conjunto conhecido", () => {
    const errors = validateTopicReferences([makeExercise({ topicSlug: "algebra-basica" })], new Set(["algebra-basica"]));
    expect(errors).toEqual([]);
  });

  it("reporta tópico inexistente", () => {
    const errors = validateTopicReferences([makeExercise({ topicSlug: "topico-fantasma" })], new Set(["algebra-basica"]));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("tópico inexistente");
    expect(errors[0].message).toContain("topico-fantasma");
  });
});
