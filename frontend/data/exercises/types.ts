/**
 * Formato de autoria de um exercício em `data/exercises/`. O Git é a
 * fonte de verdade do CONTEÚDO; `scripts/sync-exercises/` transforma
 * isto para o formato real da tabela `exercises`
 * (`frontend/lib/supabase/types.ts`) e sincroniza por `slug` — nunca
 * pelo texto da pergunta. Ver `LEARNING_RULES.md`.
 *
 * Nomes em camelCase espelhando as colunas reais (statement/
 * statementLatex/choices/correctIndex/explanation/difficulty/position).
 * `explanation` é sempre texto puro (Unicode), NUNCA LaTeX — só
 * `statementLatex` (e, desde a Sprint "KaTeX em alternativas", uma
 * alternativa marcada `format: "math"`) passa pelo KaTeX. Não inventar
 * campos "Latex" que a tela não renderiza.
 */
export type ExerciseDifficultyDraft = "facil" | "medio" | "dificil";

/**
 * Sprint "KaTeX em alternativas" — mesmo formato de `ExerciseChoice` em
 * `lib/supabase/types.ts` (mirror camelCase/snake_case intencional entre
 * autoria e runtime, mesmo padrão já usado pelo resto deste arquivo —
 * nunca um import cruzado entre as duas camadas). `string` continua
 * sendo texto puro, exatamente como todo o catálogo já é hoje — nenhum
 * exercício precisa mudar para continuar funcionando. `{content,
 * format: "math"}` é o jeito de marcar uma alternativa como matemática:
 * `content` continua na MESMA sintaxe do produto (nunca LaTeX
 * pré-escrito), convertida para KaTeX em tempo de renderização via
 * `previewLatex` — reaproveita o MESMO conversor que a Calculadora já
 * usa, nunca um parser paralelo.
 */
export type ExerciseChoiceFormatDraft = "text" | "math";

export interface ExerciseChoiceRichDraft {
  content: string;
  format: ExerciseChoiceFormatDraft;
}

export type ExerciseChoiceDraft = string | ExerciseChoiceRichDraft;

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
  choices: readonly [ExerciseChoiceDraft, ExerciseChoiceDraft, ExerciseChoiceDraft, ExerciseChoiceDraft];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
}
