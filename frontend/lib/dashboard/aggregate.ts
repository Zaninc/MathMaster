import type { Recommendation, TopicMetrics } from "@/lib/learning/metrics";
import type { Topic } from "@/lib/supabase/types";

/**
 * Agregação pura para o Dashboard (Sprint V1.5.5): nenhuma chamada de rede
 * aqui — os números já chegam prontos (contagens exatas do Supabase,
 * métricas da Learning Engine) e esta camada só combina/formata, o que a
 * torna testável sem mockar Supabase. Nenhuma fórmula de domínio é
 * recalculada aqui — isso é responsabilidade exclusiva de
 * lib/learning/metrics.ts.
 */

export interface DashboardStatsData {
  distinctExercisesAttempted: number;
  totalAttempts: number;
  /** 0–100; null quando não há tentativas (evita "0% de acerto" enganoso). */
  accuracyRate: number | null;
  topicsStarted: number;
  topicsTotal: number;
}

export interface RecommendationView extends Recommendation {
  /** null quando o tópico da recomendação não tem slug conhecido (não deveria ocorrer, mas nunca quebra o link). */
  topicSlug: string | null;
}

export interface TopicMetricsView extends TopicMetrics {
  /** null quando o tópico não tem slug conhecido — `TopicMetricCard` simplesmente não vira link nesse caso. */
  topicSlug: string | null;
}

export interface AttemptExerciseRef {
  exercise_id: string;
}

/** null (não number) quando `totalAttempts` é 0 — divisão por zero nunca vira "0%". */
export function computeAccuracyRate(correctAttempts: number, totalAttempts: number): number | null {
  if (totalAttempts <= 0) return null;
  return Math.round((correctAttempts / totalAttempts) * 100);
}

/**
 * Conta exercícios únicos numa janela de tentativas. A janela é limitada
 * (ver getDashboardData) — para o catálogo atual de exercícios (dezenas,
 * não milhares) isso converge para o total real de exercícios já
 * tentados; documentado aqui para quem for esticar o catálogo no futuro.
 */
export function countDistinctExercises(attempts: AttemptExerciseRef[]): number {
  return new Set(attempts.map((attempt) => attempt.exercise_id)).size;
}

export function countTopicsStarted(metrics: TopicMetrics[]): number {
  return metrics.filter((metric) => metric.started).length;
}

export function buildDashboardStats(params: {
  attemptsWindow: AttemptExerciseRef[];
  totalAttempts: number;
  correctAttempts: number;
  metrics: TopicMetrics[];
  topicsTotal: number;
}): DashboardStatsData {
  return {
    distinctExercisesAttempted: countDistinctExercises(params.attemptsWindow),
    totalAttempts: params.totalAttempts,
    accuracyRate: computeAccuracyRate(params.correctAttempts, params.totalAttempts),
    topicsStarted: countTopicsStarted(params.metrics),
    topicsTotal: params.topicsTotal,
  };
}

/** Decora as recomendações da Learning Engine com o slug de rota do tópico, para o CTA "praticar" linkar direto. */
export function attachTopicSlugs(recommendations: Recommendation[], topics: Topic[]): RecommendationView[] {
  const slugByTopicId = new Map(topics.map((topic) => [topic.id, topic.slug]));
  return recommendations.map((recommendation) => ({
    ...recommendation,
    topicSlug: slugByTopicId.get(recommendation.topicId) ?? null,
  }));
}

/**
 * Mesmo padrão de `attachTopicSlugs`, para os cards de progresso por
 * tópico (`TopicProgress`/`TopicMetricCard`) virarem link pra
 * `/aprendizado?topico=slug` — sistema de conexões internas.
 */
export function attachTopicMetricSlugs(metrics: TopicMetrics[], topics: Topic[]): TopicMetricsView[] {
  const slugByTopicId = new Map(topics.map((topic) => [topic.id, topic.slug]));
  return metrics.map((metric) => ({
    ...metric,
    topicSlug: slugByTopicId.get(metric.topicId) ?? null,
  }));
}
