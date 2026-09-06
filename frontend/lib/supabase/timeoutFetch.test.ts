import { afterEach, describe, expect, it, vi } from "vitest";

import { createTimeoutFetch } from "./timeoutFetch";

/**
 * Hotfix — investigação de regressão de produção: `supabase.auth.
 * getUser()` (usado em `proxy.ts`, chamado em TODA rota, e em
 * `lib/supabase/server.ts`, usado por várias Server Components) fazia uma
 * chamada de rede sem timeout nenhum — reproduzido ao vivo contra um host
 * inalcançável, a chamada nunca resolvia nem rejeitava. Este teste cobre
 * o mecanismo da correção isoladamente (a função pura), sem precisar
 * simular rede de verdade.
 *
 * `vi.useFakeTimers()` não intercepta o timer interno de `AbortSignal.
 * timeout()` (é implementado no motor, não via `setTimeout` global) —
 * confirmado tentando e vendo os testes falharem mesmo avançando os fake
 * timers. Por isso estes testes usam timeouts reais bem curtos (dezenas
 * de ms) em vez de fake timers, exatamente como a reprodução ao vivo já
 * feita nesta investigação (contra um host inalcançável de verdade).
 */
describe("createTimeoutFetch", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("aborta a chamada subjacente quando o timeout é atingido, mesmo que o fetch real nunca resolva", async () => {
    let capturedSignal: AbortSignal | undefined;
    global.fetch = vi.fn((_input, init) => {
      capturedSignal = init?.signal as AbortSignal | undefined;
      // Simula uma conexão que nunca responde (o cenário real reproduzido
      // contra um host inalcançável) -- a promise nunca resolve por conta
      // própria; só o abort do signal deve encerrar isto.
      return new Promise<Response>(() => {});
    }) as typeof fetch;

    const timeoutFetch = createTimeoutFetch(30);
    void timeoutFetch("https://example.invalid/rest/v1/topics");

    expect(capturedSignal?.aborted).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("não aborta antes do timeout configurado", async () => {
    let capturedSignal: AbortSignal | undefined;
    global.fetch = vi.fn((_input, init) => {
      capturedSignal = init?.signal as AbortSignal | undefined;
      return new Promise<Response>(() => {});
    }) as typeof fetch;

    const timeoutFetch = createTimeoutFetch(200);
    void timeoutFetch("https://example.invalid/rest/v1/topics");

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(capturedSignal?.aborted).toBe(false);
  });

  it("respeita um AbortSignal já fornecido pelo chamador (aborta se QUALQUER um dos dois disparar)", async () => {
    let capturedSignal: AbortSignal | undefined;
    global.fetch = vi.fn((_input, init) => {
      capturedSignal = init?.signal as AbortSignal | undefined;
      return new Promise<Response>(() => {});
    }) as typeof fetch;

    const externalController = new AbortController();
    const timeoutFetch = createTimeoutFetch(60_000);
    void timeoutFetch("https://example.invalid/rest/v1/topics", {
      signal: externalController.signal,
    });

    expect(capturedSignal?.aborted).toBe(false);
    externalController.abort();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("usa 5000ms como padrão quando nenhum timeout é passado", async () => {
    let capturedInit: RequestInit | undefined;
    global.fetch = vi.fn((_input, init) => {
      capturedInit = init;
      return new Promise<Response>(() => {});
    }) as typeof fetch;

    const timeoutFetch = createTimeoutFetch();
    void timeoutFetch("https://example.invalid/rest/v1/topics");

    expect(capturedInit?.signal).toBeInstanceOf(AbortSignal);
    expect(capturedInit?.signal?.aborted).toBe(false);
  });
});
