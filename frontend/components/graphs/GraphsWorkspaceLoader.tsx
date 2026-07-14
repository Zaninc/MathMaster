"use client";

import dynamic from "next/dynamic";

/**
 * `ssr: false` só é permitido dentro de um Client Component — por isso
 * este carregador existe separado de `app/graficos/page.tsx` (que precisa
 * continuar Server Component para poder exportar `metadata`).
 * `mathjs`/o plano cartesiano só carregam quando esta rota é visitada
 * (performance — Seção 23 do briefing).
 */
const GraphsWorkspace = dynamic(
  () => import("./GraphsWorkspace").then((mod) => mod.GraphsWorkspace),
  {
    ssr: false,
    loading: () => <p className="px-4 py-16 text-center text-text-muted">Carregando gráficos...</p>,
  }
);

export function GraphsWorkspaceLoader() {
  return <GraphsWorkspace />;
}
