import { FutureTeaser } from "@/components/home/FutureTeaser";
import { Hero } from "@/components/home/Hero";
import { Pillars } from "@/components/home/Pillars";
import { ProgressPreview } from "@/components/home/ProgressPreview";
import { QuickCalculator } from "@/components/home/QuickCalculator";
import { VisualizationPreview } from "@/components/home/VisualizationPreview";
import { RevealOnScroll } from "@/components/shared/RevealOnScroll";

/**
 * Home (Etapa 1 — Sprint Frontend V1): hero, calculadora rápida, pilares,
 * prévia de progresso, prévia visual e teaser do Math Mentor. Sem
 * `PageShell`: cada seção é full-bleed com divisórias (`border-b`) e
 * gerencia seu próprio container interno — layout de landing page, não de
 * painel de conteúdo (`PageShell` continua usado pelas páginas internas).
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
        <ProgressPreview />
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
