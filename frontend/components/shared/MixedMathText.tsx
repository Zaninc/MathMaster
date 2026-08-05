"use client";

import { useEffect, useState } from "react";

import type { TitleSegment } from "@/lib/api/types";
import { valueToLatex } from "@/lib/math/to-latex";

import { MathFormula } from "./MathFormula";

interface MixedMathTextProps {
  segments: TitleSegment[];
  className?: string;
}

/**
 * Hotfix V2.9.1a — um segmento `math` isolado: converte via `valueToLatex`
 * (mesmo pipeline usado por `MathStepItem` para `expression`) e promove a
 * KaTeX inline (nunca `displayMode`/`scrollable` — um fragmento de título é
 * sempre curto). `convertedFor` evita mostrar o LaTeX de um segmento
 * ANTERIOR por uma fração de segundo (mesma técnica "chave" de
 * `MathStepItem.tsx`/`useSolveLatex.ts`); `setLatex`/`setConvertedFor` só
 * são chamados dentro do callback assíncrono, nunca síncrono no corpo do
 * efeito.
 */
function MathTextSegment({ content }: { content: string }) {
  const [latex, setLatex] = useState<string | null>(null);
  const [convertedFor, setConvertedFor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    valueToLatex(content).then(
      (result) => {
        if (cancelled) return;
        setLatex(result);
        setConvertedFor(content);
      },
      () => {
        // to-latex é fail-closed; se lançar mesmo assim, mantém o texto puro.
      }
    );
    return () => {
      cancelled = true;
    };
  }, [content]);

  const displayLatex = convertedFor === content ? latex : null;
  return displayLatex !== null ? <MathFormula formula={displayLatex} /> : <span>{content}</span>;
}

/**
 * Hotfix V2.9.1a — renderiza um título (ou qualquer texto de passo) que
 * mistura texto comum com fórmulas embutidas, ex. "Aplicando a fórmula de
 * Bhaskara (x=(-b+√Δ)/(2a)) — primeira raiz": cada pedaço `text` vira texto
 * puro, cada pedaço `math` vira KaTeX inline via `MathFormula` — nunca o
 * título inteiro virando uma única fórmula (que quebraria as palavras em
 * português) nem uma tentativa de achar fórmulas escondidas na frase via
 * regex (a segmentação já vem pronta do backend, em `MathStep.
 * title_segments`).
 *
 * Componente compartilhado e independente de domínio — reutilizável por
 * qualquer `MathStep` futuro que precise do mesmo padrão (derivadas,
 * integrais, matrizes...), não específico de Bhaskara/quadráticas.
 * `flex-wrap` evita overflow horizontal em telas estreitas.
 */
export function MixedMathText({ segments, className }: MixedMathTextProps) {
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 ${className ?? ""}`.trim()}>
      {segments.map((segment, index) =>
        segment.type === "math" ? (
          <MathTextSegment key={index} content={segment.content} />
        ) : (
          <span key={index}>{segment.content}</span>
        )
      )}
    </span>
  );
}
