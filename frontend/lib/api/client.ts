import { env } from "@/lib/config/env";
import { normalizeForBackend } from "@/lib/math/backend-normalize";
import { ApiError, classifyResponseError } from "./errors";
import type { HistoryItem, SolveResponse, StepsResponse } from "./types";

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
    // Fronteira única de envio: os templates visuais do teclado (eˣ(, ⁿ)
    // são traduzidos para a sintaxe canônica AQUI, e só aqui — o valor
    // visível no input e o preview nunca são alterados.
    return request<SolveResponse>("/solve", {
      method: "POST",
      body: JSON.stringify({ expression: normalizeForBackend(expression) }),
    });
  },
  getHistory(): Promise<HistoryItem[]> {
    return request<HistoryItem[]>("/history");
  },
  /**
   * Sprint V2.9 (Passo a Passo) — rota nova e opcional, `/solve/steps`;
   * `/solve` continua 100% intocado. Mesma fronteira de normalização de
   * `solve()` acima (templates visuais do teclado traduzidos aqui, nunca
   * no valor exibido no input).
   */
  solveSteps(expression: string): Promise<StepsResponse> {
    return request<StepsResponse>("/solve/steps", {
      method: "POST",
      body: JSON.stringify({ expression: normalizeForBackend(expression) }),
    });
  },
  health(): Promise<{ status: string }> {
    return request<{ status: string }>("/health");
  },
};
