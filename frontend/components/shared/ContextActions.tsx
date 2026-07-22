import Link from "next/link";

import type { RelatedLink } from "@/data/connections";
import { cn } from "@/lib/utils/cn";

/**
 * Linguagem visual única dos atalhos contextuais do sistema de conexões
 * internas (`data/connections.ts`) — nasceu no bloco "Explorar" da
 * Calculadora e foi extraída pra cá pra ser reutilizada sempre que uma
 * tela precisar oferecer "ir para outra ferramenta" sem parecer um
 * recurso colado depois: Geometria ("Ferramentas relacionadas") e
 * Fórmulas (ações por card) já usam; Dashboard/Histórico são candidatos
 * futuros com o mesmo formato de dado (`RelatedLink[]`).
 */
export const CONTEXT_PILL_CLASSES =
  "group/pill inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium tracking-[-0.01em] transition-colors duration-(--motion-base) ease-out hover:bg-accent/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/** Cor padrão (ociosa → hover) de uma pill — separada de `CONTEXT_PILL_CLASSES` pra usos com um 3º estado (ex. botão de copiar "copiado!") poderem substituir só a cor, sem duas classes de `color` concorrentes na mesma string. */
export const CONTEXT_PILL_IDLE_CLASSES = "text-text-secondary hover:text-text-primary";

const CONTEXT_PILL_ICON_CLASSES =
  "text-[13px] leading-none opacity-75 transition-opacity duration-(--motion-base) group-hover/pill:opacity-100";

/**
 * Some ao hover/foco do `.group` ancestral mais próximo — oculto por
 * padrão em telas `sm+`, sempre visível abaixo disso (mobile não tem
 * hover). Foco por teclado (`group-focus-within`) tem paridade com hover
 * do mouse, de propósito.
 */
export const CONTEXT_REVEAL_ON_HOVER_CLASSES =
  "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100";

interface ContextActionPillProps {
  link: RelatedLink;
  className?: string;
}

export function ContextActionPill({ link, className }: ContextActionPillProps) {
  return (
    <Link href={link.href} aria-label={link.label} className={cn(CONTEXT_PILL_CLASSES, CONTEXT_PILL_IDLE_CLASSES, className)}>
      <span aria-hidden="true" className={CONTEXT_PILL_ICON_CLASSES}>
        {link.icon}
      </span>
      <span>{link.label}</span>
    </Link>
  );
}

interface ContextActionsEyebrowProps {
  label: string;
  className?: string;
}

export function ContextActionsEyebrow({ label, className }: ContextActionsEyebrowProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-accent" />
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {label}
      </span>
    </div>
  );
}

interface ContextActionsProps {
  eyebrow: string;
  links: RelatedLink[];
  className?: string;
}

/**
 * Bloco autônomo eyebrow + fileira de pills, sempre visível (sem
 * revelação por hover) — pra telas onde as ações já têm seu próprio
 * container isolado (Explorar da Calculadora, Ferramentas relacionadas
 * da Geometria). `FormulaCard` tem um layout mais específico (ações
 * reveladas por hover, ao lado do botão de copiar) e por isso usa
 * `ContextActionsEyebrow`/`ContextActionPill` diretamente em vez deste
 * wrapper — ver `FormulaCard.tsx`.
 */
export function ContextActions({ eyebrow, links, className }: ContextActionsProps) {
  if (links.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <ContextActionsEyebrow label={eyebrow} />
      <div className="flex flex-wrap gap-1">
        {links.map((link) => (
          <ContextActionPill key={link.label} link={link} />
        ))}
      </div>
    </div>
  );
}
