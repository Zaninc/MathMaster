"use client";

import { useState } from "react";

import { Button } from "@/components/shared/Button";
import { FadeIn } from "@/components/shared/FadeIn";

import { ResultSkeleton } from "./ResultSkeleton";

export type ResultStatus = "idle" | "loading" | "success" | "error";

interface ResultPanelProps {
  status: ResultStatus;
  expression: string;
  result: string | null;
  errorMessage: string | null;
  errorId: string;
  onRetry: () => void;
}

export function ResultPanel({ status, expression, result, errorMessage, errorId, onRetry }: ResultPanelProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível (ex. contexto não seguro) — não é crítico, falha silenciosa
    }
  }

  if (status === "idle") {
    return null;
  }

  return (
    <div aria-live="polite" className="flex flex-col gap-3">
      {status === "loading" && <ResultSkeleton />}

      {status === "success" && result !== null && (
        <FadeIn>
          <div className="rounded-lg border border-success/40 bg-success/10 p-4">
            <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">Resolvido</span>
            <p className="mt-1 text-sm text-text-muted">{expression}</p>
            <p className="mt-2 text-xl text-text-primary">{result}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={handleCopy}>
                {copied ? "Copiado!" : "Copiar"}
              </Button>
              <Button type="button" variant="secondary" onClick={onRetry}>
                Tentar outro
              </Button>
              <Button type="button" variant="ghost" disabled aria-label="Ver explicação — recurso em breve">
                Ver explicação (em breve)
              </Button>
            </div>
          </div>
        </FadeIn>
      )}

      {status === "error" && errorMessage !== null && (
        <FadeIn>
          <p id={errorId} className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
            {errorMessage}
          </p>
        </FadeIn>
      )}
    </div>
  );
}
