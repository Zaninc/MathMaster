import { cn } from "@/lib/utils/cn";
import type { Recommendation, TopicMetrics, TopicStanding } from "@/lib/learning/metrics";

import { DomainMeter } from "./DomainMeter";

const STANDING_BADGES: Record<Exclude<TopicStanding, "neutro">, { label: string; className: string }> = {
  forte: { label: "Ponto forte", className: "border-success/40 text-success" },
  fraco: { label: "Precisa de atenção", className: "border-warning/40 text-warning" },
  "nao-iniciado": { label: "Não iniciado", className: "border-border text-text-muted" },
};

const CONFIDENCE_LABELS = { baixa: "baixa", media: "média", alta: "alta" } as const;

const METER_MESSAGES: Record<TopicStanding, string> = {
  forte: "Você domina este tópico.",
  fraco: "Continue praticando para subir o domínio.",
  neutro: "Bom ritmo — siga praticando.",
  "nao-iniciado": "",
};

/**
 * Seção "Seu progresso" da página de Aprendizado (Sprint V1.5.4).
 * Componente puro e SSR-safe: recebe métricas já calculadas pelo motor
 * (lib/learning/metrics.ts) no Server Component — nenhuma chamada de
 * rede aqui. Reaproveita o DomainMeter compartilhado com a Home.
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
        {metrics.map((topic) => {
          const badge = topic.standing === "neutro" ? null : STANDING_BADGES[topic.standing];
          return (
            <article
              key={topic.topicId}
              className={cn(
                "flex flex-col gap-3 rounded-lg border bg-surface p-4",
                topic.standing === "forte" && "border-success/40",
                topic.standing === "fraco" && "border-warning/40",
                (topic.standing === "neutro" || topic.standing === "nao-iniciado") && "border-border"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-text-primary">{topic.topicTitle}</h3>
                {badge && (
                  <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium", badge.className)}>
                    {badge.label}
                  </span>
                )}
              </div>

              {topic.started && topic.domain !== null ? (
                <>
                  <DomainMeter
                    subject="Domínio"
                    percentage={topic.domain}
                    message={METER_MESSAGES[topic.standing]}
                  />
                  <p className="text-xs text-text-muted">
                    {topic.exercisesTried} de {topic.exercisesTotal} exercícios tentados ·{" "}
                    {topic.attemptsCount} {topic.attemptsCount === 1 ? "tentativa" : "tentativas"} · Confiança{" "}
                    {CONFIDENCE_LABELS[topic.confidence!]}
                  </p>
                </>
              ) : (
                <p className="text-sm text-text-secondary">
                  Nenhuma tentativa ainda — responda um exercício deste tópico para começar a medir.
                </p>
              )}
            </article>
          );
        })}
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
