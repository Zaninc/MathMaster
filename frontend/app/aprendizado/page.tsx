import type { Metadata } from "next";

import { SupabaseNotConfigured } from "@/components/auth/SupabaseNotConfigured";
import { PageShell } from "@/components/layout/PageShell";
import { ExerciseBrowser } from "@/components/learning/ExerciseBrowser";
import { LearningStats } from "@/components/learning/LearningStats";
import { ButtonLink } from "@/components/shared/Button";
import { buildRecommendations, computeTopicMetrics, type AttemptInput } from "@/lib/learning/metrics";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Exercise, Topic } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Aprendizado",
  description: "Exercícios de matemática por tópico e nível de dificuldade.",
};

function PageHeader() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-text-primary">Aprendizado</h1>
      <p className="max-w-2xl text-sm text-text-secondary">
        Exercícios por tópico e nível de dificuldade, com correção na hora. Histórico e
        estatísticas pessoais chegam nas próximas versões.
      </p>
    </div>
  );
}

interface AprendizadoPageProps {
  /** `?topico=slug` — deep-link vindo das recomendações do Dashboard (Sprint V1.5.5). */
  searchParams: Promise<{ topico?: string | string[] }>;
}

/**
 * Sprint V1.5.2: a página de Aprendizado deixou de ser o preview da
 * Learning Engine (Frontend V1) e virou o sistema real de exercícios.
 * Requer login (RLS só libera leitura para usuários autenticados);
 * deslogado vê um convite, nunca um redirect — decisão da sprint.
 */
export default async function AprendizadoPage({ searchParams }: AprendizadoPageProps) {
  const { topico } = await searchParams;
  const topicoSlug = Array.isArray(topico) ? topico[0] : topico;

  if (!isSupabaseConfigured()) {
    return (
      <PageShell className="flex flex-col gap-10">
        <PageHeader />
        <div className="max-w-md">
          <SupabaseNotConfigured />
        </div>
      </PageShell>
    );
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase!.auth.getUser();

  if (!user) {
    return (
      <PageShell className="flex flex-col gap-10">
        <PageHeader />
        <div className="flex max-w-md flex-col gap-4 rounded-lg border border-border bg-surface p-6">
          <h2 className="text-base font-semibold text-text-primary">Entre para praticar</h2>
          <p className="text-sm text-text-secondary">
            Os exercícios são vinculados à sua conta. Entre ou crie uma conta gratuita para
            começar — a Calculadora e as demais ferramentas continuam abertas sem login.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/login">Entrar</ButtonLink>
            <ButtonLink href="/cadastro" variant="secondary">
              Criar conta
            </ButtonLink>
          </div>
        </div>
      </PageShell>
    );
  }

  // Tentativas: só o necessário para o motor (Learning Engine v1). O RLS
  // limita ao próprio usuário; 200 cobre com folga as 20 consideradas por
  // tópico no cálculo de domínio.
  const [{ data: topics }, { data: exercises }, { data: attempts }] = await Promise.all([
    supabase!.from("topics").select("id, slug, title, description, position").order("position"),
    supabase!
      .from("exercises")
      .select("id, topic_id, difficulty, statement, statement_latex, choices, correct_index, explanation, position")
      .order("position"),
    supabase!
      .from("exercise_attempts")
      .select("exercise_id, is_correct, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const topicList = (topics ?? []) as Topic[];
  const exerciseList = (exercises ?? []) as Exercise[];
  const metrics = computeTopicMetrics(topicList, exerciseList, (attempts ?? []) as AttemptInput[]);
  const initialTopicId = topicList.find((topic) => topic.slug === topicoSlug)?.id;

  return (
    <PageShell className="flex flex-col gap-10">
      <PageHeader />
      {topicList.length > 0 && (
        <LearningStats metrics={metrics} recommendations={buildRecommendations(metrics)} />
      )}
      <ExerciseBrowser topics={topicList} exercises={exerciseList} initialTopicId={initialTopicId} />
    </PageShell>
  );
}
