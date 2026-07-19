import type { Metadata } from "next";

import { SupabaseNotConfigured } from "@/components/auth/SupabaseNotConfigured";
import { PageShell } from "@/components/layout/PageShell";
import { ExerciseBrowser } from "@/components/learning/ExerciseBrowser";
import { ButtonLink } from "@/components/shared/Button";
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

/**
 * Sprint V1.5.2: a página de Aprendizado deixou de ser o preview da
 * Learning Engine (Frontend V1) e virou o sistema real de exercícios.
 * Requer login (RLS só libera leitura para usuários autenticados);
 * deslogado vê um convite, nunca um redirect — decisão da sprint.
 */
export default async function AprendizadoPage() {
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

  const [{ data: topics }, { data: exercises }] = await Promise.all([
    supabase!.from("topics").select("id, slug, title, description, position").order("position"),
    supabase!
      .from("exercises")
      .select("id, topic_id, difficulty, statement, statement_latex, choices, correct_index, explanation, position")
      .order("position"),
  ]);

  return (
    <PageShell className="flex flex-col gap-10">
      <PageHeader />
      <ExerciseBrowser topics={(topics ?? []) as Topic[]} exercises={(exercises ?? []) as Exercise[]} />
    </PageShell>
  );
}
