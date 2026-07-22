import type { Metadata } from "next";
import { Suspense } from "react";

import { GraphsWorkspaceLoader } from "@/components/graphs/GraphsWorkspaceLoader";

export const metadata: Metadata = {
  title: "Gráficos",
  description: "Plote funções em um plano cartesiano interativo, com pan, zoom e múltiplas curvas.",
};

/**
 * `Suspense` é exigência técnica do Next.js App Router para qualquer
 * componente que use `useSearchParams()` (lê `?fn=`, sistema de conexões
 * internas), não uma escolha de design — mesmo padrão de
 * `app/calculadora/page.tsx`.
 */
export default function GraficosPage() {
  return (
    <Suspense fallback={null}>
      <GraphsWorkspaceLoader />
    </Suspense>
  );
}
