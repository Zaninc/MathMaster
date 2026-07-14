"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/shared/Button";
import { FadeIn } from "@/components/shared/FadeIn";
import { GRAPH_EXAMPLES } from "@/data/graph-examples";

import type { PlotFunction } from "./types";

interface FunctionListProps {
  functions: PlotFunction[];
  errors: Map<string, string>;
  onAdd: (expression: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}

export function FunctionList({ functions, errors, onAdd, onToggle, onRemove }: FunctionListProps) {
  const [draft, setDraft] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.trim().length === 0) return;
    onAdd(draft.trim());
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label htmlFor="graph-function-input" className="text-sm font-medium text-text-secondary">
          Adicionar função — sintaxe de plotagem (ex.: <code>x^2 - 4</code>, <code>sin(x)</code>)
        </label>
        <div className="flex gap-2">
          <input
            id="graph-function-input"
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="f(x) = ..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
          />
          <Button type="submit" disabled={draft.trim().length === 0}>
            Adicionar
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {GRAPH_EXAMPLES.map((example) => (
          <button
            key={example.label}
            type="button"
            onClick={() => onAdd(example.expression)}
            aria-label={`Adicionar exemplo ${example.label}: ${example.expression}`}
            className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-text-secondary transition-colors duration-(--motion-fast) hover:border-border-hover hover:text-text-primary"
          >
            {example.label}
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {functions.length === 0 && (
          <li className="text-sm text-text-muted">Nenhuma função adicionada ainda.</li>
        )}
        {functions.map((fn) => {
          const error = errors.get(fn.id);
          return (
            <li key={fn.id}>
              <FadeIn className="rounded-md border border-border bg-surface p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={fn.visible}
                    onChange={() => onToggle(fn.id)}
                    aria-label={`${fn.visible ? "Ocultar" : "Mostrar"} função ${fn.expression}`}
                    className="h-4 w-4"
                  />
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: fn.color }}
                  />
                  <code className="flex-1 truncate text-sm text-text-primary">{fn.expression}</code>
                  <button
                    type="button"
                    onClick={() => onRemove(fn.id)}
                    aria-label={`Remover função ${fn.expression}`}
                    className="text-xs text-text-muted transition-colors duration-(--motion-fast) hover:text-danger"
                  >
                    Remover
                  </button>
                </div>
                {error && <p className="mt-1 text-xs text-danger">{error}</p>}
              </FadeIn>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
