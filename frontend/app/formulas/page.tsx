import type { Metadata } from "next";

import { FormulasReference } from "@/components/formulas/FormulasReference";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title: "Fórmulas",
  description: "Referência rápida das fórmulas mais usadas em álgebra, geometria, trigonometria e cálculo.",
};

/**
 * Biblioteca de Fórmulas — Etapa 1: só reorganização de navegação (rota
 * própria em vez de seção dentro de /ferramentas). KaTeX, filtros, busca
 * e novas fórmulas ficam para as próximas etapas.
 */
export default function FormulasPage() {
  return (
    <PageShell className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-text-primary">Fórmulas</h1>
        <p className="max-w-2xl text-sm text-text-secondary">
          Referência rápida das fórmulas mais usadas em álgebra, geometria, trigonometria e cálculo.
        </p>
      </div>

      <FormulasReference />
    </PageShell>
  );
}
