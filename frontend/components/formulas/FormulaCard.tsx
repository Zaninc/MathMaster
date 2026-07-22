"use client";

import { useState } from "react";

import {
  CONTEXT_PILL_CLASSES,
  CONTEXT_PILL_IDLE_CLASSES,
  CONTEXT_REVEAL_ON_HOVER_CLASSES,
  ContextActionPill,
  ContextActionsEyebrow,
} from "@/components/shared/ContextActions";
import { MathFormula } from "@/components/shared/MathFormula";
import { getFormulaConnections } from "@/data/connections";
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
 * botão — mas a estrela de favorito, o botão de copiar e as ações
 * contextuais (sistema de conexões internas, `data/connections.ts`) são
 * interativos. O fallback de LaTeX inválido já vem de dentro do
 * MathFormula (nunca lança, nunca derruba a página) — o título continua
 * visível mesmo nesse caso.
 *
 * A fórmula ganha um wrapper com padding vertical próprio (`py-3`) — o
 * `MathFormula` em `displayMode` zera a margem do KaTeX de propósito
 * (`[&_.katex-display]:my-0`, ver seu próprio comentário) justamente pra
 * deixar o espaçamento vertical a cargo de quem consome, que é aqui.
 *
 * Um `border-t` separa a matemática das ferramentas, que vivem numa
 * grade de EXATAMENTE 2 colunas — conexões (`getFormulaConnections`)
 * primeiro, botão de copiar sempre por último. Fórmulas sem conexão
 * curada não ganham o eyebrow "Ferramentas" (decisão explícita: uma ação
 * sem exemplo real por trás, ex. "abrir calculadora em branco", não tem
 * utilidade e só passa a impressão de recurso quebrado) — só o botão de
 * copiar aparece, sozinho na grade.
 *
 * `copySpansFullWidth`: como o botão de copiar é sempre o último item da
 * grade, ele é o "ímpar" sempre que o total de ações (conexões + copiar)
 * for ímpar — ou seja, sempre que `connections.length` for par (0 ou 2).
 * Nesse caso ele ocupa as duas colunas (`col-span-2`) em vez de ficar
 * isolado sozinho num canto. Com 1 ou 3 conexões, o total já é par e a
 * grade fecha perfeitamente sem precisar de span nenhum.
 *
 * O botão de copiar reaproveita os MESMOS tokens visuais de
 * `ContextActionPill` (`CONTEXT_PILL_CLASSES`) — mesma pill, mesma
 * fonte, mesmo hover — mesmo não sendo um link do sistema de conexões,
 * pra não destoar visualmente na mesma grade. Toda ação revelada no
 * hover (`CONTEXT_REVEAL_ON_HOVER_CLASSES`) segue o mesmo padrão:
 * opacidade 0 em telas `sm+`, revelada por
 * `group-hover`/`group-focus-within` (foco por teclado tem paridade com
 * hover do mouse); no mobile (sem hover) já vêm visíveis por padrão.
 */
export function FormulaCard({ formula, isFavorite, onToggleFavorite }: FormulaCardProps) {
  const [copied, setCopied] = useState(false);
  const connections = getFormulaConnections(formula.id);
  const copySpansFullWidth = connections.length % 2 === 0;

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
    <article className="group relative flex flex-col rounded-lg border border-border bg-surface p-4">
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
      <div className="py-3">
        <MathFormula formula={formula.latex} displayMode className="text-text-primary" />
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        {connections.length > 0 && (
          <ContextActionsEyebrow label="Ferramentas" className={CONTEXT_REVEAL_ON_HOVER_CLASSES} />
        )}
        <div className="grid grid-cols-2 gap-1">
          {connections.map((link) => (
            <ContextActionPill key={link.label} link={link} className={CONTEXT_REVEAL_ON_HOVER_CLASSES} />
          ))}

          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "Fórmula copiada" : "Copiar fórmula"}
            className={cn(
              CONTEXT_PILL_CLASSES,
              CONTEXT_REVEAL_ON_HOVER_CLASSES,
              copySpansFullWidth && "col-span-2",
              copied ? "text-success hover:text-success" : CONTEXT_PILL_IDLE_CLASSES
            )}
          >
            <span aria-hidden="true" className="text-[13px] leading-none opacity-75">
              📋
            </span>
            <span>{copied ? "Copiado!" : "Copiar fórmula"}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
