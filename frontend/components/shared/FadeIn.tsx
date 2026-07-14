"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils/cn";

interface FadeInProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Fade + deslocamento vertical curto no mount — mesma técnica de
 * `RouteTransition`, para conteúdo que aparece dentro de uma página já
 * carregada (resultado da Calculadora/Geometria, nova função no gráfico),
 * não a troca de rota inteira. Reduced motion tratado via o atributo
 * compartilhado `data-motion-reveal` (`globals.css`).
 */
export function FadeIn({ children, className }: FadeInProps) {
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
        entered ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
        className
      )}
    >
      {children}
    </div>
  );
}
