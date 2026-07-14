import "@testing-library/jest-dom/vitest";

/**
 * jsdom não implementa `ResizeObserver`/`IntersectionObserver` — stubs
 * globais no-op (não disparam callbacks) para que componentes que os usam
 * (`useElementSize`, `useInView`) não quebrem em testes que não estão
 * exercitando resize/scroll especificamente. Testes que precisam do
 * comportamento real (ex. `hooks/useElementSize.test.tsx`) substituem por
 * um mock próprio via `vi.stubGlobal`, que tem prioridade sobre isto.
 */
class StubObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = StubObserver as unknown as typeof ResizeObserver;
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = StubObserver as unknown as typeof IntersectionObserver;
}
