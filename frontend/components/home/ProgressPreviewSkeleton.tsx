/**
 * Placeholder de carregamento da seção "Seu progresso" da Home, usado
 * como fallback do `<Suspense>` em app/page.tsx enquanto
 * `getProgressPreviewData` resolve. `aria-hidden` + `display:contents`
 * no wrapper: decorativo pra leitor de tela, sem caixa própria no
 * layout (mesma técnica de components/dashboard/DashboardSkeleton.tsx).
 */
export function ProgressPreviewSkeleton() {
  return (
    <section className="border-b border-border py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-xl font-semibold text-text-primary">Seu progresso</h2>
        <div aria-hidden="true" className="flex flex-col gap-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-4">
                <div className="h-4 w-24 animate-pulse rounded bg-surface-elevated" />
                <div className="h-4 w-10 animate-pulse rounded bg-surface-elevated" />
              </div>
              <div className="h-2 w-full animate-pulse rounded-full bg-surface-elevated" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
