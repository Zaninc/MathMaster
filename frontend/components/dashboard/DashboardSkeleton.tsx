/**
 * Placeholder de carregamento do /dashboard (Sprint V1.5.5), usado pelo
 * app/dashboard/loading.tsx nativo do Next (Server Component assíncrono
 * — o Next mostra isto automaticamente enquanto os dados carregam).
 * `display: contents` (classe `contents`) faz o wrapper aria-hidden não
 * criar uma caixa própria, então as seções abaixo ocupam o mesmo layout
 * de coluna que a página real usa — troca para o conteúdo real sem
 * salto de layout.
 */
export function DashboardSkeleton() {
  return (
    <div aria-hidden="true" className="contents">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 animate-pulse rounded-full bg-surface-elevated" />
          <div className="flex flex-col gap-2">
            <div className="h-6 w-48 animate-pulse rounded bg-surface-elevated" />
            <div className="h-4 w-64 animate-pulse rounded bg-surface-elevated" />
          </div>
        </div>
        <div className="h-9 w-20 animate-pulse rounded-md bg-surface-elevated" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
            <div className="h-3 w-20 animate-pulse rounded bg-surface-elevated" />
            <div className="h-7 w-12 animate-pulse rounded bg-surface-elevated" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="h-6 w-48 animate-pulse rounded bg-surface-elevated" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
              <div className="h-4 w-32 animate-pulse rounded bg-surface-elevated" />
              <div className="h-2 w-full animate-pulse rounded-full bg-surface-elevated" />
              <div className="h-3 w-40 animate-pulse rounded bg-surface-elevated" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <div className="h-5 w-40 animate-pulse rounded bg-surface-elevated" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-10 w-full animate-pulse rounded-md bg-surface-elevated" />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="h-6 w-40 animate-pulse rounded bg-surface-elevated" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-16 w-full animate-pulse rounded-lg bg-surface-elevated" />
        ))}
      </div>
    </div>
  );
}
