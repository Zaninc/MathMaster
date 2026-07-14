import { env } from "@/lib/config/env";
import { ApiError, classifyResponseError } from "./errors";
import type { HistoryItem, SolveResponse } from "./types";

/**
 * Margem sobre os `compute_timeout_seconds` (5s) do backend + latência de
 * rede — se isso estourar, é a REDE que desistiu de esperar, não o
 * backend reportando seu próprio timeout (ver `errors.ts`).
 */
const NETWORK_TIMEOUT_MS = 15_000;

async function parseDetail(response: Response): Promise<string | undefined> {
  try {
    const body = await response.json();
    return typeof body?.detail === "string" ? body.detail : undefined;
  } catch {
    return undefined;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError("network_timeout");
    }
    throw new ApiError("network_error", undefined, undefined);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const detail = await parseDetail(response);
    throw classifyResponseError(response.status, detail);
  }

  return (await response.json()) as T;
}

export const apiClient = {
  solve(expression: string): Promise<SolveResponse> {
    return request<SolveResponse>("/solve", {
      method: "POST",
      body: JSON.stringify({ expression }),
    });
  },
  getHistory(): Promise<HistoryItem[]> {
    return request<HistoryItem[]>("/history");
  },
  health(): Promise<{ status: string }> {
    return request<{ status: string }>("/health");
  },
};
