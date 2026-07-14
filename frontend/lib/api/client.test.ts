import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/env", () => ({
  env: { apiUrl: "https://api.test" },
}));

import { apiClient } from "./client";
import { ApiError } from "./errors";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("solve() faz POST /solve com o corpo correto e devolve a resposta tipada", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ expression: "2+2", result: "4" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiClient.solve("2+2");

    expect(result).toEqual({ expression: "2+2", result: "4" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/solve");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ expression: "2+2" });
  });

  it("getHistory() faz GET /history e devolve a lista", async () => {
    const items = [{ expression: "2+2", result: "4", timestamp: "2026-01-01T00:00:00Z" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(items)));

    await expect(apiClient.getHistory()).resolves.toEqual(items);
  });

  it("lança ApiError classificado quando a resposta não é ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ detail: "Muitas requisições. Tente novamente em instantes." }, 429))
    );

    await expect(apiClient.solve("2+2")).rejects.toMatchObject({
      kind: "rate_limited",
    } satisfies Partial<ApiError>);
  });

  it("lança network_error quando o fetch falha (sem abort)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));

    await expect(apiClient.solve("2+2")).rejects.toMatchObject({ kind: "network_error" });
  });

  it("lança network_timeout quando a requisição excede o prazo de rede", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              const abortError = new Error("aborted");
              abortError.name = "AbortError";
              reject(abortError);
            });
          })
      )
    );

    const pending = apiClient.solve("2+2");
    const assertion = expect(pending).rejects.toMatchObject({ kind: "network_timeout" });
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });
});
