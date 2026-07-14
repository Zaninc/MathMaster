"use client";

import dynamic from "next/dynamic";

/**
 * `ssr: false` só é permitido em Client Component — por isso este
 * arquivo é "use client" (não uma escolha de design, exigência do App
 * Router). `mathjs`/o plano cartesiano só carregam quando esta rota é
 * visitada (performance — Seção 23 do briefing).
 */
const GraphsWorkspace = dynamic(
  () => import("@/components/graphs/GraphsWorkspace").then((mod) => mod.GraphsWorkspace),
  {
    ssr: false,
    loading: () => <p className="px-4 py-16 text-center text-text-muted">Carregando gráficos...</p>,
  }
);

export default function GraficosPage() {
  return <GraphsWorkspace />;
}
