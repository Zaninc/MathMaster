import { computeTopicMetrics, type AttemptInput, type TopicMetrics } from "@/lib/learning/metrics";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Exercise, Topic } from "@/lib/supabase/types";

/** Mesma janela de /aprendizado e /dashboard para o cálculo de domínio (ver lib/learning/metrics.ts). */
const METRICS_WINDOW_LIMIT = 200;
/** Prévia enxuta pra Home — não é a página de Aprendizado inteira. */
const PREVIEW_TOPIC_LIMIT = 3;

export type ProgressPreviewData =
  | { status: "signed-out" }
  | { status: "new-account" }
  | { status: "error" }
  | { status: "ready"; topics: TopicMetrics[] };

/**
 * Só os tópicos JÁ INICIADOS entram na prévia da Home, ordenados por
 * domínio (maior primeiro) — nunca preenche com "não iniciado" pra
 * completar 3 (isso exigiria mostrar um card sem barra de progresso,
 * ou inventar um 0% que não existe — "não usar porcentagens fictícias"
 * é regra explícita desta sprint). Conta com menos de 3 tópicos
 * iniciados simplesmente mostra menos barras.
 */
export function selectPreviewTopics(metrics: TopicMetrics[]): TopicMetrics[] {
  return metrics
    .filter((topic) => topic.started)
    .sort((a, b) => (b.domain ?? 0) - (a.domain ?? 0))
    .slice(0, PREVIEW_TOPIC_LIMIT);
}

/**
 * Dados reais de progresso pra prévia da Home. Fail-closed por design
 * (nunca lança — uma falha aqui não pode derrubar a Home inteira): erro
 * de rede/Supabase vira `{status:"error"}`, nunca uma exceção não
 * tratada. Reaproveita `computeTopicMetrics` (lib/learning/metrics.ts,
 * a mesma Learning Engine de /aprendizado e /dashboard) — nenhuma
 * fórmula de domínio/confiança recalculada aqui.
 */
export async function getProgressPreviewData(): Promise<ProgressPreviewData> {
  if (!isSupabaseConfigured()) return { status: "signed-out" };

  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase!.auth.getUser();
    if (!user) return { status: "signed-out" };

    const [{ data: topics }, { data: exercises }, { data: attempts }] = await Promise.all([
      supabase!.from("topics").select("id, slug, title, description, position").order("position"),
      supabase!.from("exercises").select("id, topic_id"),
      supabase!
        .from("exercise_attempts")
        .select("exercise_id, is_correct, created_at")
        .order("created_at", { ascending: false })
        .limit(METRICS_WINDOW_LIMIT),
    ]);

    const attemptList = (attempts ?? []) as AttemptInput[];
    if (attemptList.length === 0) return { status: "new-account" };

    const topicList = (topics ?? []) as Topic[];
    const exerciseList = (exercises ?? []) as Pick<Exercise, "id" | "topic_id">[];
    const metrics = computeTopicMetrics(topicList, exerciseList, attemptList);
    const preview = selectPreviewTopics(metrics);

    return preview.length === 0 ? { status: "new-account" } : { status: "ready", topics: preview };
  } catch {
    return { status: "error" };
  }
}
