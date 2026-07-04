"use client";

import { FormEvent, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface HistoryItem {
  expression: string;
  result: string;
  timestamp: string;
}

export default function Home() {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  async function fetchHistory() {
    try {
      const response = await fetch(`${API_URL}/history`);
      if (!response.ok) return;
      const data = await response.json();
      setHistory(data);
    } catch {
      // histórico é secundário: falha silenciosa não deve quebrar a tela principal
    }
  }

  useEffect(() => {
    fetchHistory();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expression }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(typeof data.detail === "string" ? data.detail : "Não foi possível resolver a expressão.");
        return;
      }

      setResult(data.result);
      await fetchHistory();
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-3xl font-semibold">MathMaster</h1>

      <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-3">
        <input
          type="text"
          value={expression}
          onChange={(event) => setExpression(event.target.value)}
          placeholder="Digite uma expressão, ex.: x**2 - 4"
          className="rounded-md border border-zinc-300 px-4 py-2 text-base outline-none focus:border-zinc-500"
        />

        <button
          type="submit"
          disabled={loading || expression.trim().length === 0}
          className="rounded-md bg-zinc-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Resolvendo..." : "Resolver"}
        </button>
      </form>

      <section className="w-full max-w-md">
        {result !== null && (
          <p className="rounded-md border border-zinc-200 p-4 text-lg">
            <span className="text-sm text-zinc-500">Resultado:</span>
            <br />
            {result}
          </p>
        )}

        {error !== null && (
          <p className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}
      </section>

      <section className="w-full max-w-md">
        <h2 className="mb-2 text-sm font-medium text-zinc-500">Histórico</h2>
        {history.length === 0 ? (
          <p className="text-sm text-zinc-400">Nenhuma expressão resolvida ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((item) => (
              <li key={`${item.timestamp}-${item.expression}`} className="rounded-md border border-zinc-200 p-3 text-sm">
                <div>{item.expression} = {item.result}</div>
                <span className="text-xs text-zinc-400">
                  {new Date(item.timestamp).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
