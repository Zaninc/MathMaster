"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/shared/Button";
import { FadeIn } from "@/components/shared/FadeIn";
import { MathFormula } from "@/components/shared/MathFormula";
import { getCalculatorExplorations } from "@/data/connections";
import { useSolveLatex } from "@/hooks/useSolveLatex";

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

/**
 * Progressive enhancement (Sprint KaTeX Fase 2): o texto puro do backend é
 * SEMPRE renderizado primeiro (mesma UI de antes); quando a conversão
 * assíncrona via `useSolveLatex` (chunk do mathjs, dynamic import) resolve
 * com sucesso, a exibição é promovida a KaTeX. Conversão nula ou pendente
 * = exatamente a calculadora anterior — nenhum caminho novo de falha.
 * "Copiar" continua copiando o texto cru do backend, nunca LaTeX.
 */
export function ResultPanel({ status, expression, result, errorMessage, errorId, onRetry }: ResultPanelProps) {
  const [copied, setCopied] = useState(false);
  const success = status === "success" && result !== null;
  const { expressionLatex, segments } = useSolveLatex(
    success ? expression : null,
    success ? result : null
  );
  const explorations = success ? getCalculatorExplorations(expression) : [];

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

      {success && (
        <FadeIn>
          <div className="rounded-lg border border-success/40 bg-success/10 p-4">
            <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">Resolvido</span>
            <p className="mt-1 text-sm text-text-muted">
              {expressionLatex !== null ? <MathFormula formula={expressionLatex} /> : expression}
            </p>
            {segments !== null ? (
              <div className="mt-2 flex flex-col gap-1 text-lg text-text-primary">
                {segments.map((segment) => (
                  <p
                    key={`${segment.label ?? ""}:${segment.text}`}
                    className="flex flex-wrap items-baseline gap-x-2 [overflow-wrap:anywhere]"
                  >
                    {segment.label !== null && (
                      <span className="text-sm text-text-secondary">{segment.label}:</span>
                    )}
                    {segment.latex !== null ? (
                      <MathFormula formula={segment.latex} />
                    ) : (
                      <span>{segment.text}</span>
                    )}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xl text-text-primary">{result}</p>
            )}
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

      {success && explorations.length > 0 && (
        <FadeIn>
          <div className="rounded-lg border border-border bg-surface px-3.5 py-3">
            <div className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-1 w-1 rounded-full bg-accent" />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                Explorar
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1">
              {explorations.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  aria-label={link.label}
                  className="group/link inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium tracking-[-0.01em] text-text-secondary transition-colors duration-(--motion-base) ease-out hover:bg-accent/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span
                    aria-hidden="true"
                    className="text-[13px] leading-none opacity-75 transition-opacity duration-(--motion-base) group-hover/link:opacity-100"
                  >
                    {link.icon}
                  </span>
                  <span>{link.label}</span>
                </Link>
              ))}
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
