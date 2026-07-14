"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Fade + deslocamento vertical curto a cada troca de rota — só o
 * conteúdo principal (`{children}` dentro de `<main>`), NavBar/Footer
 * nunca remontam. `RouteTransitionFrame` é remontado via `key={pathname}`
 * a cada navegação: seu próprio `useState(false)` já nasce "entering" de
 * graça (sem precisar resetar estado dentro de um efeito, que o lint do
 * React 19 rejeita), e seu `useEffect` de dependência vazia só troca para
 * "entered" no frame seguinte — a transição CSS anima entre os dois
 * estados, sem dependência nenhuma (nem Framer Motion, nem View
 * Transitions API).
 *
 * Reduced motion: a regra global em `globals.css` já zera a duração de
 * qualquer `transition` do site; o atributo `data-motion-reveal` abaixo
 * (compartilhado com `FadeIn`/`RevealOnScroll`) tem uma segunda camada
 * explícita (também em `globals.css`) que garante opacidade 1 / sem
 * deslocamento mesmo antes do JS rodar.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <RouteTransitionFrame key={pathname}>{children}</RouteTransitionFrame>;
}

function RouteTransitionFrame({ children }: { children: React.ReactNode }) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      data-motion-reveal
      className={cn(
        "transition-[opacity,transform] duration-(--motion-base) ease-(--motion-easing)",
        entered ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      )}
    >
      {children}
    </div>
  );
}
