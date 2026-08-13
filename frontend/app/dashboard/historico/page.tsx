import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SupabaseNotConfigured } from "@/components/auth/SupabaseNotConfigured";
import { PageShell } from "@/components/layout/PageShell";
import { AttemptList, type AttemptView } from "@/components/learning/AttemptList";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { exerciseChoiceContent, type ExerciseChoice, type ExerciseDifficulty } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Histórico",
  description: "Seus exercícios resolvidos recentemente.",
};

const RECENT_LIMIT = 20;

/** Shape aninhado devolvido pelo join do PostgREST (exercises → topics). */
interface AttemptRow {
  id: string;
  selected_index: number;
  is_correct: boolean;
  created_at: string;
  exercises: {
    statement: string;
    difficulty: ExerciseDifficulty;
    choices: ExerciseChoice[];
    topics: { title: string } | null;
  } | null;
}

/**
 * Histórico de tentativas (Sprint V1.5.3). Mesma proteção do /dashboard:
 * redirect para /login sem sessão. O RLS já limita a consulta às
 * tentativas do próprio usuário — o filtro por user_id é do banco,
 * não confiado ao frontend.
 */
export default async function HistoricoPage() {
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

  const { data } = await supabase!
    .from("exercise_attempts")
    .select(
      "id, selected_index, is_correct, created_at, exercises(statement, difficulty, choices, topics(title))"
    )
    .order("created_at", { ascending: false })
    .limit(RECENT_LIMIT);

  const attempts: AttemptView[] = ((data ?? []) as unknown as AttemptRow[])
    .filter((row) => row.exercises !== null)
    .map((row) => ({
      id: row.id,
      statement: row.exercises!.statement,
      topicTitle: row.exercises!.topics?.title ?? "—",
      difficulty: row.exercises!.difficulty,
      selectedChoice:
        row.exercises!.choices[row.selected_index] !== undefined
          ? exerciseChoiceContent(row.exercises!.choices[row.selected_index])
          : "—",
      isCorrect: row.is_correct,
      createdAt: row.created_at,
    }));

  return (
    <PageShell className="flex flex-col gap-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-text-primary">Histórico</h1>
          <p className="max-w-2xl text-sm text-text-secondary">
            Suas últimas {RECENT_LIMIT} respostas, das mais recentes para as mais antigas.
            Estatísticas e evolução por tópico chegam nas próximas versões.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-accent hover:underline">
          ← Voltar ao dashboard
        </Link>
      </div>

      <AttemptList attempts={attempts} />
    </PageShell>
  );
}
