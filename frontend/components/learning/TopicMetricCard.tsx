import { cn } from "@/lib/utils/cn";
import { CONFIDENCE_LABELS, METER_MESSAGES, STANDING_BADGES } from "@/lib/learning/labels";
import type { TopicMetrics } from "@/lib/learning/metrics";

import { DomainMeter } from "./DomainMeter";

interface TopicMetricCardProps {
  metrics: TopicMetrics;
}

/**
 * Cartão de progresso de um tópico — compartilhado entre LearningStats
 * (Aprendizado) e TopicProgress (Dashboard, Sprint V1.5.5) para as duas
 * telas nunca divergirem no texto/cor do mesmo standing.
 */
export function TopicMetricCard({ metrics: topic }: TopicMetricCardProps) {
  const badge = topic.standing === "neutro" ? null : STANDING_BADGES[topic.standing];

  return (
    <article
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
          <DomainMeter subject="Domínio" percentage={topic.domain} message={METER_MESSAGES[topic.standing]} />
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
}
