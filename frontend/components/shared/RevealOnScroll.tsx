"use client";

import { useInView } from "@/hooks/useInView";
import { cn } from "@/lib/utils/cn";

interface RevealOnScrollProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Fade + deslocamento vertical curto quando a seção entra na viewport —
 * só na Home (Pilares, Progresso, Visualização, Teaser do Mentor), dispara
 * no máximo uma vez. Reduced motion via `data-motion-reveal`
 * (`globals.css`, compartilhado com `FadeIn`/`RouteTransition`).
 */
export function RevealOnScroll({ children, className }: RevealOnScrollProps) {
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      data-motion-reveal
      className={cn(
        "transition-[opacity,transform] duration-(--motion-slow) ease-(--motion-easing)",
        inView ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        className
      )}
    >
      {children}
    </div>
  );
}
