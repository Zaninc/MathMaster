import Link from "next/link";

import { cn } from "@/lib/utils/cn";
import { CONFIDENCE_LABELS, METER_MESSAGES, STANDING_BADGES } from "@/lib/learning/labels";
import type { TopicMetrics } from "@/lib/learning/metrics";

import { DomainMeter } from "./DomainMeter";

interface TopicMetricCardProps {
  metrics: TopicMetrics;
  /**
   * Rota de `/aprendizado?topico=slug` (sistema de conexões internas).
   * Ausente/omitida = card não clicável (comportamento original,
   * inalterado) — é o caso de `LearningStats` na própria página de
   * Aprendizado, onde linkar pra si mesma não faz sentido.
   */
  href?: string;
}

/**
 * Cartão de progresso de um tópico — compartilhado entre LearningStats
 * (Aprendizado) e TopicProgress (Dashboard). Quando `href` é passado (só
 * o Dashboard passa), o card inteiro vira um link clicável pro tópico
 * correspondente em Aprendizado.
 */
export function TopicMetricCard({ metrics: topic, href }: TopicMetricCardProps) {
  const badge = topic.standing === "neutro" ? null : STANDING_BADGES[topic.standing];

  const className = cn(
    "flex flex-col gap-3 rounded-lg border bg-surface p-4",
    topic.standing === "forte" && "border-success/40",
    topic.standing === "fraco" && "border-warning/40",
    (topic.standing === "neutro" || topic.standing === "nao-iniciado") && "border-border",
    href &&
      "transition-colors duration-(--motion-fast) hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
  );

  const content = (
    <>
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
    </>
  );

  if (href) {
    return (
      <Link href={href} aria-label={`Praticar ${topic.topicTitle}`} className={className}>
        {content}
      </Link>
    );
  }

  return <article className={className}>{content}</article>;
}
