import { Suspense } from "react";

import { CalculatorWorkspace } from "@/components/calculator/CalculatorWorkspace";

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
