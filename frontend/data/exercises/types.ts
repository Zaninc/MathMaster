/**
 * Formato de autoria de um exercício em `data/exercises/`. O Git é a
 * fonte de verdade do CONTEÚDO; `scripts/sync-exercises/` transforma
 * isto para o formato real da tabela `exercises`
 * (`frontend/lib/supabase/types.ts`) e sincroniza por `slug` — nunca
 * pelo texto da pergunta. Ver `LEARNING_RULES.md`.
 *
 * Nomes em camelCase espelhando as colunas reais (statement/
 * statementLatex/choices/correctIndex/explanation/difficulty/position).
 * `choices`/`explanation` são texto puro (Unicode), NUNCA LaTeX — só
 * `statementLatex` passa pelo KaTeX em `ExerciseCard.tsx`. Não inventar
 * campos "Latex" que a tela não renderiza.
 */
export type ExerciseDifficultyDraft = "facil" | "medio" | "dificil";

export interface ExerciseDraft {
  /** Chave estável de sincronização — kebab-case, única no catálogo inteiro. Nunca deriva do texto da pergunta. */
  slug: string;
  /** `topics.slug` — precisa existir no banco antes do sync (o script resolve para o id real). */
  topicSlug: string;
  difficulty: ExerciseDifficultyDraft;
  /** Posição de exibição dentro do tópico — única por tópico. */
  position: number;
  statement: string;
  /** Fórmula em destaque (LaTeX), opcional — nem todo exercício tem. */
  statementLatex?: string;
  /** Sempre exatamente 4 (mesma restrição do banco: jsonb_array_length(choices) = 4). */
  choices: readonly [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
}
