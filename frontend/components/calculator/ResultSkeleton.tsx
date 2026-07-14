export function ResultSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      <div className="h-3 w-20 animate-pulse rounded bg-surface-elevated" />
      <div className="h-6 w-2/3 animate-pulse rounded bg-surface-elevated" />
    </div>
  );
}
