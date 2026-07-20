import type { Recommendation, TopicMetrics } from "@/lib/learning/metrics";

import { TopicMetricCard } from "./TopicMetricCard";

/**
 * Seção "Seu progresso" da página de Aprendizado (Sprint V1.5.4).
 * Componente puro e SSR-safe: recebe métricas já calculadas pelo motor
 * (lib/learning/metrics.ts) no Server Component — nenhuma chamada de
 * rede aqui. O cartão por tópico é compartilhado com o Dashboard via
 * TopicMetricCard (Sprint V1.5.5).
 */
export function LearningStats({
  metrics,
  recommendations,
}: {
  metrics: TopicMetrics[];
  recommendations: Recommendation[];
}) {
  return (
    <section className="flex flex-col gap-6" aria-label="Seu progresso">
      <h2 className="text-lg font-semibold text-text-primary">Seu progresso</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((topic) => (
          <TopicMetricCard key={topic.topicId} metrics={topic} />
        ))}
      </div>

      {recommendations.length > 0 && (
        <div className="rounded-lg border border-accent/40 bg-accent/10 p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Sugestões de estudo
          </span>
          <ul className="mt-2 flex flex-col gap-1">
            {recommendations.map((recommendation) => (
              <li key={recommendation.topicId} className="text-sm text-text-primary">
                {recommendation.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
