import type { Metadata } from "next";

import { PageShell } from "@/components/layout/PageShell";
import { FormulasReference } from "@/components/tools/FormulasReference";
import { ToolCard } from "@/components/tools/ToolCard";
import { TOOLS } from "@/data/tools";

export const metadata: Metadata = {
  title: "Ferramentas",
  description: "Histórico, fórmulas de referência e os recursos planejados para as próximas versões do MathMaster.",
};

export default function FerramentasPage() {
  return (
    <PageShell className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-text-primary">Ferramentas</h1>
        <p className="max-w-2xl text-sm text-text-secondary">
          Recursos complementares ao redor da matemática. Cada card mostra honestamente se já funciona hoje ou se
          está planejado — nada aqui finge estar pronto.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.title} tool={tool} />
        ))}
      </div>

      <FormulasReference />
    </PageShell>
  );
}
