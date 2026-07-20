import { ButtonLink } from "@/components/shared/Button";

/**
 * Banner de boas-vindas para conta nova (Sprint V1.5.5) — mostrado
 * quando o aluno ainda não tem nenhuma tentativa registrada. As demais
 * seções do dashboard continuam aparecendo abaixo (estatísticas
 * zeradas de forma intencional, tópicos "não iniciado", recomendações
 * de "comece X"): este banner só reforça a orientação inicial, não
 * substitui as seções.
 */
export function DashboardEmptyState() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-accent/10 p-6">
      <h2 className="text-lg font-semibold text-text-primary">Bem-vindo ao MathMaster!</h2>
      <p className="text-sm text-text-secondary">
        Seu progresso ainda está zerado porque você não respondeu nenhum exercício — e não tem problema
        nenhum nisso. Assim que você começar a praticar, as estatísticas e o progresso por tópico logo
        abaixo passam a refletir o seu desempenho real.
      </p>
      <ButtonLink href="/aprendizado" className="self-start">
        Começar a praticar
      </ButtonLink>
    </div>
  );
}
