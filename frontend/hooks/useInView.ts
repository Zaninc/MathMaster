"use client";

import { useEffect, useRef, useState } from "react";

/**
 * `true` assim que o elemento entra na viewport pela primeira vez —
 * `IntersectionObserver` nativo, desconecta depois do primeiro disparo
 * (nunca re-observa, "no máximo uma vez" por design).
 */
export function useInView<T extends HTMLElement>(threshold = 0.2): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView];
}
