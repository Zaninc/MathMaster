import type { Metadata } from "next";
import { Suspense } from "react";

import { CalculatorWorkspace } from "@/components/calculator/CalculatorWorkspace";

export const metadata: Metadata = {
  title: "Calculadora",
  description: "Resolva álgebra, funções, trigonometria, geometria analítica e cálculo com o motor real do MathMaster.",
};

/**
 * `Suspense` é exigência técnica do Next.js App Router para qualquer
 * componente que use `useSearchParams()` (lê `?expression=...`), não uma
 * escolha de design.
 */
export default function CalculadoraPage() {
  return (
    <Suspense fallback={null}>
      <CalculatorWorkspace />
    </Suspense>
  );
}
