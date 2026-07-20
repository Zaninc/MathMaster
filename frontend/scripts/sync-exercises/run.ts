import type { ExerciseDraft } from "../../data/exercises/types";
import { planSync, type SyncPlan } from "./plan";
import { toExerciseRow } from "./transform";
import { validateCatalog, validateTopicReferences, type ValidationError } from "./validate";

const BATCH_SIZE = 50;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Superfície mínima do Supabase client usada pela sincronização — não a
 * `SupabaseClient` inteira, pra o orquestrador aceitar um fake simples
 * nos testes sem precisar simular a API completa do supabase-js.
 */
export interface SyncSupabaseClient {
  from(table: string): {
    select(columns: string): PromiseLike<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
    upsert(
      rows: unknown[],
      options: { onConflict: string }
    ): PromiseLike<{ error: { message: string } | null }>;
  };
}

export interface SyncResult {
  ok: boolean;
  validationErrors: ValidationError[];
  plan: SyncPlan | null;
  /** true só quando o modo real (não dry-run) chegou a tentar escrever. */
  wrote: boolean;
  writeErrors: number;
}

/**
 * Orquestração do sync — validação → resolução de tópicos → plano →
 * (dry-run: só relata) ou (real: transforma + upsert em lotes). Recebe o
 * cliente Supabase por parâmetro (injeção de dependência) justamente
 * para ser testável com um fake, sem tocar banco real — ver
 * `run.test.ts`. `index.ts` é quem monta o cliente real e chama isto.
 */
export async function runSync(options: {
  catalog: ExerciseDraft[];
  dryRun: boolean;
  supabase: SyncSupabaseClient;
}): Promise<SyncResult> {
  const { catalog, dryRun, supabase } = options;

  const structuralErrors = validateCatalog(catalog);
  if (structuralErrors.length > 0) {
    return { ok: false, validationErrors: structuralErrors, plan: null, wrote: false, writeErrors: 0 };
  }

  const { data: topics, error: topicsError } = await supabase.from("topics").select("id, slug");
  if (topicsError) {
    return {
      ok: false,
      validationErrors: [{ file: "(conexão)", slug: null, message: `Falha ao carregar tópicos: ${topicsError.message}` }],
      plan: null,
      wrote: false,
      writeErrors: 0,
    };
  }
  const topicIdBySlug = new Map((topics ?? []).map((topic) => [String(topic.slug), String(topic.id)]));

  const topicErrors = validateTopicReferences(catalog, new Set(topicIdBySlug.keys()));
  if (topicErrors.length > 0) {
    return { ok: false, validationErrors: topicErrors, plan: null, wrote: false, writeErrors: 0 };
  }

  const { data: remoteExercises, error: remoteError } = await supabase.from("exercises").select("slug");
  if (remoteError) {
    return {
      ok: false,
      validationErrors: [{ file: "(conexão)", slug: null, message: `Falha ao carregar exercícios: ${remoteError.message}` }],
      plan: null,
      wrote: false,
      writeErrors: 0,
    };
  }
  const remoteSlugs = new Set(
    (remoteExercises ?? []).map((row) => (typeof row.slug === "string" ? row.slug : null)).filter((slug): slug is string => Boolean(slug))
  );

  const plan = planSync(
    catalog.map((exercise) => exercise.slug),
    remoteSlugs
  );

  if (dryRun) {
    return { ok: true, validationErrors: [], plan, wrote: false, writeErrors: 0 };
  }

  const rows = catalog.map((exercise) => toExerciseRow(exercise, topicIdBySlug));
  let writeErrors = 0;
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const { error } = await supabase.from("exercises").upsert(batch, { onConflict: "slug" });
    if (error) writeErrors += batch.length;
  }

  return { ok: writeErrors === 0, validationErrors: [], plan, wrote: true, writeErrors };
}
