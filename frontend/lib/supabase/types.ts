/**
 * Espelho TypeScript da tabela `profiles` (supabase/migrations/0001_profiles.sql).
 * Se a migração mudar, este tipo muda junto.
 */
export interface Profile {
  id: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

/** Espelhos das tabelas de exercícios (supabase/migrations/0002_topics_exercises.sql). */
export type ExerciseDifficulty = "facil" | "medio" | "dificil";

export interface Topic {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  position: number;
}

export interface Exercise {
  id: string;
  topic_id: string;
  difficulty: ExerciseDifficulty;
  statement: string;
  statement_latex: string | null;
  choices: string[];
  correct_index: number;
  explanation: string | null;
  position: number;
}

/**
 * Espelho de `exercise_attempts` (supabase/migrations/0003_exercise_attempts.sql).
 * `is_correct` é derivado por trigger no banco — o cliente só envia
 * `exercise_id` + `selected_index`.
 */
export interface ExerciseAttempt {
  id: string;
  user_id: string;
  exercise_id: string;
  selected_index: number;
  is_correct: boolean;
  created_at: string;
}
