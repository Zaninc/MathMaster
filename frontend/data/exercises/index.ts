import { ALGEBRA_BASICA_EXERCISES } from "./algebra-basica";
import { EQUACOES_EXERCISES } from "./equacoes";
import { FUNCOES_EXERCISES } from "./funcoes";
import type { ExerciseDraft } from "./types";

export type { ExerciseDifficultyDraft, ExerciseDraft } from "./types";

/**
 * Catálogo completo de exercícios — fonte de autoria (Git). Todo arquivo
 * novo de tópico entra aqui. `scripts/sync-exercises/` é quem leva isso
 * para o Supabase; o Supabase nunca é editado diretamente — ver
 * `LEARNING_RULES.md`.
 */
export const ALL_EXERCISES: ExerciseDraft[] = [
  ...ALGEBRA_BASICA_EXERCISES,
  ...EQUACOES_EXERCISES,
  ...FUNCOES_EXERCISES,
];
