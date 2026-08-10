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

/**
 * jsdom também não implementa `window.matchMedia` — stub global que
 * responde `matches: false` (comportamento "sem preferência", o caso
 * comum) para qualquer query. Testes que precisam simular
 * `prefers-reduced-motion: reduce` (ou outra query) substituem por um
 * mock próprio via `vi.stubGlobal("matchMedia", ...)`, que tem
 * prioridade sobre isto.
 */
if (typeof window !== "undefined" && typeof window.matchMedia === "undefined") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
