import { FORMULAS } from "@/data/tools";

export function FormulasReference() {
  const categories = Array.from(new Set(FORMULAS.map((formula) => formula.category)));

  return (
    <section id="formulas" className="flex flex-col gap-4 scroll-mt-20">
      <h2 className="text-lg font-semibold text-text-primary">Fórmulas</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {categories.map((category) => (
          <div key={category} className="rounded-lg border border-border bg-surface p-4">
            <h3 className="mb-2 text-sm font-semibold text-text-secondary">{category}</h3>
            <dl className="flex flex-col gap-2">
              {FORMULAS.filter((formula) => formula.category === category).map((formula) => (
                <div key={formula.name}>
                  <dt className="text-xs text-text-muted">{formula.name}</dt>
                  <dd className="font-mono text-sm text-text-primary">{formula.formula}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
