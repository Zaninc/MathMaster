import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SupabaseNotConfigured } from "@/components/auth/SupabaseNotConfigured";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { StudyRecommendations } from "@/components/dashboard/StudyRecommendations";
import { TopicProgress } from "@/components/dashboard/TopicProgress";
import { PageShell } from "@/components/layout/PageShell";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Seu espaço pessoal no MathMaster.",
};

/**
 * Dashboard (Sprint V1.5.5): visão central do aprendizado do aluno,
 * integrando profile, tentativas e Learning Engine (lib/dashboard/getDashboardData.ts
 * centraliza a busca/agregação — nenhuma query solta nos componentes
 * visuais). Autenticação/redirect seguem o mesmo padrão já usado em
 * /aprendizado e /dashboard/historico.
 */
export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <PageShell className="flex justify-center">
        <div className="w-full max-w-md">
          <SupabaseNotConfigured />
        </div>
      </PageShell>
    );
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase!.auth.getUser();
  if (!user) redirect("/login");

  const data = await getDashboardData(supabase!, user.id);
  const isNewAccount = data.stats.totalAttempts === 0;

  return (
    <PageShell className="flex flex-col gap-10">
      <DashboardHeader profile={data.profile} email={user.email ?? ""} />

      {isNewAccount && <DashboardEmptyState />}

      <DashboardStats stats={data.stats} />
      <TopicProgress metrics={data.topicMetrics} />
      <StudyRecommendations recommendations={data.recommendations} hasAnyTopics={data.hasAnyTopics} />
      <RecentActivity attempts={data.recentActivity} />
    </PageShell>
  );
}
