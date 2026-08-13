import type { ExerciseChoiceDraft, ExerciseDraft } from "../../data/exercises/types";

/** Formato exato da tabela `exercises` (supabase/migrations/0002_topics_exercises.sql + 0004_exercises_slug.sql). Nunca inclui `id` — em conflito de slug, o upsert preserva o id existente. `choices` aceita `string | {content, format}` desde a Sprint "KaTeX em alternativas" — a constraint `jsonb` do banco só valida a forma do array, nunca o tipo de cada elemento, então nenhuma migração foi necessária. */
export interface ExerciseRow {
  slug: string;
  topic_id: string;
  difficulty: string;
  statement: string;
  statement_latex: string | null;
  choices: ExerciseChoiceDraft[];
  correct_index: number;
  explanation: string;
  position: number;
}

/** Draft (autoria) + mapa slug→id real de tópicos → formato exato da tabela. Lança se o tópico não foi resolvido — só deve ser chamado depois de `validateTopicReferences` passar. */
export function toExerciseRow(exercise: ExerciseDraft, topicIdBySlug: ReadonlyMap<string, string>): ExerciseRow {
  const topicId = topicIdBySlug.get(exercise.topicSlug);
  if (!topicId) {
    throw new Error(
      `Tópico "${exercise.topicSlug}" não encontrado ao transformar o exercício "${exercise.slug}" — valide antes de transformar.`
    );
  }

  return {
    slug: exercise.slug,
    topic_id: topicId,
    difficulty: exercise.difficulty,
    statement: exercise.statement,
    statement_latex: exercise.statementLatex ?? null,
    choices: [...exercise.choices],
    correct_index: exercise.correctIndex,
    explanation: exercise.explanation,
    position: exercise.position,
  };
}
