"use client";

import { useState } from "react";

import { FORMULA_CATEGORY_LABELS, FORMULAS, type FormulaCategoryId } from "@/data/formulas";
import { cn } from "@/lib/utils/cn";

import { FormulaCategory } from "./FormulaCategory";

const ALL_FILTER = "todas" as const;
type CategoryFilter = FormulaCategoryId | typeof ALL_FILTER;

/**
 * Biblioteca de Fórmulas — Etapa 3: filtro por categoria client-side
 * (sem parâmetro de URL, de propósito — decisão da sprint). "use client"
 * só por causa do useState do filtro; os dados/cálculo continuam vindo
 * de FORMULAS, nada duplicado aqui. Ordem das categorias = ordem de 1ª
 * aparição em FORMULAS (mesma regra da Etapa 1/2), tanto nos botões
 * quanto no conteúdo filtrado.
 */
export function FormulasReference() {
  const categories = Array.from(new Set(FORMULAS.map((formula) => formula.category)));
  const [filter, setFilter] = useState<CategoryFilter>(ALL_FILTER);

  const visibleCategories = filter === ALL_FILTER ? categories : categories.filter((category) => category === filter);

  return (
    <div className="flex flex-col gap-8">
      <div role="group" aria-label="Filtro de categoria" className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter(ALL_FILTER)}
          aria-pressed={filter === ALL_FILTER}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-(--motion-fast)",
            filter === ALL_FILTER
              ? "border-accent bg-accent/10 text-text-primary"
              : "border-border text-text-secondary hover:text-text-primary"
          )}
        >
          Todas
        </button>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setFilter(category)}
            aria-pressed={filter === category}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-(--motion-fast)",
              filter === category
                ? "border-accent bg-accent/10 text-text-primary"
                : "border-border text-text-secondary hover:text-text-primary"
            )}
          >
            {FORMULA_CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-10">
        {visibleCategories.map((category) => (
          <FormulaCategory
            key={category}
            label={FORMULA_CATEGORY_LABELS[category]}
            formulas={FORMULAS.filter((formula) => formula.category === category)}
          />
        ))}
      </div>
    </div>
  );
}
