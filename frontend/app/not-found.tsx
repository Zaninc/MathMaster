import { PageShell } from "@/components/layout/PageShell";
import { ButtonLink } from "@/components/shared/Button";

export default function NotFound() {
  return (
    <PageShell className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-sm font-medium text-text-muted">Erro 404</p>
      <h1 className="text-2xl font-semibold text-text-primary">Essa página não existe.</h1>
      <p className="max-w-md text-text-secondary">
        Confira o endereço ou volte para a Calculadora para resolver alguma coisa.
      </p>
      <ButtonLink href="/" variant="primary">
        Voltar para o início
      </ButtonLink>
    </PageShell>
  );
}
