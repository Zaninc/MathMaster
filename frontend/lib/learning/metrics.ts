import type { Exercise, Topic } from "@/lib/supabase/types";

/**
 * Learning Engine v1 (Sprint V1.5.4) — motor determinístico de métricas
 * sobre o histórico de tentativas. Funções puras: nenhuma chamada de
 * rede, nenhuma IA, nenhuma dependência de relógio — tudo derivado dos
 * dados recebidos, o que torna cada regra testável isoladamente.
 *
 * Todos os parâmetros de calibração ficam nas constantes abaixo — são
 * decisões de produto (opinativas), não verdades matemáticas; ajustar
 * aqui recalibra o sistema inteiro.
 */

/** Subconjunto de exercise_attempts que o motor precisa. */
export interface AttemptInput {
  exercise_id: string;
  is_correct: boolean;
  created_at: string;
}

export type ConfidenceLevel = "baixa" | "media" | "alta";

export type TopicStanding = "nao-iniciado" | "fraco" | "neutro" | "forte";

export interface TopicMetrics {
  topicId: string;
  topicTitle: string;
  started: boolean;
  /** 0–100; null quando o tópico nunca foi tentado ("Não iniciado" ≠ 0%). */
  domain: number | null;
  confidence: ConfidenceLevel | null;
  attemptsCount: number;
  exercisesTried: number;
  exercisesTotal: number;
  standing: TopicStanding;
}

export interface Recommendation {
  topicId: string;
  kind: "practice" | "start" | "dominate";
  message: string;
}

/** Peso multiplicativo aplicado a cada tentativa mais antiga que a anterior. */
export const RECENCY_DECAY = 0.85;
/** Só as N tentativas mais recentes por tópico entram no domínio. */
export const MAX_ATTEMPTS_CONSIDERED = 20;
export const STRONG_DOMAIN_THRESHOLD = 80;
export const WEAK_DOMAIN_THRESHOLD = 50;
/** Tentativas mínimas para confiança média/alta. */
export const CONFIDENCE_MEDIUM_MIN = 4;
export const CONFIDENCE_HIGH_MIN = 10;
export const MAX_RECOMMENDATIONS = 3;

function confidenceFor(attemptsCount: number): ConfidenceLevel {
  if (attemptsCount >= CONFIDENCE_HIGH_MIN) return "alta";
  if (attemptsCount >= CONFIDENCE_MEDIUM_MIN) return "media";
  return "baixa";
}

/**
 * Domínio = média ponderada dos acertos com decaimento por recência:
 * a tentativa mais nova pesa 1, a anterior RECENCY_DECAY, e assim por
 * diante. Errar agora derruba mais que um erro antigo; acertos antigos
 * valem menos que os atuais.
 */
function domainFor(attemptsNewestFirst: AttemptInput[]): number {
  const considered = attemptsNewestFirst.slice(0, MAX_ATTEMPTS_CONSIDERED);
  let weight = 1;
  let weightedHits = 0;
  let totalWeight = 0;
  for (const attempt of considered) {
    if (attempt.is_correct) weightedHits += weight;
    totalWeight += weight;
    weight *= RECENCY_DECAY;
  }
  return Math.round((weightedHits / totalWeight) * 100);
}

function standingFor(metrics: Pick<TopicMetrics, "started" | "domain" | "confidence">): TopicStanding {
  if (!metrics.started || metrics.domain === null) return "nao-iniciado";
  // Forte exige confiança ≥ média: 1 acerto isolado não é domínio.
  if (metrics.domain >= STRONG_DOMAIN_THRESHOLD && metrics.confidence !== "baixa") return "forte";
  if (metrics.domain < WEAK_DOMAIN_THRESHOLD) return "fraco";
  return "neutro";
}

export function computeTopicMetrics(
  topics: Topic[],
  exercises: Pick<Exercise, "id" | "topic_id">[],
  attempts: AttemptInput[]
): TopicMetrics[] {
  const topicByExercise = new Map(exercises.map((exercise) => [exercise.id, exercise.topic_id]));
  const exercisesPerTopic = new Map<string, number>();
  for (const exercise of exercises) {
    exercisesPerTopic.set(exercise.topic_id, (exercisesPerTopic.get(exercise.topic_id) ?? 0) + 1);
  }

  const attemptsByTopic = new Map<string, AttemptInput[]>();
  for (const attempt of attempts) {
    const topicId = topicByExercise.get(attempt.exercise_id);
    if (!topicId) continue; // exercício removido/desconhecido: ignora, nunca quebra
    const bucket = attemptsByTopic.get(topicId);
    if (bucket) bucket.push(attempt);
    else attemptsByTopic.set(topicId, [attempt]);
  }

  return topics.map((topic) => {
    const topicAttempts = (attemptsByTopic.get(topic.id) ?? []).sort(
      (a, b) => b.created_at.localeCompare(a.created_at)
    );
    const started = topicAttempts.length > 0;
    const domain = started ? domainFor(topicAttempts) : null;
    const confidence = started ? confidenceFor(topicAttempts.length) : null;
    const metrics: TopicMetrics = {
      topicId: topic.id,
      topicTitle: topic.title,
      started,
      domain,
      confidence,
      attemptsCount: topicAttempts.length,
      exercisesTried: new Set(topicAttempts.map((attempt) => attempt.exercise_id)).size,
      exercisesTotal: exercisesPerTopic.get(topic.id) ?? 0,
      standing: "nao-iniciado",
    };
    metrics.standing = standingFor(metrics);
    return metrics;
  });
}

/**
 * Recomendações determinísticas derivadas das métricas, priorizando
 * pontos fracos (regra da sprint): 1º praticar os fracos (pior domínio
 * primeiro), 2º começar os não iniciados (ordem dos tópicos), 3º
 * celebrar os fortes (melhor domínio primeiro). Máximo de 3.
 */
export function buildRecommendations(metrics: TopicMetrics[]): Recommendation[] {
  const practice = metrics
    .filter((m) => m.standing === "fraco")
    .sort((a, b) => (a.domain ?? 0) - (b.domain ?? 0))
    .map<Recommendation>((m) => ({
      topicId: m.topicId,
      kind: "practice",
      message: `Continue praticando ${m.topicTitle}`,
    }));

  const start = metrics
    .filter((m) => m.standing === "nao-iniciado")
    .map<Recommendation>((m) => ({
      topicId: m.topicId,
      kind: "start",
      message: `Comece ${m.topicTitle}`,
    }));

  const dominate = metrics
    .filter((m) => m.standing === "forte")
    .sort((a, b) => (b.domain ?? 0) - (a.domain ?? 0))
    .map<Recommendation>((m) => ({
      topicId: m.topicId,
      kind: "dominate",
      message: `Você domina ${m.topicTitle}`,
    }));

  return [...practice, ...start, ...dominate].slice(0, MAX_RECOMMENDATIONS);
}
