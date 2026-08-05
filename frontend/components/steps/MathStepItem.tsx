"use client";

import { useEffect, useState } from "react";

import { MathFormula } from "@/components/shared/MathFormula";
import type { StepItem } from "@/lib/api/types";
import { valueToLatex } from "@/lib/math/to-latex";

interface MathStepItemProps {
  index: number;
  step: StepItem;
}

/**
 * Sprint V2.9 — um passo individual do passo a passo. `step.expression` é
 * sempre texto matemático puro vindo do backend; a conversão para KaTeX
 * reutiliza `valueToLatex` (mesmo pipeline do eco de expressão/histórico,
 * já sabe reconhecer sistemas via "\n" -> `\begin{cases}` e listas de
 * igualdades "x=3, y=2"). Progressive enhancement: texto puro primeiro,
 * promovido a KaTeX quando a conversão assíncrona resolve — nunca bloqueia
 * a exibição do passo.
 */
export function MathStepItem({ index, step }: MathStepItemProps) {
  // `convertedFor` (não só `latex`) evita mostrar o LaTeX de um passo
  // ANTERIOR por uma fração de segundo quando `step.expression` muda antes
  // da conversão nova resolver — mesmo padrão "chave" de
  // `useSolveLatex.ts` (`KeyedSolveLatex`). `setLatex`/`setConvertedFor`
  // só são chamados dentro do callback assíncrono, nunca de forma síncrona
  // no corpo do efeito (`react-hooks/set-state-in-effect`).
  const [latex, setLatex] = useState<string | null>(null);
  const [convertedFor, setConvertedFor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    valueToLatex(step.expression).then(
      (result) => {
        if (cancelled) return;
        setLatex(result);
        setConvertedFor(step.expression);
      },
      () => {
        // to-latex é fail-closed; se lançar mesmo assim, mantém o texto puro.
      }
    );
    return () => {
      cancelled = true;
    };
  }, [step.expression]);

  const displayLatex = convertedFor === step.expression ? latex : null;

  return (
    <li className="flex flex-col gap-1 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <div className="flex items-baseline gap-2">
        <span
          aria-hidden="true"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-xs font-medium text-text-secondary"
        >
          {index}
        </span>
        {step.title !== null && (
          <span className="text-sm font-medium text-text-secondary">{step.title}</span>
        )}
      </div>
      <div className="min-w-0 pl-7 text-base text-text-primary">
        {displayLatex !== null ? (
          <MathFormula formula={displayLatex} scrollable />
        ) : (
          <span>{step.expression}</span>
        )}
      </div>
      {step.explanation !== null && <p className="pl-7 text-xs text-text-muted">{step.explanation}</p>}
    </li>
  );
}
