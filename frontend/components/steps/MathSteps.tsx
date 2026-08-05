"use client";

import { useId, useState } from "react";

import { Button } from "@/components/shared/Button";
import { FadeIn } from "@/components/shared/FadeIn";
import { apiClient } from "@/lib/api/client";
import { ApiError, friendlyMessage } from "@/lib/api/errors";
import type { StepItem } from "@/lib/api/types";

import { MathStepItem } from "./MathStepItem";

interface MathStepsProps {
  expression: string;
}

type Status = "idle" | "loading" | "success" | "error";

interface CacheEntry {
  status: "success" | "error";
  steps: StepItem[];
  errorMessage: string | null;
}

/**
 * Cache em memória por EXPRESSÃO (mesmo padrão de `useSolveLatex.ts`) —
 * fechar/reabrir o painel para o MESMO resultado nunca refaz a
 * requisição, mesmo que o passo a passo tenha vindo com erro (ex. "sistema
 * 3x3, sem passo a passo nesta versão" — reabrir mostra a mesma mensagem
 * sem bater na rede de novo).
 */
const cache = new Map<string, CacheEntry>();
const CACHE_LIMIT = 100;

function setCache(key: string, entry: CacheEntry): void {
  if (!cache.has(key) && cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, entry);
}

/**
 * Sprint V2.9 — botão "Ver passo a passo" + painel expansível. Fechado por
 * padrão; a chamada a `POST /solve/steps` só acontece no primeiro clique
 * (nunca bloqueia o resultado principal, que `ResultPanel` já exibiu antes
 * deste componente sequer montar). Erro é mostrado de forma amigável, sem
 * quebrar o restante da tela.
 */
export function MathSteps({ expression }: MathStepsProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const panelId = useId();

  // Reseta quando a expressão resolvida muda — mesmo padrão de ajuste
  // direto no corpo do render já usado em `ResultPanel`/`ProgressiveMathResult`.
  const [loadedFor, setLoadedFor] = useState(expression);
  if (expression !== loadedFor) {
    setLoadedFor(expression);
    setOpen(false);
    setStatus("idle");
    setSteps([]);
    setErrorMessage(null);
  }

  async function load() {
    const cached = cache.get(expression);
    if (cached) {
      setSteps(cached.steps);
      setErrorMessage(cached.errorMessage);
      setStatus(cached.status);
      return;
    }
    setStatus("loading");
    try {
      const response = await apiClient.solveSteps(expression);
      setCache(expression, { status: "success", steps: response.steps, errorMessage: null });
      setSteps(response.steps);
      setStatus("success");
    } catch (cause) {
      const apiError = cause instanceof ApiError ? cause : new ApiError("network_error");
      const message = friendlyMessage(apiError);
      setCache(expression, { status: "error", steps: [], errorMessage: message });
      setErrorMessage(message);
      setStatus("error");
    }
  }

  function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (status === "idle") void load();
  }

  return (
    <div>
      <Button type="button" variant="ghost" onClick={handleToggle} aria-expanded={open} aria-controls={panelId}>
        {open ? "Ocultar passo a passo" : "Ver passo a passo"}
      </Button>

      {open && (
        <FadeIn>
          <div
            id={panelId}
            role="region"
            aria-label="Passo a passo"
            className="mt-3 min-w-0 rounded-lg border border-border bg-surface p-4"
          >
            {status === "loading" && (
              <p aria-live="polite" className="text-sm text-text-muted">
                Carregando passo a passo...
              </p>
            )}
            {status === "error" && errorMessage !== null && (
              <p role="alert" className="text-sm text-danger">
                {errorMessage}
              </p>
            )}
            {status === "success" && (
              <ol className="flex flex-col gap-3">
                {steps.map((step, index) => (
                  <MathStepItem key={`${index}:${step.expression}`} index={index + 1} step={step} />
                ))}
              </ol>
            )}
          </div>
        </FadeIn>
      )}
    </div>
  );
}
