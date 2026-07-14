import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/shared/Badge";
import { MENTOR_FEATURES } from "@/data/mentor-features";

/**
 * Preview honesto — sem chat funcional (decisão explícita do briefing).
 * O input desabilitado tem a explicação em texto visível, não só no
 * `placeholder` (que alguns leitores de tela não anunciam de forma
 * confiável), para não criar uma armadilha de acessibilidade atrás do
 * "desfoque elegante".
 */
export function MathMentorPreview() {
  return (
    <PageShell className="flex flex-col items-center gap-10 py-16 text-center">
      <div className="flex flex-col items-center gap-3">
        <Badge variant="dev" />
        <h1 className="text-3xl font-semibold text-text-primary">Math Mentor</h1>
        <p className="max-w-xl text-text-secondary">
          Um mentor que não entrega apenas respostas. Ele entende como você aprende.
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        {MENTOR_FEATURES.map((feature) => (
          <div key={feature.title} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-left">
            <h2 className="text-sm font-semibold text-text-primary">{feature.title}</h2>
            <p className="text-sm text-text-secondary">{feature.description}</p>
          </div>
        ))}
      </div>

      <div className="w-full max-w-xl rounded-lg border border-border bg-surface p-4 opacity-70">
        <label htmlFor="mentor-input-preview" className="mb-2 block text-sm text-text-secondary">
          Converse com o Math Mentor
        </label>
        <div className="flex gap-2">
          <input
            id="mentor-input-preview"
            type="text"
            disabled
            aria-disabled="true"
            placeholder="O Math Mentor está sendo construído."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-muted"
          />
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="shrink-0 rounded-md border border-border px-4 py-2 text-sm text-text-muted"
          >
            Enviar
          </button>
        </div>
        <p className="mt-2 text-xs text-text-muted">O Math Mentor está sendo construído — ainda não é possível conversar com ele.</p>
      </div>
    </PageShell>
  );
}
