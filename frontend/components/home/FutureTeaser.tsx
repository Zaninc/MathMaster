import { Badge } from "@/components/shared/Badge";
import { ButtonLink } from "@/components/shared/Button";

export function FutureTeaser() {
  return (
    <section className="py-16">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 text-center sm:px-6 lg:px-8">
        <Badge variant="dev" />
        <h2 className="text-xl font-semibold text-text-primary">Math Mentor</h2>
        <p className="max-w-xl text-text-secondary">
          Em breve, um mentor que entende o que você sabe, onde você erra e como pode evoluir.
        </p>
        <ButtonLink href="/ia" variant="secondary">
          Conhecer o Math Mentor
        </ButtonLink>
      </div>
    </section>
  );
}
