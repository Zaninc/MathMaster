import type { Metadata } from "next";

import { GraphsWorkspaceLoader } from "@/components/graphs/GraphsWorkspaceLoader";

export const metadata: Metadata = {
  title: "Gráficos",
  description: "Plote funções em um plano cartesiano interativo, com pan, zoom e múltiplas curvas.",
};

export default function GraficosPage() {
  return <GraphsWorkspaceLoader />;
}
