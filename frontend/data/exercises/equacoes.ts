import type { ExerciseDraft } from "./types";

/**
 * Tópico "equacoes". Importado do seed original
 * (`supabase/migrations/0002_topics_exercises.sql`) — nenhum exercício
 * novo nesta etapa, só migrado para o catálogo versionado.
 */
export const EQUACOES_EXERCISES: ExerciseDraft[] = [
  {
    slug: "equacoes-primeiro-grau-001",
    topicSlug: "equacoes",
    difficulty: "facil",
    position: 1,
    statement: "Resolva a equação:",
    statementLatex: String.raw`2x + 6 = 0`,
    choices: ["x = 3", "x = -3", "x = -6", "x = 6"],
    correctIndex: 1,
    explanation: "2x = −6, logo x = −3.",
  },
  {
    slug: "equacoes-segundo-grau-001",
    topicSlug: "equacoes",
    difficulty: "medio",
    position: 2,
    statement: "Quais são as raízes da equação?",
    statementLatex: String.raw`x^2 - 5x + 6 = 0`,
    choices: ["x = 1 e x = 6", "x = -2 e x = -3", "x = 2 e x = 3", "x = -1 e x = -6"],
    correctIndex: 2,
    explanation: "Soma 5 e produto 6: as raízes são 2 e 3.",
  },
  {
    slug: "equacoes-discriminante-001",
    topicSlug: "equacoes",
    difficulty: "dificil",
    position: 3,
    statement: "Para qual valor de k a equação tem exatamente uma raiz real?",
    statementLatex: String.raw`x^2 + kx + 9 = 0`,
    choices: ["k = 3 ou k = -3", "k = 9", "k = 6 ou k = -6", "k = 0"],
    correctIndex: 2,
    explanation: "Uma raiz real exige Δ = 0: k² − 36 = 0, logo k = ±6.",
  },
];
