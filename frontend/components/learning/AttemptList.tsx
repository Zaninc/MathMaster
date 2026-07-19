import { cn } from "@/lib/utils/cn";
import type { ExerciseDifficulty } from "@/lib/supabase/types";

import { DIFFICULTY_LABELS } from "./ExerciseCard";

/**
 * View model achatado pela página (o shape aninhado do join do PostgREST
 * não vaza para cá) — mantém o componente puro e testável sem Supabase.
 */
export interface AttemptView {
  id: string;
  statement: string;
  topicTitle: string;
  difficulty: ExerciseDifficulty;
  selectedChoice: string;
  isCorrect: boolean;
  createdAt: string;
}

/**
 * Fuso fixo do produto (PT-BR): determinístico entre servidor e cliente
 * — formatar no fuso da máquina geraria mismatch de hidratação e
 * horários UTC num deploy futuro.
 */
const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function AttemptList({ attempts }: { attempts: AttemptView[] }) {
  if (attempts.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface p-6 text-sm text-text-secondary">
        Nenhum exercício respondido ainda — comece pela página de Aprendizado.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {attempts.map((attempt) => (
        <li
          key={attempt.id}
          className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm font-medium text-text-primary">{attempt.statement}</p>
            <p className="text-xs text-text-muted">
              {attempt.topicTitle} · {DIFFICULTY_LABELS[attempt.difficulty]} · Sua resposta:{" "}
              <span className="text-text-secondary">{attempt.selectedChoice}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                attempt.isCorrect
                  ? "border-success/40 text-success"
                  : "border-red-500/40 text-red-400"
              )}
            >
              {attempt.isCorrect ? "Acertou" : "Errou"}
            </span>
            <time dateTime={attempt.createdAt} className="text-xs text-text-muted">
              {DATE_FORMATTER.format(new Date(attempt.createdAt))}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}
