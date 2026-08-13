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

/**
 * Sprint "KaTeX em alternativas" — formato de UMA alternativa. `string`
 * (o formato original, todo o catálogo até esta sprint) é sempre texto
 * puro, exatamente como já era renderizado. `{content, format}` é
 * aditivo: `format: "math"` sinaliza que `content` é uma expressão na
 * sintaxe já usada pelo produto (ex. "x = 3", "2^x" — a mesma sintaxe de
 * `statement`/entrada da Calculadora, NUNCA LaTeX pré-convertido) e deve
 * ser renderizada em KaTeX via `previewLatex` (`lib/math/to-latex.ts`);
 * `format: "text"` é o equivalente explícito de uma `string` bare, para
 * quando um autor prefere ser explícito. A constraint do banco
 * (`jsonb_typeof(choices)='array' and jsonb_array_length(choices)=4`) só
 * valida a forma do ARRAY, nunca o tipo de cada elemento — nenhuma
 * migração de schema foi necessária para este formato conviver com o
 * antigo na mesma coluna `jsonb`.
 */
export type ExerciseChoiceFormat = "text" | "math";

export interface ExerciseChoiceRich {
  content: string;
  format: ExerciseChoiceFormat;
}

export type ExerciseChoice = string | ExerciseChoiceRich;

/** Texto puro de uma alternativa, independente do formato — usado por qualquer consumidor que só precisa EXIBIR a alternativa como texto (histórico, dashboard), nunca decide KaTeX vs. texto sozinho. */
export function exerciseChoiceContent(choice: ExerciseChoice): string {
  return typeof choice === "string" ? choice : choice.content;
}

export interface Exercise {
  id: string;
  /** Chave estável de sincronização (0004_exercises_slug.sql) — fonte de autoria em frontend/data/exercises/, nunca editada direto no painel. Ver LEARNING_RULES.md. */
  slug: string;
  topic_id: string;
  difficulty: ExerciseDifficulty;
  statement: string;
  statement_latex: string | null;
  choices: ExerciseChoice[];
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
