"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Sprint V2.1 (apresentação progressiva): mede se um elemento REALMENTE
 * ultrapassa sua própria largura visível (`scrollWidth > clientWidth`) —
 * critério visual de verdade, não uma contagem de caracteres/complexidade
 * simbólica (que não reflete o espaço ocupado na tela em fontes/zooms/
 * larguras de viewport diferentes).
 *
 * Ref de CALLBACK (não `useRef`+`useEffect([])`) de propósito: o elemento
 * medido pode desmontar e remontar (`ProgressiveMathResult` desmonta a
 * fórmula exata ao trocar para a aproximação, remontando se o usuário
 * pedir para ver o exato de novo) — só uma ref de callback é notificada a
 * cada anexação/desanexação real, permitindo reconectar o `ResizeObserver`
 * ao nó novo toda vez. Ao desanexar (elemento removido), a última medição
 * conhecida é PRESERVADA (nunca reiniciada para `false`) — não há nada
 * para remedir sem o elemento, e resetar causaria uma alternância infinita
 * entre aproximado/exato no chamador (ver `ProgressiveMathResult`).
 */
export function useIsOverflowing<T extends HTMLElement>(): [(node: T | null) => void, boolean] {
  const [isOverflowing, setIsOverflowing] = useState(false);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) return;

    const check = () => {
      const next = node.scrollWidth > node.clientWidth + 1;
      setIsOverflowing((previous) => (previous === next ? previous : next));
    };

    check();
    const observer = new ResizeObserver(check);
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  return [ref, isOverflowing];
}
