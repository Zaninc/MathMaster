import type { ExerciseDraft } from "./types";

/**
 * Tópico "algebra-basica". Importado do seed original
 * (`supabase/migrations/0002_topics_exercises.sql`, já com a correção de
 * notação do commit `17e9271`) — nenhum exercício novo nesta etapa, só
 * migrado para o catálogo versionado.
 */
export const ALGEBRA_BASICA_EXERCISES: ExerciseDraft[] = [
  {
    slug: "algebra-basica-simplificacao-001",
    topicSlug: "algebra-basica",
    difficulty: "facil",
    position: 1,
    statement: "Simplifique a expressão:",
    statementLatex: String.raw`3x + 2x - x`,
    choices: ["5x", "4x", "6x", "x"],
    correctIndex: 1,
    explanation: "3x + 2x - x = (3 + 2 - 1)x = 4x.",
  },
  {
    slug: "algebra-basica-fatoracao-001",
    topicSlug: "algebra-basica",
    difficulty: "medio",
    position: 2,
    statement: "Fatore completamente:",
    statementLatex: String.raw`x^2 - 9`,
    choices: ["(x−3)(x+3)", "(x−9)(x+1)", "(x−3)²", "x(x−9)"],
    correctIndex: 0,
    explanation: "Diferença de quadrados: x² − 9 = x² − 3² = (x−3)(x+3).",
  },
  {
    slug: "algebra-basica-expressao-racional-001",
    topicSlug: "algebra-basica",
    difficulty: "dificil",
    position: 3,
    statement: "Qual é o valor da expressão quando x = 2?",
    statementLatex: String.raw`\dfrac{x^3 - 8}{x - 2}`,
    choices: ["0", "12", "8", "indefinido"],
    correctIndex: 1,
    explanation: "x³ − 8 = (x−2)(x² + 2x + 4); cancelando (x−2), sobra x² + 2x + 4 = 4 + 4 + 4 = 12.",
  },
];
