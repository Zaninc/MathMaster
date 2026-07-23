"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useId, useRef, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { MathInput } from "@/components/math-input/MathInput";
import { MathKeyboard } from "@/components/math-input/MathKeyboard";
import { MathPreview } from "@/components/math-input/MathPreview";
import { Button } from "@/components/shared/Button";
import { ExampleButton } from "@/components/shared/ExampleButton";
import { QUICK_EXAMPLES } from "@/data/examples";
import type { KeyboardKey } from "@/data/keyboard";
import { apiClient } from "@/lib/api/client";
import type { HistoryItem } from "@/lib/api/types";
import { ApiError, friendlyMessage } from "@/lib/api/errors";
import { insertAtCursor } from "@/lib/math/insert-at-cursor";

import { HistoryPanel } from "./HistoryPanel";
import { ResultPanel, type ResultStatus } from "./ResultPanel";

/**
 * Ordem visual controlada por `order-*`/`lg:order-*` (um único
 * `ResultPanel`, reposicionado por CSS) em vez de renderizar o painel
 * duas vezes: no mobile "resultado logo abaixo do editor" (exigência
 * explícita do briefing), no desktop depois do teclado/exemplos, antes do
 * histórico lateral.
 */
export function CalculatorWorkspace() {
  const searchParams = useSearchParams();
  const [expression, setExpression] = useState(() => searchParams.get("expression") ?? "");
  const [status, setStatus] = useState<ResultStatus>("idle");
  const [solvedExpression, setSolvedExpression] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [approx, setApprox] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [hiddenTimestamps, setHiddenTimestamps] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);
  const pendingSelectionRef = useRef<number | null>(null);
  const inputId = useId();
  const errorId = useId();

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getHistory()
      .then((items) => {
        if (!cancelled) setHistory(items);
      })
      .catch(() => {
        // histórico é secundário: falha silenciosa não deve quebrar a tela principal
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (pendingSelectionRef.current === null) return;
    const position = pendingSelectionRef.current;
    pendingSelectionRef.current = null;
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(position, position);
  }, [expression]);

  async function refreshHistory() {
    try {
      setHistory(await apiClient.getHistory());
    } catch {
      // histórico é secundário
    }
  }

  async function solve(value: string) {
    if (value.trim().length === 0) return;
    setStatus("loading");
    setResult(null);
    setApprox(null);
    setErrorMessage(null);
    setSolvedExpression(value);
    try {
      const response = await apiClient.solve(value);
      setResult(response.result);
      setApprox(response.approx);
      setStatus("success");
      await refreshHistory();
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

  function handleInsert(key: KeyboardKey) {
    const node = inputRef.current;
    const selectionStart = node?.selectionStart ?? expression.length;
    const selectionEnd = node?.selectionEnd ?? expression.length;
    // Teclas com variante de seleção (ex. xⁿ) PRESERVAM o texto
    // selecionado, envolvendo-o ("x" -> "(x)ⁿ") em vez de substituí-lo;
    // demais teclas substituem a seleção, como qualquer input de texto.
    const selected = expression.slice(selectionStart, selectionEnd);
    const useSelectionVariant = key.selection !== undefined && selected.length > 0;
    const insertText = useSelectionVariant
      ? key.selection!.before + selected + key.selection!.after
      : key.insert;
    const cursorOffset = useSelectionVariant
      ? insertText.length - key.selection!.cursorFromEnd
      : key.cursorOffset;
    const { value, cursorPosition } = insertAtCursor(
      expression,
      selectionStart,
      selectionEnd,
      insertText,
      cursorOffset
    );
    pendingSelectionRef.current = cursorPosition;
    setExpression(value);
  }

  function fillExpression(value: string) {
    setExpression(value);
    setStatus("idle");
    setResult(null);
    setApprox(null);
    setErrorMessage(null);
    inputRef.current?.focus();
  }

  function handleClear() {
    fillExpression("");
  }

  function handleHideHistoryItem(timestamp: string) {
    setHiddenTimestamps((previous) => new Set(previous).add(timestamp));
  }

  return (
    <PageShell variant="full-workspace">
      {/* `min-w-0` nas duas colunas: itens de grid têm `min-width: auto`
          (piso = min-content do conteúdo). No mobile (coluna implícita
          `auto`), a fileira de abas do teclado (~672px de min-content)
          estourava a página inteira; o desktop já se protegia via
          `minmax(0,1fr)` no track explícito. Com o piso zerado, a fileira
          rola no próprio `overflow-x-auto` dela, como sempre foi a intenção. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:gap-8">
        <div className="min-w-0 flex flex-col gap-4">
          <form onSubmit={handleSubmit} className="order-1 flex flex-col gap-2">
            <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">
              Expressão matemática
            </label>
            <MathInput
              ref={inputRef}
              id={inputId}
              value={expression}
              onChange={setExpression}
              placeholder="Digite ou monte com o teclado abaixo, ex.: x² - 4 = 0"
              ariaDescribedBy={status === "error" ? errorId : undefined}
              ariaInvalid={status === "error"}
            />
            <MathPreview value={expression} />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={status === "loading" || expression.trim().length === 0}>
                {status === "loading" ? "Resolvendo..." : "Resolver"}
              </Button>
              <Button type="button" variant="ghost" onClick={handleClear} disabled={expression.length === 0}>
                Limpar
              </Button>
            </div>
          </form>

          <div className="order-2 lg:order-4">
            <ResultPanel
              status={status}
              expression={solvedExpression}
              result={result}
              approx={approx}
              errorMessage={errorMessage}
              errorId={errorId}
              onRetry={handleClear}
            />
          </div>

          <div className="order-3 lg:order-2">
            <MathKeyboard onInsert={handleInsert} />
          </div>

          <div className="order-4 lg:order-3">
            <p className="mb-2 text-sm font-medium text-text-secondary">Exemplos</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_EXAMPLES.map((example) => (
                <ExampleButton key={example.expression} example={example} onSelect={fillExpression} />
              ))}
            </div>
          </div>
        </div>

        <aside className="min-w-0 lg:border-l lg:border-border lg:pl-8">
          <HistoryPanel
            items={history}
            hiddenTimestamps={hiddenTimestamps}
            onSelect={fillExpression}
            onHide={handleHideHistoryItem}
          />
        </aside>
      </div>
    </PageShell>
  );
}
