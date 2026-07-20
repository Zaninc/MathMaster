"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils/cn";
import type { Exercise, ExerciseDifficulty, Topic } from "@/lib/supabase/types";

import { DIFFICULTY_LABELS, ExerciseCard } from "./ExerciseCard";

const DIFFICULTY_ORDER: Record<ExerciseDifficulty, number> = { facil: 0, medio: 1, dificil: 2 };

const DIFFICULTY_FILTERS: Array<{ value: ExerciseDifficulty | "todos"; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "facil", label: DIFFICULTY_LABELS.facil },
  { value: "medio", label: DIFFICULTY_LABELS.medio },
  { value: "dificil", label: DIFFICULTY_LABELS.dificil },
];

interface ExerciseBrowserProps {
  topics: Topic[];
  exercises: Exercise[];
  /** Tópico pré-selecionado (ex.: vindo de /aprendizado?topico=slug via recomendação do Dashboard). */
  initialTopicId?: string;
}

/**
 * Navegação tópico → dificuldade → exercícios. Os dados chegam prontos do
 * Server Component da página (já filtrados pelo RLS de usuário autenticado);
 * aqui é só seleção client-side, sem nova chamada ao Supabase.
 */
export function ExerciseBrowser({ topics, exercises, initialTopicId }: ExerciseBrowserProps) {
  const [activeTopicId, setActiveTopicId] = useState<string | null>(initialTopicId ?? topics[0]?.id ?? null);
  const [difficulty, setDifficulty] = useState<ExerciseDifficulty | "todos">("todos");

  const visibleExercises = useMemo(() => {
    return exercises
      .filter((exercise) => exercise.topic_id === activeTopicId)
      .filter((exercise) => difficulty === "todos" || exercise.difficulty === difficulty)
      .sort(
        (a, b) =>
          DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty] || a.position - b.position
      );
  }, [exercises, activeTopicId, difficulty]);

  const activeTopic = topics.find((topic) => topic.id === activeTopicId);

  if (topics.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface p-6 text-sm text-text-secondary">
        Nenhum tópico disponível ainda — rode a migração de exercícios (0002) no Supabase.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Tópicos" className="flex flex-wrap gap-2">
        {topics.map((topic) => (
          <button
            key={topic.id}
            type="button"
            onClick={() => setActiveTopicId(topic.id)}
            aria-pressed={topic.id === activeTopicId}
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-medium transition-colors duration-(--motion-fast)",
              topic.id === activeTopicId
                ? "border-accent bg-accent/10 text-text-primary"
                : "border-border text-text-secondary hover:border-border-hover hover:text-text-primary"
            )}
          >
            {topic.title}
          </button>
        ))}
      </nav>

      {activeTopic?.description && (
        <p className="text-sm text-text-secondary">{activeTopic.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtro de dificuldade">
        {DIFFICULTY_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setDifficulty(filter.value)}
            aria-pressed={difficulty === filter.value}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-(--motion-fast)",
              difficulty === filter.value
                ? "border-accent bg-accent/10 text-text-primary"
                : "border-border text-text-secondary hover:text-text-primary"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {visibleExercises.length === 0 ? (
        <p className="text-sm text-text-muted">Nenhum exercício nesta combinação de tópico e dificuldade.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {visibleExercises.map((exercise) => (
            <ExerciseCard key={exercise.id} exercise={exercise} />
          ))}
        </div>
      )}
    </div>
  );
}
