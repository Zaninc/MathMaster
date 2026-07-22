"use client";

import Link from "next/link";
import { useState } from "react";

import { MathFormula } from "@/components/shared/MathFormula";
import { getFormulaConnections } from "@/data/connections";
import type { FormulaEntry } from "@/data/formulas";
import { cn } from "@/lib/utils/cn";

interface FormulaCardProps {
  formula: FormulaEntry;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

/** Mesmo tratamento visual/de foco em toda ação revelada no hover do card — ver comentário no fim do arquivo. */
const REVEALED_ACTION_CLASSES =
  "rounded text-xs font-medium transition-opacity duration-(--motion-fast) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100";

/**
 * Card de uma única fórmula (Biblioteca de Fórmulas). O card em si não é
 * clicável — de propósito sem hover/cursor de link, para não parecer um
 * botão — mas a estrela de favorito, o botão de copiar e as ações
 * contextuais (sistema de conexões internas, `data/connections.ts`) são
 * interativos. O fallback de LaTeX inválido já vem de dentro do
 * MathFormula (nunca lança, nunca derruba a página) — o título continua
 * visível mesmo nesse caso.
 *
 * Fórmulas sem conexão curada em `getFormulaConnections` não ganham
 * nenhuma ação extra — decisão explícita: uma ação sem exemplo real por
 * trás (ex. "abrir calculadora em branco") não tem utilidade e só passa a
 * impressão de recurso quebrado.
 *
 * Todas as ações reveladas no hover (`REVEALED_ACTION_CLASSES`) seguem o
 * mesmo padrão: opacidade 0 em telas `sm+`, revelada por
 * `group-hover`/`group-focus-within` (foco por teclado tem paridade com
 * hover do mouse); no mobile (sem hover) já vêm visíveis por padrão.
 */
export function FormulaCard({ formula, isFavorite, onToggleFavorite }: FormulaCardProps) {
  const [copied, setCopied] = useState(false);
  const connections = getFormulaConnections(formula.id);

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
          "absolute right-3 top-3 rounded text-lg leading-none transition-colors duration-(--motion-fast) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          isFavorite ? "text-accent" : "text-text-muted hover:text-text-secondary"
        )}
      >
        {isFavorite ? "★" : "☆"}
      </button>

      <h3 className="pr-8 text-sm font-semibold text-text-primary">{formula.title}</h3>
      <MathFormula formula={formula.latex} displayMode className="text-text-primary" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {connections.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {connections.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                aria-label={link.label}
                className={cn(REVEALED_ACTION_CLASSES, "text-text-secondary hover:text-text-primary")}
              >
                <span aria-hidden="true">{link.icon}</span> {link.label}
              </Link>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Fórmula copiada" : "Copiar fórmula"}
          className={cn(
            REVEALED_ACTION_CLASSES,
            "ml-auto",
            copied ? "text-success" : "text-text-secondary hover:text-text-primary"
          )}
        >
          {copied ? "Copiado!" : "📋 Copiar fórmula"}
        </button>
      </div>
    </article>
  );
}
