import { PageShell } from "@/components/layout/PageShell";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";

interface RoutePlaceholderProps {
  title: string;
  description: string;
  badge?: BadgeVariant;
}

/**
 * Placeholder honesto para rotas cujo conteúdo ainda não foi construído
 * (etapas seguintes da Sprint Frontend V1) — existe só para a navegação
 * funcionar de ponta a ponta já na Etapa 0 (Fundação), sem fingir
 * funcionalidade que ainda não existe.
 */
export function RoutePlaceholder({ title, description, badge = "planned" }: RoutePlaceholderProps) {
  return (
    <PageShell className="flex flex-col items-start gap-4 py-16">
      <Badge variant={badge} />
      <h1 className="text-2xl font-semibold text-text-primary">{title}</h1>
      <p className="max-w-xl text-text-secondary">{description}</p>
    </PageShell>
  );
}
