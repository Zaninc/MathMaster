import { describe, expect, it } from "vitest";

import { ALL_EXERCISES } from "../../data/exercises";
import { validateCatalog, validateTopicReferences } from "./validate";

/**
 * Sprint "Exponenciais e Logaritmos" — diferente de `validate.test.ts`
 * (que testa `validateCatalog` isoladamente contra fixtures sintéticas),
 * este arquivo valida o catálogo REAL (`ALL_EXERCISES`) — pega erros de
 * autoria (slug duplicado, posição duplicada, tópico inexistente) antes
 * que cheguem a `npm run sync:exercises`.
 */

const KNOWN_TOPIC_SLUGS = new Set([
  "algebra-basica",
  "equacoes",
  "funcoes",
  "exponenciais-logaritmos",
]);

describe("catálogo real (ALL_EXERCISES)", () => {
  it("não tem erros estruturais", () => {
    expect(validateCatalog(ALL_EXERCISES)).toEqual([]);
  });

  it("todo topicSlug referenciado existe nos tópicos conhecidos", () => {
    expect(validateTopicReferences(ALL_EXERCISES, KNOWN_TOPIC_SLUGS)).toEqual([]);
  });

  it("o tópico exponenciais-logaritmos tem 10 exercícios com posições 1-10", () => {
    const topicExercises = ALL_EXERCISES.filter((e) => e.topicSlug === "exponenciais-logaritmos");
    expect(topicExercises).toHaveLength(10);
    expect(topicExercises.map((e) => e.position).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("cobre as três dificuldades no tópico exponenciais-logaritmos", () => {
    const difficulties = new Set(
      ALL_EXERCISES.filter((e) => e.topicSlug === "exponenciais-logaritmos").map((e) => e.difficulty)
    );
    expect(difficulties).toEqual(new Set(["facil", "medio", "dificil"]));
  });
});
