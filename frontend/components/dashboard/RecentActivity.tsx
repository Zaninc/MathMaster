import Link from "next/link";

import { AttemptList, type AttemptView } from "@/components/learning/AttemptList";

interface RecentActivityProps {
  attempts: AttemptView[];
}

/**
 * Atividade recente do dashboard (Sprint V1.5.5) — reaproveita o
 * AttemptList já usado em /dashboard/historico (mesmo componente, mesmo
 * estado vazio; os dados já chegam limitados a 5 pela query). Não
 * duplica a página de histórico, só aponta para ela.
 */
export function RecentActivity({ attempts }: RecentActivityProps) {
  return (
    <section aria-label="Atividade recente" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-text-primary">Atividade recente</h2>
        <Link href="/dashboard/historico" className="text-sm font-medium text-accent hover:underline">
          Ver histórico completo →
        </Link>
      </div>
      <AttemptList attempts={attempts} />
    </section>
  );
}
