import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { PageShell } from "@/components/layout/PageShell";

export default function DashboardLoading() {
  return (
    <PageShell className="flex flex-col gap-10">
      <DashboardSkeleton />
    </PageShell>
  );
}
