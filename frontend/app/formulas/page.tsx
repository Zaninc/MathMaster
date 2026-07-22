import type { Metadata } from "next";
import { Suspense } from "react";

import { FormulasReference } from "@/components/formulas/FormulasReference";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title: "Fórmulas",
  description: "Referência rápida das fórmulas mais usadas em álgebra, geometria, trigonometria e cálculo.",
};

/**
 * `Suspense` é exigência técnica do Next.js App Router para qualquer
 * componente que use `useSearchParams()` (lê `?categoria=`/`?q=`, sistema
 * de conexões internas), não uma escolha de design — mesmo padrão de
 * `app/calculadora/page.tsx`.
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

      <Suspense fallback={null}>
        <FormulasReference />
      </Suspense>
    </PageShell>
  );
}
