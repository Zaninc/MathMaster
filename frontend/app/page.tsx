import { Suspense } from "react";

import { FutureTeaser } from "@/components/home/FutureTeaser";
import { Hero } from "@/components/home/Hero";
import { Pillars } from "@/components/home/Pillars";
import { ProgressPreview } from "@/components/home/ProgressPreview";
import { ProgressPreviewSkeleton } from "@/components/home/ProgressPreviewSkeleton";
import { QuickCalculator } from "@/components/home/QuickCalculator";
import { VisualizationPreview } from "@/components/home/VisualizationPreview";
import { RevealOnScroll } from "@/components/shared/RevealOnScroll";

/**
 * Home (Etapa 1 — Sprint Frontend V1): hero, calculadora rápida, pilares,
 * progresso real, prévia visual e teaser do Math Mentor. Sem
 * `PageShell`: cada seção é full-bleed com divisórias (`border-b`) e
 * gerencia seu próprio container interno — layout de landing page, não de
 * painel de conteúdo (`PageShell` continua usado pelas páginas internas).
 *
 * `ProgressPreview` é assíncrono (dados reais do Supabase) e fica sob
 * `<Suspense>` de propósito — só essa seção espera a query, o resto da
 * Home renderiza imediatamente.
 *
 * O histórico que existia aqui na Etapa 0 (herdado do Sprint 2) foi
 * removido — não faz parte da especificação desta Home; `/history` do
 * backend continua existindo, uma superfície dedicada fica para Ferramentas.
 */
export default function Home() {
  return (
    <>
      <Hero />
      <QuickCalculator />
      <RevealOnScroll>
        <Pillars />
      </RevealOnScroll>
      <RevealOnScroll>
        <Suspense fallback={<ProgressPreviewSkeleton />}>
          <ProgressPreview />
        </Suspense>
      </RevealOnScroll>
      <RevealOnScroll>
        <VisualizationPreview />
      </RevealOnScroll>
      <RevealOnScroll>
        <FutureTeaser />
      </RevealOnScroll>
    </>
  );
}
