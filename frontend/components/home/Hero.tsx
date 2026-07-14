import { ButtonLink } from "@/components/shared/Button";

import { HeroBackground } from "./HeroBackground";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <HeroBackground />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">MathMaster</h1>
        <p className="text-lg font-medium text-accent sm:text-xl">Ensinar. Acompanhar. Motivar.</p>
        <p className="max-w-xl text-text-secondary">
          Mais do que resolver exercícios, ajudamos você a entender, evoluir e confiar no seu potencial.
        </p>
        <p className="max-w-xl text-sm text-text-muted">
          Entenda cada passo, pratique no seu ritmo, visualize conceitos e acompanhe sua evolução — tudo em
          um único lugar.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/calculadora" variant="primary">
            Começar a calcular
          </ButtonLink>
          <ButtonLink href="#pilares" variant="secondary">
            Explorar o MathMaster
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
