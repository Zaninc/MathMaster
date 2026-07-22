import { TopicMetricCard } from "@/components/learning/TopicMetricCard";
import { exercisesLink } from "@/data/connections";
import type { TopicMetricsView } from "@/lib/dashboard/aggregate";

interface TopicProgressProps {
  metrics: TopicMetricsView[];
}

/**
 * Seção principal do dashboard: progresso por tópico. Reaproveita o
 * DomainMeter (via TopicMetricCard, compartilhado com a página de
 * Aprendizado) em vez de introduzir uma lib de gráficos — as barras já
 * são acessíveis (role="img" com o resumo em texto) e funcionam bem no
 * mobile. Ordenado por domínio (mais forte primeiro, não iniciados por
 * último) para comparação rápida entre tópicos.
 *
 * Cada card vira um link pra `/aprendizado?topico=slug` quando o slug do
 * tópico é conhecido (sistema de conexões internas) — `topicSlug` null
 * (tópico sem slug, não deveria ocorrer) simplesmente deixa o card como
 * antes, sem link.
 */
export function TopicProgress({ metrics }: TopicProgressProps) {
  if (metrics.length === 0) {
    return (
      <section aria-label="Progresso por tópico" className="rounded-lg border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary">Progresso por tópico</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Nenhum tópico disponível ainda — rode a migração de exercícios (0002) no Supabase.
        </p>
      </section>
    );
  }

  const sorted = [...metrics].sort((a, b) => (b.domain ?? -1) - (a.domain ?? -1));

  return (
    <section aria-label="Progresso por tópico" className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-text-primary">Progresso por tópico</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {sorted.map((topic) => (
          <TopicMetricCard
            key={topic.topicId}
            metrics={topic}
            href={topic.topicSlug ? exercisesLink(topic.topicSlug) : undefined}
          />
        ))}
      </div>
    </section>
  );
}
