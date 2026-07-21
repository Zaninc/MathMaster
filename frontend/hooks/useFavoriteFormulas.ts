import { useCallback, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "mathmaster.formulas.favorites";
/** Evento local (mesma aba) — o evento nativo `storage` só dispara em OUTRAS abas/janelas. */
const LOCAL_EVENT = "mathmaster:favorites-changed";

function parseFavorites(raw: string): Set<string> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((id): id is string => typeof id === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function readRaw(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function getServerSnapshot(): string {
  return "[]";
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(LOCAL_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LOCAL_EVENT, callback);
  };
}

/**
 * `localStorage` é uma store externa, então `useSyncExternalStore` lê direto
 * dela (sem setState dentro de efeito, sem risco de mismatch de hidratação:
 * `getServerSnapshot` devolve "[]" tanto no server quanto na 1ª pintura do
 * client durante hidratação; o valor real do localStorage entra logo em
 * seguida). `toggleFavorite` escreve no localStorage e dispara `LOCAL_EVENT`
 * para notificar a própria aba — o evento `storage` nativo não notifica
 * quem fez a mudança.
 */
export function useFavoriteFormulas() {
  const raw = useSyncExternalStore(subscribe, readRaw, getServerSnapshot);
  const favorites = useMemo(() => parseFavorites(raw), [raw]);

  const toggleFavorite = useCallback((id: string) => {
    const next = parseFavorites(readRaw());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // localStorage indisponível (ex. modo privado) — não é crítico, falha silenciosa
    }
    window.dispatchEvent(new Event(LOCAL_EVENT));
  }, []);

  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites]);

  return { favorites, isFavorite, toggleFavorite };
}
