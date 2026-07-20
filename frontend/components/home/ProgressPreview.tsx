import { DomainMeter } from "@/components/learning/DomainMeter";
import { ButtonLink } from "@/components/shared/Button";
import { METER_MESSAGES } from "@/lib/learning/labels";
import { getProgressPreviewData } from "@/lib/home/getProgressPreviewData";

/**
 * Progresso real (não mais "Preview"): mesma Learning Engine e mesmo
 * `DomainMeter` de /aprendizado, dados reais do usuário autenticado.
 * Server Component assíncrono — carregado sob `<Suspense>` em
 * app/page.tsx pra não atrasar o resto da Home numa query do Supabase.
 */
export async function ProgressPreview() {
  const data = await getProgressPreviewData();

  return (
    <section className="border-b border-border py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-xl font-semibold text-text-primary">Seu progresso</h2>

        {data.status === "ready" && (
          <div className="flex flex-col gap-6">
            {data.topics.map((topic) => (
              <DomainMeter
                key={topic.topicId}
                subject={topic.topicTitle}
                percentage={topic.domain!}
                message={METER_MESSAGES[topic.standing]}
              />
            ))}
          </div>
        )}

        {data.status === "new-account" && (
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
            <p className="text-sm text-text-secondary">
              Você ainda não respondeu nenhum exercício — seu progresso aparece aqui assim que você começar a
              praticar.
            </p>
            <ButtonLink href="/aprendizado" className="self-start">
              Começar a praticar
            </ButtonLink>
          </div>
        )}

        {data.status === "signed-out" && (
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
            <p className="text-sm text-text-secondary">
              Crie uma conta gratuita para acompanhar seu domínio real por tópico, calculado a partir dos
              exercícios que você resolver.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/cadastro">Criar conta</ButtonLink>
              <ButtonLink href="/login" variant="secondary">
                Entrar
              </ButtonLink>
            </div>
          </div>
        )}

        {data.status === "error" && (
          <div className="rounded-lg border border-border bg-surface p-6">
            <p className="text-sm text-text-secondary">Não foi possível carregar seu progresso agora.</p>
          </div>
        )}
      </div>
    </section>
  );
}
