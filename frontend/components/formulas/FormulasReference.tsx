import { FORMULAS } from "@/data/formulas";

/**
 * Grade de fórmulas agrupadas por categoria. Puro e sem estado — o
 * título/descrição da página ficam em app/formulas/page.tsx (Etapa 1 da
 * separação da Biblioteca de Fórmulas); este componente só existe pra
 * crescer nas próximas etapas (KaTeX, filtros, busca) sem levar
 * cabeçalho de página junto.
 */
export function FormulasReference() {
  const categories = Array.from(new Set(FORMULAS.map((formula) => formula.category)));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {categories.map((category) => (
        <div key={category} className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold text-text-secondary">{category}</h2>
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
  );
}
