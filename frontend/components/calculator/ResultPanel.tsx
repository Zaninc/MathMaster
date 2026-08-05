"use client";

import { useState } from "react";

import { Button } from "@/components/shared/Button";
import { ContextActions } from "@/components/shared/ContextActions";
import { FadeIn } from "@/components/shared/FadeIn";
import { ProgressiveMathResult } from "@/components/shared/ProgressiveMathResult";
import { MathSteps } from "@/components/steps/MathSteps";
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

type DisplayMode = "exact" | "approx";

/**
 * Progressive enhancement (Sprint KaTeX Fase 2): o texto puro do backend é
 * SEMPRE renderizado primeiro (mesma UI de antes); quando a conversão
 * assíncrona via `useSolveLatex` (chunk do mathjs, dynamic import) resolve
 * com sucesso, a exibição é promovida a KaTeX. Conversão nula ou pendente
 * = exatamente a calculadora anterior — nenhum caminho novo de falha.
 *
 * Sprint "alternância exato/aproximado" (pós-V2.1): a expressão do topo
 * (o que o usuário digitou) NUNCA alterna — é sempre o eco fiel do input,
 * em modo controlado "exact" fixo (`ProgressiveMathResult` com
 * `approx={null}`). Só o RESULTADO alterna, e só quando o backend manda
 * uma aproximação (`approx`) associada a ele (`resultApprox`): um único
 * botão "Resultado aproximado"/"Resultado exato" troca o modo, e o modo é
 * dono aqui (não mais dentro de `ProgressiveMathResult`, que já não decide
 * sozinho trocar para a aproximação por overflow) — precisa ser dono neste
 * nível porque o botão "Copiar" também depende dele, para copiar sempre o
 * que está visível no momento. Resultados longos continuam começando no
 * modo exato compacto (o scroll horizontal do `MathFormula` já evita
 * vazamento do card, ver `scrollable`); alternar nunca copia sozinho.
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
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<DisplayMode>("exact");
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
  // Nunca em modo aproximado quando não há aproximação para este resultado
  // (ex. resultado rotulado) — evita herdar uma escolha "approx" de um
  // resultado anterior que a tinha, entre o reset abaixo rodar e o próximo
  // resultado chegar.
  const displayMode: DisplayMode = resultApprox !== null ? mode : "exact";

  // Reseta o modo de exibição e o "Copiado!" quando um resultado NOVO
  // chega — ajuste direto no corpo do render (nunca `setState` num efeito,
  // mesmo padrão já usado em `ProgressiveMathResult`/`RouteTransition`).
  const resultKey = `${expression}\n${result ?? ""}`;
  const [previousResultKey, setPreviousResultKey] = useState(resultKey);
  if (resultKey !== previousResultKey) {
    setPreviousResultKey(resultKey);
    setMode("exact");
    setCopied(false);
  }

  async function handleCopy() {
    const text = displayMode === "approx" ? (resultApprox ?? "") : (result ?? "");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível (ex. contexto não seguro) — não é crítico, falha silenciosa
    }
  }

  function handleToggleMode() {
    setMode((current) => (current === "approx" ? "exact" : "approx"));
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
              <ProgressiveMathResult latex={expressionLatex} text={expression} approx={null} mode="exact" />
            </p>
            <span className="mt-3 block text-xs font-medium uppercase tracking-wide text-text-secondary">
              Resultado
            </span>
            {segments !== null ? (
              <div className="mt-1 flex min-w-0 flex-col gap-1 text-lg text-text-primary">
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
                      mode={displayMode}
                    />
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xl text-text-primary">{result}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={handleCopy}>
                {copied ? "Copiado!" : "Copiar"}
              </Button>
              {resultApprox !== null && (
                <Button type="button" variant="secondary" onClick={handleToggleMode}>
                  {displayMode === "approx" ? "Resultado exato" : "Resultado aproximado"}
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={onRetry}>
                Tentar outro
              </Button>
            </div>
            <div className="mt-4">
              <MathSteps expression={expression} />
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
