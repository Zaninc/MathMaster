"use client";

import { FormEvent, useId, useState } from "react";

import { Button } from "@/components/shared/Button";
import { ExampleButton } from "@/components/shared/ExampleButton";
import { ProgressiveMathResult } from "@/components/shared/ProgressiveMathResult";
import { QUICK_EXAMPLES, QUICK_SHORTCUTS } from "@/data/examples";
import { useSolveLatex } from "@/hooks/useSolveLatex";
import { apiClient } from "@/lib/api/client";
import { ApiError, friendlyMessage } from "@/lib/api/errors";

type Status = "idle" | "loading" | "success" | "error";

/**
 * Versão leve da entrada matemática: input de texto real (aceita Unicode,
 * colar, teclado normal) + chamada real ao backend. O editor completo
 * (teclado matemático por categorias, templates de fração/potência/raiz)
 * é escopo da Etapa 2 (Calculadora) — aqui a prioridade é "rápido e
 * funcional", não a experiência de construção completa.
 *
 * Correção de consistência visual (pós-Sprint V2.3): o card de resultado
 * usava `{result}` cru — a MESMA infraestrutura de KaTeX da Calculadora
 * principal (`ResultPanel.tsx`) é reaproveitada aqui: `useSolveLatex`
 * (que por sua vez é só uma casca fina sobre `lib/math/to-latex.ts` —
 * `resultToLatex`/`previewLatex`, nunca reimplementados), com
 * `ProgressiveMathResult`/`MathFormula` para o rendering em si. Nenhum
 * conversor próprio; `segments === null` (a forma não foi reconhecida)
 * cai no MESMO fallback de texto puro que já existia, nunca lança.
 */
export function QuickCalculator() {
  const [expression, setExpression] = useState("");
  const [solvedExpression, setSolvedExpression] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

  const success = status === "success" && result !== null;
  const { segments } = useSolveLatex(success ? solvedExpression : null, success ? result : null);

  async function solve(value: string) {
    if (value.trim().length === 0) return;
    setStatus("loading");
    setResult(null);
    setErrorMessage(null);
    setSolvedExpression(value);
    try {
      const response = await apiClient.solve(value);
      setResult(response.result);
      setStatus("success");
    } catch (cause) {
      const apiError = cause instanceof ApiError ? cause : new ApiError("network_error");
      setErrorMessage(friendlyMessage(apiError));
      setStatus("error");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    solve(expression);
  }

  function fillExample(value: string) {
    setExpression(value);
    setResult(null);
    setErrorMessage(null);
    setStatus("idle");
  }

  return (
    <section className="border-b border-border py-16">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-center text-xl font-semibold text-text-primary">
          O que você quer resolver hoje?
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label htmlFor={inputId} className="sr-only">
            Expressão matemática
          </label>
          <input
            id={inputId}
            type="text"
            value={expression}
            onChange={(event) => setExpression(event.target.value)}
            placeholder="Digite uma expressão, ex.: x² - 4 = 0"
            aria-describedby={status === "error" ? errorId : undefined}
            aria-invalid={status === "error"}
            className="rounded-lg border border-border bg-surface px-4 py-3 text-base text-text-primary outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
          />
          <Button type="submit" disabled={status === "loading" || expression.trim().length === 0}>
            {status === "loading" ? "Resolvendo..." : "Resolver"}
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_SHORTCUTS.map((shortcut) => (
            <button
              key={shortcut.label}
              type="button"
              onClick={() => fillExample(shortcut.insertText)}
              aria-label={`Preencher exemplo de ${shortcut.label}`}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
            >
              {shortcut.label}
            </button>
          ))}
        </div>

        <div aria-live="polite" className="mt-6">
          {status === "success" && result !== null && (
            <div className="min-w-0 w-full rounded-lg border border-success/40 bg-success/10 p-4 text-lg text-text-primary">
              <span className="mb-1 block text-sm text-text-secondary">Resultado</span>
              {segments !== null ? (
                <div className="mt-1 flex min-w-0 flex-col gap-1">
                  {segments.map((segment) => (
                    <p
                      key={`${segment.label ?? ""}:${segment.text}`}
                      className="flex min-w-0 flex-wrap items-baseline gap-x-2 [overflow-wrap:anywhere]"
                    >
                      {segment.label !== null && (
                        <span className="text-sm text-text-secondary">{segment.label}:</span>
                      )}
                      <ProgressiveMathResult latex={segment.latex} text={segment.text} approx={null} />
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-1 [overflow-wrap:anywhere]">{result}</p>
              )}
            </div>
          )}
          {status === "error" && errorMessage !== null && (
            <p id={errorId} className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="mt-8">
          <p className="mb-2 text-sm font-medium text-text-secondary">Exemplos</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_EXAMPLES.map((example) => (
              <ExampleButton key={example.expression} example={example} onSelect={fillExample} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
