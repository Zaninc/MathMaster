import type { SupabaseClient } from "@supabase/supabase-js";

import type { AttemptView } from "@/components/learning/AttemptList";
import { buildRecommendations, computeTopicMetrics, type AttemptInput } from "@/lib/learning/metrics";
import {
  exerciseChoiceContent,
  type Exercise,
  type ExerciseChoice,
  type ExerciseDifficulty,
  type Profile,
  type Topic,
} from "@/lib/supabase/types";

import {
  attachTopicMetricSlugs,
  attachTopicSlugs,
  buildDashboardStats,
  type DashboardStatsData,
  type RecommendationView,
  type TopicMetricsView,
} from "./aggregate";

/** Mesma janela usada em /aprendizado para o cálculo de domínio (ver lib/learning/metrics.ts). */
const METRICS_WINDOW_LIMIT = 200;
/** "Uma quantidade pequena" pedida pela sprint para a atividade recente do dashboard. */
const RECENT_ACTIVITY_LIMIT = 5;

export interface DashboardData {
  profile: Profile | null;
  stats: DashboardStatsData;
  topicMetrics: TopicMetricsView[];
  recommendations: RecommendationView[];
  recentActivity: AttemptView[];
  hasAnyTopics: boolean;
}

/** Shape aninhado devolvido pelo join do PostgREST (exercises → topics), igual ao usado em /dashboard/historico. */
interface RecentAttemptRow {
  id: string;
  selected_index: number;
  is_correct: boolean;
  created_at: string;
  exercises: {
    statement: string;
    difficulty: ExerciseDifficulty;
    choices: ExerciseChoice[];
    topics: { title: string } | null;
  } | null;
}

/**
 * Busca e agrega tudo que o /dashboard precisa (Sprint V1.5.5). Autenticação
 * e o guard de Supabase-não-configurado continuam responsabilidade da
 * página (mesmo padrão de /aprendizado e /dashboard/historico) — esta
 * função assume um `supabase` já criado e um usuário já autenticado.
 *
 * `totalAttempts`/`correctAttempts` vêm de `count: 'exact', head: true`
 * (sem trazer linhas) em vez da janela de 200 usada no cálculo de
 * domínio — evita que "total de tentativas" fique errado para quem já
 * respondeu mais que a janela.
 */
export async function getDashboardData(supabase: SupabaseClient, userId: string): Promise<DashboardData> {
  const [
    { data: profile },
    { data: topics },
    { data: exercises },
    { data: attemptsWindow },
    { count: totalAttempts },
    { count: correctAttempts },
    { data: recentRows },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle<Profile>(),
    supabase.from("topics").select("id, slug, title, description, position").order("position"),
    supabase.from("exercises").select("id, topic_id"),
    supabase
      .from("exercise_attempts")
      .select("exercise_id, is_correct, created_at")
      .order("created_at", { ascending: false })
      .limit(METRICS_WINDOW_LIMIT),
    supabase.from("exercise_attempts").select("id", { count: "exact", head: true }),
    supabase.from("exercise_attempts").select("id", { count: "exact", head: true }).eq("is_correct", true),
    supabase
      .from("exercise_attempts")
      .select(
        "id, selected_index, is_correct, created_at, exercises(statement, difficulty, choices, topics(title))"
      )
      .order("created_at", { ascending: false })
      .limit(RECENT_ACTIVITY_LIMIT),
  ]);

  const topicList = (topics ?? []) as Topic[];
  const exerciseList = (exercises ?? []) as Pick<Exercise, "id" | "topic_id">[];
  const attemptList = (attemptsWindow ?? []) as AttemptInput[];

  const topicMetrics = computeTopicMetrics(topicList, exerciseList, attemptList);
  const recommendations = attachTopicSlugs(buildRecommendations(topicMetrics), topicList);

  const stats = buildDashboardStats({
    attemptsWindow: attemptList,
    totalAttempts: totalAttempts ?? 0,
    correctAttempts: correctAttempts ?? 0,
    metrics: topicMetrics,
    topicsTotal: topicList.length,
  });

  const recentActivity: AttemptView[] = ((recentRows ?? []) as unknown as RecentAttemptRow[])
    .filter((row) => row.exercises !== null)
    .map((row) => ({
      id: row.id,
      statement: row.exercises!.statement,
      topicTitle: row.exercises!.topics?.title ?? "—",
      difficulty: row.exercises!.difficulty,
      selectedChoice:
        row.exercises!.choices[row.selected_index] !== undefined
          ? exerciseChoiceContent(row.exercises!.choices[row.selected_index])
          : "—",
      isCorrect: row.is_correct,
      createdAt: row.created_at,
    }));

  return {
    profile: profile ?? null,
    stats,
    topicMetrics: attachTopicMetricSlugs(topicMetrics, topicList),
    recommendations,
    recentActivity,
    hasAnyTopics: topicList.length > 0,
  };
}
