import { ButtonLink } from "@/components/shared/Button";
import type { RecommendationView } from "@/lib/dashboard/aggregate";

const CTA_LABEL: Record<RecommendationView["kind"], string> = {
  practice: "Praticar",
  start: "Começar",
  dominate: "Revisar",
};

interface StudyRecommendationsProps {
  recommendations: RecommendationView[];
  hasAnyTopics: boolean;
}

/**
 * Recomendações de estudo (Sprint V1.5.5) — vitrine das recomendações já
 * calculadas pela Learning Engine (lib/learning/metrics.ts); nenhum
 * algoritmo novo aqui. O CTA linka direto para /aprendizado?topico=slug
 * quando o slug do tópico é conhecido.
 */
export function StudyRecommendations({ recommendations, hasAnyTopics }: StudyRecommendationsProps) {
  return (
    <section
      aria-label="Recomendações de estudo"
      className="flex flex-col gap-4 rounded-lg border border-accent/40 bg-accent/10 p-5"
    >
      <h2 className="text-lg font-semibold text-text-primary">O que estudar agora</h2>

      {recommendations.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {recommendations.map((recommendation) => (
            <li
              key={recommendation.topicId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-3"
            >
              <span className="text-sm text-text-primary">{recommendation.message}</span>
              {recommendation.topicSlug && (
                <ButtonLink
                  href={`/aprendizado?topico=${recommendation.topicSlug}`}
                  variant="secondary"
                  className="shrink-0"
                >
                  {CTA_LABEL[recommendation.kind]}
                </ButtonLink>
              )}
            </li>
          ))}
        </ul>
      ) : hasAnyTopics ? (
        <p className="text-sm text-text-secondary">
          Continue respondendo exercícios para receber recomendações personalizadas por tópico.
        </p>
      ) : (
        <p className="text-sm text-text-secondary">
          Nenhum tópico disponível ainda — volte quando o Aprendizado tiver exercícios cadastrados.
        </p>
      )}
    </section>
  );
}
