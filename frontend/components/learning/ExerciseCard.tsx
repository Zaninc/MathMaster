"use client";

import { useState } from "react";

import { Button } from "@/components/shared/Button";
import { MathFormula } from "@/components/shared/MathFormula";
import { cn } from "@/lib/utils/cn";
import type { Exercise, ExerciseDifficulty } from "@/lib/supabase/types";

export const DIFFICULTY_LABELS: Record<ExerciseDifficulty, string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
};

const DIFFICULTY_BADGE_CLASSES: Record<ExerciseDifficulty, string> = {
  facil: "border-success/40 text-success",
  medio: "border-warning/40 text-warning",
  dificil: "border-red-500/40 text-red-400",
};

interface ExerciseCardProps {
  exercise: Exercise;
}

/**
 * Um exercício de múltipla escolha com correção instantânea no cliente.
 * Nada é persistido (histórico/estatísticas estão fora do escopo da
 * V1.5.2) — o estado vive só neste componente e "Refazer" o zera.
 */
export function ExerciseCard({ exercise }: ExerciseCardProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const answered = selectedIndex !== null;
  const isCorrect = selectedIndex === exercise.correct_index;

  return (
    <article className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-text-primary">{exercise.statement}</p>
          {exercise.statement_latex && (
            <MathFormula formula={exercise.statement_latex} displayMode className="text-text-primary" />
          )}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium",
            DIFFICULTY_BADGE_CLASSES[exercise.difficulty]
          )}
        >
          {DIFFICULTY_LABELS[exercise.difficulty]}
        </span>
      </header>

      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Alternativas">
        {exercise.choices.map((choice, index) => {
          const isSelected = selectedIndex === index;
          const isCorrectChoice = index === exercise.correct_index;
          return (
            <button
              key={index}
              type="button"
              disabled={answered}
              onClick={() => setSelectedIndex(index)}
              aria-pressed={isSelected}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-sm transition-colors duration-(--motion-fast)",
                !answered &&
                  "border-border text-text-primary hover:border-border-hover hover:bg-surface-elevated",
                answered && isCorrectChoice && "border-success/60 bg-success/10 text-success",
                answered && isSelected && !isCorrectChoice && "border-red-500/60 bg-red-500/10 text-red-400",
                answered && !isSelected && !isCorrectChoice && "border-border text-text-muted opacity-60"
              )}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {answered && (
        <footer className="flex flex-col gap-3">
          <p
            role="status"
            className={cn("text-sm font-medium", isCorrect ? "text-success" : "text-red-400")}
          >
            {isCorrect ? "Resposta correta!" : "Resposta incorreta — a alternativa certa está destacada."}
          </p>
          {exercise.explanation && (
            <p className="rounded-md border border-border bg-background px-3 py-2 text-sm text-text-secondary">
              {exercise.explanation}
            </p>
          )}
          <Button variant="ghost" className="self-start" onClick={() => setSelectedIndex(null)}>
            Refazer
          </Button>
        </footer>
      )}
    </article>
  );
}
