"use client";

import { useState } from "react";

import { MathFormula } from "@/components/shared/MathFormula";
import type { FormulaEntry } from "@/data/formulas";
import { cn } from "@/lib/utils/cn";

interface FormulaCardProps {
  formula: FormulaEntry;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

/**
 * Card de uma única fórmula (Biblioteca de Fórmulas). O card em si não é
 * clicável — de propósito sem hover/cursor de link, para não parecer um
 * botão — mas a estrela de favorito e o botão de copiar são interativos.
 * O fallback de LaTeX inválido já vem de dentro do MathFormula (nunca
 * lança, nunca derruba a página) — o título continua visível mesmo nesse
 * caso.
 *
 * O botão de copiar fica com opacidade 0 e só aparece no hover/foco do
 * card (`group-hover`/`group-focus-within`) em telas `sm+`; abaixo disso
 * (mobile, sem hover) ele já vem visível por padrão.
 */
export function FormulaCard({ formula, isFavorite, onToggleFavorite }: FormulaCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formula.latex);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível (ex. contexto não seguro) — não é crítico, falha silenciosa
    }
  }

  return (
    <article className="group relative flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <button
        type="button"
        onClick={() => onToggleFavorite(formula.id)}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        className={cn(
          "absolute right-3 top-3 text-lg leading-none transition-colors duration-(--motion-fast)",
          isFavorite ? "text-accent" : "text-text-muted hover:text-text-secondary"
        )}
      >
        {isFavorite ? "★" : "☆"}
      </button>

      <h3 className="pr-8 text-sm font-semibold text-text-primary">{formula.title}</h3>
      <MathFormula formula={formula.latex} displayMode className="text-text-primary" />

      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          "self-end text-xs font-medium transition-opacity duration-(--motion-fast)",
          "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
          copied ? "text-success" : "text-text-secondary hover:text-text-primary"
        )}
      >
        {copied ? "Copiado!" : "📋 Copiar fórmula"}
      </button>
    </article>
  );
}
