"use client";

import { useEffect, useState } from "react";

import { MathFormula } from "@/components/shared/MathFormula";
import { previewLatex } from "@/lib/math/to-latex";
import { exerciseChoiceContent, type ExerciseChoice } from "@/lib/supabase/types";

interface ExerciseChoiceContentProps {
  choice: ExerciseChoice;
  className?: string;
}

/**
 * Sprint "KaTeX em alternativas" — renderiza UMA alternativa de exercício
 * de múltipla escolha, decidindo texto puro vs. KaTeX pela informação
 * ESTRUTURAL do dado (`ExerciseChoice.format`), nunca por heurística
 * sobre o conteúdo (ex. "contém = então é matemática" quebraria em "A
 * resposta é x=3" vs. "Não possui solução real"). Uma `string` bare
 * (todo o catálogo até esta sprint) e `{content, format: "text"}`
 * renderizam IDÊNTICO a antes — só `{content, format: "math"}` passa
 * por `previewLatex` (o MESMO conversor que a Calculadora já usa,
 * `lib/math/to-latex.ts` — nenhum parser paralelo).
 *
 * Componente único e centralizado: `ExerciseCard.tsx` e qualquer futuro
 * consumidor de alternativas só chamam este componente, nunca decidem
 * KaTeX vs. texto sozinhos — nenhuma lógica de formato espalhada pelos
 * arquivos do catálogo.
 *
 * `previewLatex` é assíncrono e "nunca falha" para entrada não-vazia
 * (Tier 2 de `to-latex.ts` sempre devolve alguma coisa) — mas enquanto a
 * conversão está pendente, ou se `content` mudar entre renders, mostra o
 * texto puro em vez de um flash do conteúdo anterior (mesma técnica
 * `convertedFor` já usada por `MixedMathText.tsx`).
 */
export function ExerciseChoiceContent({ choice, className }: ExerciseChoiceContentProps) {
  const content = exerciseChoiceContent(choice);
  const isMath = typeof choice !== "string" && choice.format === "math";

  const [latex, setLatex] = useState<string | null>(null);
  const [convertedFor, setConvertedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!isMath) return;
    let cancelled = false;
    previewLatex(content).then(
      (result) => {
        if (cancelled) return;
        setLatex(result);
        setConvertedFor(content);
      },
      () => {
        // previewLatex é fail-closed; se lançar mesmo assim, mantém o texto puro.
      }
    );
    return () => {
      cancelled = true;
    };
  }, [isMath, content]);

  const displayLatex = isMath && convertedFor === content ? latex : null;

  if (displayLatex !== null) {
    return <MathFormula formula={displayLatex} scrollable className={className} />;
  }

  return <span className={className}>{content}</span>;
}
