"use client";

import { useEffect } from "react";

const RELOAD_GUARD_KEY = "mathmaster:chunk-error-reload";

function isChunkLoadError(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") return false;
  const name = (reason as { name?: unknown }).name;
  const message = (reason as { message?: unknown }).message;
  if (name === "ChunkLoadError") return true;
  return (
    typeof message === "string" &&
    /Loading chunk [\w.-]+ failed|Failed to load chunk/i.test(message)
  );
}

/**
 * Hotfix — investigação de regressão de produção.
 *
 * Reproduzido localmente (build seguido de restart do servidor, deixando
 * uma aba já aberta): navegar client-side para uma rota cujo chunk JS não
 * existe mais no servidor atual (ex. logo depois de um novo deploy, com
 * hashes de arquivo diferentes, enquanto a aba do usuário ainda carregou
 * o build anterior) falha SILENCIOSAMENTE no roteador do Next.js — a URL
 * muda (o `pushState` já aconteceu), mas o conteúdo renderizado fica
 * preso na página anterior, sem passar por `app/error.tsx` (é uma
 * Promise rejeitada sem tratamento, não uma exceção síncrona de render,
 * então nenhum error boundary a captura). Sem recarregar a página, o
 * usuário fica "preso" ali até fazer F5 manualmente.
 *
 * Isto NÃO é causado por nenhuma mudança recente de código — é um
 * comportamento conhecido do Next.js/Vercel que pode acontecer em
 * qualquer navegação client-side logo após QUALQUER deploy (não
 * específico de nenhum commit), enquanto uma aba antiga ainda está
 * aberta. A mitigação padrão do ecossistema é detectar o
 * `ChunkLoadError` e forçar um reload completo (que busca o HTML/
 * manifesto atual do zero) — nunca mais que uma vez por navegação, para
 * não entrar em loop caso o problema seja outro.
 */
export function ChunkErrorRecovery() {
  useEffect(() => {
    // Uma carga bem-sucedida deste componente confirma que a página
    // atual está saudável — libera a guarda para uma futura tentativa.
    try {
      sessionStorage.removeItem(RELOAD_GUARD_KEY);
    } catch {
      // sessionStorage indisponível (modo privado restrito) — segue sem
      // a guarda; pior caso é um reload extra, nunca um crash.
    }

    function recover(reason: unknown) {
      if (!isChunkLoadError(reason)) return;
      try {
        if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return;
        sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
      } catch {
        // Sem sessionStorage não há como prevenir um loop -- mais seguro
        // não recarregar automaticamente do que arriscar um loop.
        return;
      }
      window.location.reload();
    }

    function handleRejection(event: PromiseRejectionEvent) {
      recover(event.reason);
    }
    function handleError(event: ErrorEvent) {
      recover(event.error);
    }

    window.addEventListener("unhandledrejection", handleRejection);
    window.addEventListener("error", handleError);
    return () => {
      window.removeEventListener("unhandledrejection", handleRejection);
      window.removeEventListener("error", handleError);
    };
  }, []);

  return null;
}
