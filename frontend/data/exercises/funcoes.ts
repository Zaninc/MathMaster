import type { ExerciseDraft } from "./types";

/**
 * Tópico "funcoes". Importado do seed original
 * (`supabase/migrations/0002_topics_exercises.sql`) — nenhum exercício
 * novo nesta etapa, só migrado para o catálogo versionado.
 */
export const FUNCOES_EXERCISES: ExerciseDraft[] = [
  {
    slug: "funcoes-avaliacao-001",
    topicSlug: "funcoes",
    difficulty: "facil",
    position: 1,
    statement: "Se f(x) = 2x + 1, quanto vale f(3)?",
    choices: ["6", "5", "7", "9"],
    correctIndex: 2,
    explanation: "f(3) = 2·3 + 1 = 7.",
  },
  {
    slug: "funcoes-dominio-001",
    topicSlug: "funcoes",
    difficulty: "medio",
    position: 2,
    statement: "Qual é o domínio da função?",
    statementLatex: String.raw`f(x) = \dfrac{1}{x - 4}`,
    choices: ["x > 4", "Todos os reais", "Todos os reais exceto 0", "Todos os reais exceto 4"],
    correctIndex: 3,
    explanation: "O denominador não pode ser zero: x − 4 ≠ 0, logo x ≠ 4.",
  },
  {
    slug: "funcoes-composicao-001",
    topicSlug: "funcoes",
    difficulty: "dificil",
    position: 3,
    statement: "Se f(x) = x² e g(x) = x + 1, qual é f(g(2))?",
    choices: ["5", "6", "3", "9"],
    correctIndex: 3,
    explanation: "g(2) = 3 e f(3) = 3² = 9.",
  },
];
