"use client";

import { useState } from "react";

import { Button } from "@/components/shared/Button";
import { ContextActions } from "@/components/shared/ContextActions";
import { FadeIn } from "@/components/shared/FadeIn";
import { ProgressiveMathResult } from "@/components/shared/ProgressiveMathResult";
import { getCalculatorExplorations } from "@/data/connections";
import { useSolveLatex } from "@/hooks/useSolveLatex";

import { ResultSkeleton } from "./ResultSkeleton";

export type ResultStatus = "idle" | "loading" | "success" | "error";

interface ResultPanelProps {
  status: ResultStatus;
  expression: string;
  result: string | null;
  /** Sprint V2.1 (apresentação progressiva) — aproximação numérica do backend, ou `null`. */
  approx: string | null;
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
 *
 * Sprint V2.1: quando o backend manda uma aproximação (`approx`) E o
 * resultado exato REALMENTE ultrapassa o espaço do card (`ProgressiveMathResult`),
 * a aproximação vira o valor principal com um botão "Ver resultado exato".
 * "Copiar" mostra duas opções nesse caso — aproximado e exato — em vez de
 * uma só; continua copiando texto cru do backend, nunca LaTeX.
 */
export function ResultPanel({
  status,
  expression,
  result,
  approx,
  errorMessage,
  errorId,
  onRetry,
}: ResultPanelProps) {
  const [copiedTarget, setCopiedTarget] = useState<"exact" | "approx" | null>(null);
  const success = status === "success" && result !== null;
  const { expressionLatex, segments } = useSolveLatex(
    success ? expression : null,
    success ? result : null
  );
  const explorations = success ? getCalculatorExplorations(expression) : [];
  // `approx` só corresponde a um resultado SEM rótulo (somatório é sempre
  // um segmento único, "label: null") — nunca associado a um segmento
  // específico de um resultado rotulado tipo "Centro: ...; Raio: ...".
  const resultApprox = segments !== null && segments.length === 1 ? approx : null;

  async function handleCopy(text: string, target: "exact" | "approx") {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget(null), 2000);
    } catch {
      // clipboard indisponível (ex. contexto não seguro) — não é crítico, falha silenciosa
    }
  }

  if (status === "idle") {
    return null;
  }

  return (
    <div aria-live="polite" className="min-w-0 flex flex-col gap-3">
      {status === "loading" && <ResultSkeleton />}

      {success && (
        <FadeIn>
          <div className="min-w-0 w-full rounded-lg border border-success/40 bg-success/10 p-4">
            <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">Resolvido</span>
            <p className="mt-1 min-w-0 text-sm text-text-muted">
              <ProgressiveMathResult latex={expressionLatex} text={expression} approx={null} />
            </p>
            {segments !== null ? (
              <div className="mt-2 flex min-w-0 flex-col gap-1 text-lg text-text-primary">
                {segments.map((segment) => (
                  <p
                    key={`${segment.label ?? ""}:${segment.text}`}
                    className="flex min-w-0 flex-wrap items-baseline gap-x-2 [overflow-wrap:anywhere]"
                  >
                    {segment.label !== null && (
                      <span className="text-sm text-text-secondary">{segment.label}:</span>
                    )}
                    <ProgressiveMathResult
                      latex={segment.latex}
                      text={segment.text}
                      approx={segments.length === 1 ? resultApprox : null}
                    />
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xl text-text-primary">{result}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {resultApprox !== null ? (
                <>
                  <Button type="button" variant="secondary" onClick={() => handleCopy(resultApprox, "approx")}>
                    {copiedTarget === "approx" ? "Copiado!" : "Copiar aproximado"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleCopy(result ?? "", "exact")}
                  >
                    {copiedTarget === "exact" ? "Copiado!" : "Copiar exato"}
                  </Button>
                </>
              ) : (
                <Button type="button" variant="secondary" onClick={() => handleCopy(result ?? "", "exact")}>
                  {copiedTarget === "exact" ? "Copiado!" : "Copiar"}
                </Button>
              )}
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
            <ContextActions eyebrow="Explorar" links={explorations} />
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
