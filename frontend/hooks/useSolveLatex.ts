import { useEffect, useState } from "react";

import { inputToLatex, resultToLatex, type ResultSegment } from "@/lib/math/to-latex";

export interface SolveLatex {
  /** LaTeX do echo da expressão, ou null (exibir texto puro). */
  expressionLatex: string | null;
  /** Segmentos do resultado, ou null (exibir texto puro). */
  segments: ResultSegment[] | null;
}

const EMPTY: SolveLatex = { expressionLatex: null, segments: null };

/**
 * O histórico é re-buscado após cada resolução e os mesmos pares remontam
 * a cada refetch — sem cache, a lista inteira seria reconvertida toda vez.
 * Teto pequeno com evicção por ordem de inserção: o histórico visível tem
 * dezenas de itens, nunca centenas.
 */
const cache = new Map<string, SolveLatex>();
const CACHE_LIMIT = 200;

function cacheKey(expression: string, result: string): string {
  return `${expression}\n${result}`;
}

async function convert(expression: string, result: string): Promise<SolveLatex> {
  const key = cacheKey(expression, result);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const [expressionLatex, segments] = await Promise.all([
    inputToLatex(expression),
    resultToLatex(result),
  ]);
  const value: SolveLatex = { expressionLatex, segments };

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
  return value;
}

interface KeyedSolveLatex extends SolveLatex {
  key: string;
}

/**
 * Conversão assíncrona de um par expressão/resultado do backend para
 * LaTeX (via `lib/math/to-latex`), com o contrato de progressive
 * enhancement da Sprint KaTeX Fase 2: devolve `{null, null}` enquanto a
 * conversão está pendente, falhou ou os argumentos são null — o chamador
 * exibe o texto puro nesses casos. Compartilhado entre `ResultPanel` e
 * `HistoryPanel`; futuros consumidores (preview, editor) devem reutilizá-lo
 * em vez de chamar `to-latex` com efeito próprio.
 *
 * Staleness por chave: se as props mudarem antes da conversão anterior
 * resolver, o valor antigo nunca é exibido para o par novo.
 */
const inputCache = new Map<string, string | null>();

async function convertInput(text: string): Promise<string | null> {
  if (inputCache.has(text)) return inputCache.get(text) ?? null;
  const latex = await inputToLatex(text);
  if (inputCache.size >= CACHE_LIMIT) {
    const oldest = inputCache.keys().next().value;
    if (oldest !== undefined) inputCache.delete(oldest);
  }
  inputCache.set(text, latex);
  return latex;
}

export interface InputLatex {
  /** LaTeX derivado de `source`, ou null (chamador exibe o texto atual). */
  latex: string | null;
  /**
   * O texto EXATO do input que originou `latex` — contrato de
   * consistência: o LaTeX nunca vem de outra fonte além do valor do
   * input. Durante a janela de anti-flicker `source` pode ser o valor
   * anterior (nunca por mais que debounce+conversão); quando a conversão
   * do valor atual resolve, `source` === valor atual do input.
   */
  source: string | null;
}

const EMPTY_INPUT: InputLatex = { latex: null, source: null };

/**
 * Preview em tempo quase real do texto que o usuário está digitando
 * (Sprint KaTeX Fase 4): debounce curto para não converter a cada tecla,
 * cache próprio (a digitação revisita os mesmos prefixos ao apagar) e
 * anti-flicker — enquanto a conversão do texto atual está pendente, o
 * último LaTeX resolvido continua sendo devolvido em vez de null, para o
 * preview não alternar formula→texto→formula entre teclas. Um resultado
 * assíncrono antigo nunca sobrescreve um mais novo: o cleanup do efeito
 * cancela o handler pendente a cada mudança de texto, e `source` declara
 * de qual input o LaTeX atual foi derivado.
 */
export function useInputLatex(text: string, delayMs = 150): InputLatex {
  const [display, setDisplay] = useState<InputLatex | null>(null);
  const trimmed = text.trim();

  useEffect(() => {
    if (trimmed === "") return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void convertInput(trimmed).then(
        (latex) => {
          if (!cancelled) setDisplay({ latex, source: trimmed });
        },
        () => {
          // to-latex é fail-closed; se algo lançar, o fallback textual permanece.
        }
      );
    }, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, delayMs]);

  if (trimmed === "" || display === null) return EMPTY_INPUT;
  return display;
}

export function useSolveLatex(expression: string | null, result: string | null): SolveLatex {
  const [display, setDisplay] = useState<KeyedSolveLatex | null>(null);

  useEffect(() => {
    if (expression === null || result === null) return;
    let cancelled = false;
    void convert(expression, result).then(
      (value) => {
        if (!cancelled) setDisplay({ key: cacheKey(expression, result), ...value });
      },
      () => {
        // `convert` não deve lançar (to-latex é fail-closed); se lançar, fica o fallback textual.
      }
    );
    return () => {
      cancelled = true;
    };
  }, [expression, result]);

  if (expression === null || result === null) return EMPTY;
  return display !== null && display.key === cacheKey(expression, result) ? display : EMPTY;
}
