import type { DashboardStatsData } from "@/lib/dashboard/aggregate";

interface StatTileProps {
  label: string;
  value: string;
  caption?: string;
}

function StatTile({ label, value, caption }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">{label}</span>
      <span className="text-2xl font-semibold text-text-primary">{value}</span>
      {caption && <span className="text-xs text-text-muted">{caption}</span>}
    </div>
  );
}

interface DashboardStatsProps {
  stats: DashboardStatsData;
}

/**
 * Estatísticas principais (Sprint V1.5.5). Recebe os números já
 * calculados por lib/dashboard/aggregate.ts — nenhuma conta acontece
 * aqui, só formatação. `accuracyRate` null vira "—" em vez de "0%": uma
 * conta nova não tem taxa de acerto, não tem 0% dela.
 */
export function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <section aria-label="Estatísticas principais" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile label="Exercícios resolvidos" value={String(stats.distinctExercisesAttempted)} />
      <StatTile label="Tentativas" value={String(stats.totalAttempts)} />
      <StatTile
        label="Taxa de acerto"
        value={stats.accuracyRate === null ? "—" : `${stats.accuracyRate}%`}
        caption={stats.accuracyRate === null ? "Responda um exercício para começar" : undefined}
      />
      <StatTile label="Tópicos estudados" value={`${stats.topicsStarted}/${stats.topicsTotal}`} />
    </section>
  );
}
