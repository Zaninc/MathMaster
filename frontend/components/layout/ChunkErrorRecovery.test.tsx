import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChunkErrorRecovery } from "./ChunkErrorRecovery";

const RELOAD_GUARD_KEY = "mathmaster:chunk-error-reload";

/**
 * Hotfix — investigação de regressão de produção: reproduzido localmente
 * (build seguido de restart do servidor com uma aba já aberta) que uma
 * navegação client-side para uma rota cujo chunk JS não existe mais no
 * build atual falha SILENCIOSAMENTE no roteador do Next.js — a URL muda,
 * mas o conteúdo renderizado fica preso na página anterior, sem passar
 * por `app/error.tsx` (é uma Promise rejeitada sem tratamento, nunca uma
 * exceção síncrona de render). Este componente detecta o `ChunkLoadError`
 * e força um reload completo; estes testes cobrem exatamente esse
 * mecanismo, sem precisar de um build real.
 */
describe("ChunkErrorRecovery", () => {
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function dispatchRejection(reason: unknown) {
    const event = new Event("unhandledrejection") as PromiseRejectionEvent & {
      reason?: unknown;
    };
    Object.defineProperty(event, "reason", { value: reason });
    window.dispatchEvent(event);
  }

  it("recarrega a página quando um ChunkLoadError (por name) aparece como rejeição não tratada", () => {
    render(<ChunkErrorRecovery />);

    dispatchRejection({ name: "ChunkLoadError", message: "Failed to load chunk 123 from module 456" });

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("recarrega quando a mensagem bate com o padrão conhecido, mesmo sem o name exato", () => {
    render(<ChunkErrorRecovery />);

    dispatchRejection(new Error("Loading chunk 42 failed."));

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("NUNCA recarrega para um erro comum não relacionado a chunk", () => {
    render(<ChunkErrorRecovery />);

    dispatchRejection(new TypeError("Failed to fetch"));

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("nunca recarrega mais de uma vez por navegação (guarda contra loop)", () => {
    render(<ChunkErrorRecovery />);

    dispatchRejection({ name: "ChunkLoadError" });
    dispatchRejection({ name: "ChunkLoadError" });
    dispatchRejection({ name: "ChunkLoadError" });

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("limpa a guarda de reload assim que a página carrega com sucesso (permite uma futura tentativa)", () => {
    sessionStorage.setItem(RELOAD_GUARD_KEY, "1");

    render(<ChunkErrorRecovery />);

    expect(sessionStorage.getItem(RELOAD_GUARD_KEY)).toBeNull();
  });

  it("ignora uma rejeição sem reason utilizável, sem lançar", () => {
    render(<ChunkErrorRecovery />);

    expect(() => dispatchRejection(null)).not.toThrow();
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
