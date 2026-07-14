"use client";

import { useEffect, useRef, useState } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Mede o tamanho real (em pixels) de um elemento via `ResizeObserver` —
 * usado pelos canvases de Gráficos/Geometria para preencher o container
 * disponível em vez de um viewBox fixo pequeno. `{ width: 0, height: 0 }`
 * antes da primeira medição — o chamador não deve desenhar nada nesse
 * estado (evita divisão por zero nas conversões pixel<->dado).
 */
export function useElementSize<T extends HTMLElement>(): [React.RefObject<T | null>, ElementSize] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((previous) => (previous.width === width && previous.height === height ? previous : { width, height }));
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}
