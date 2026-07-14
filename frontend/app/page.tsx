"use client";

import { FormEvent, useEffect, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { apiClient } from "@/lib/api/client";
import { ApiError, friendlyMessage } from "@/lib/api/errors";
import type { HistoryItem } from "@/lib/api/types";

/**
 * Home provisória (Etapa 0 — Fundação): mesma lógica funcional já existente
 * desde o Sprint 2, agora migrada para `apiClient`/`ApiError` e envolvida no
 * novo shell de layout. O redesenho visual completo (hero, calculadora
 * rápida, pilares, previews) é escopo da Etapa 1.
 */
export default function Home() {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  async function fetchHistory() {
    try {
      setHistory(await apiClient.getHistory());
    } catch {
      // histórico é secundário: falha silenciosa não deve quebrar a tela principal
    }
  }

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await apiClient.solve(expression);
      setResult(response.result);
      await fetchHistory();
    } catch (cause) {
      const apiError = cause instanceof ApiError ? cause : new ApiError("network_error");
      setError(friendlyMessage(apiError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell className="flex flex-col items-center gap-8 py-16">
      <h1 className="text-3xl font-semibold text-text-primary">MathMaster</h1>

      <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-3">
        <input
          type="text"
          value={expression}
          onChange={(event) => setExpression(event.target.value)}
          placeholder="Digite uma expressão, ex.: x**2 - 4"
          className="rounded-md border border-border bg-surface px-4 py-2 text-base text-text-primary outline-none focus:border-accent"
        />

        <button
          type="submit"
          disabled={loading || expression.trim().length === 0}
          className="rounded-md bg-accent px-4 py-2 text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? "Resolvendo..." : "Resolver"}
        </button>
      </form>

      <section className="w-full max-w-md">
        {result !== null && (
          <p className="rounded-md border border-border bg-surface p-4 text-lg text-text-primary">
            <span className="text-sm text-text-secondary">Resultado:</span>
            <br />
            {result}
          </p>
        )}

        {error !== null && (
          <p className="rounded-md border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
            {error}
          </p>
        )}
      </section>

      <section className="w-full max-w-md">
        <h2 className="mb-2 text-sm font-medium text-text-secondary">Histórico</h2>
        {history.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhuma expressão resolvida ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((item) => (
              <li
                key={`${item.timestamp}-${item.expression}`}
                className="rounded-md border border-border bg-surface p-3 text-sm text-text-primary"
              >
                <div>{item.expression} = {item.result}</div>
                <span className="text-xs text-text-muted">
                  {new Date(item.timestamp).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
