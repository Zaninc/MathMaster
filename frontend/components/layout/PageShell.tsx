import { cn } from "@/lib/utils/cn";

export type PageShellVariant = "default" | "full-workspace";

/**
 * Fonte única de largura máxima/padding/ritmo vertical para páginas
 * internas (hotfix de alinhamento — antes cada workspace duplicava seu
 * próprio `max-w-6xl` na mão, gerando inconsistência real de largura).
 *
 * `default`: conteúdo denso, não é um workspace de 2 colunas (Aprendizado,
 * Ferramentas, Math Mentor).
 * `full-workspace`: painel lateral + área visual dominante (Calculadora,
 * Gráficos, Geometria) — container um pouco mais largo, padding vertical
 * um pouco menor para dar mais espaço à área de trabalho.
 */
const VARIANT_CLASSES: Record<PageShellVariant, string> = {
  default: "max-w-[1220px] px-4 py-10 sm:px-6 lg:px-8",
  "full-workspace": "max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8",
};

interface PageShellProps {
  children: React.ReactNode;
  variant?: PageShellVariant;
  className?: string;
}

export function PageShell({ children, variant = "default", className }: PageShellProps) {
  return <div className={cn("mx-auto w-full", VARIANT_CLASSES[variant], className)}>{children}</div>;
}
