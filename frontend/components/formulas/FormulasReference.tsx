"use client";

import { useState } from "react";

import { useFavoriteFormulas } from "@/hooks/useFavoriteFormulas";
import { FORMULA_CATEGORY_LABELS, FORMULAS, type FormulaCategoryId } from "@/data/formulas";
import { matchesQuery } from "@/lib/formulas/search";
import { cn } from "@/lib/utils/cn";

import { FormulaCategory } from "./FormulaCategory";
import { FormulaSearchBar } from "./FormulaSearchBar";

const ALL_FILTER = "todas" as const;
const FAVORITES_FILTER = "favoritas" as const;
type Filter = FormulaCategoryId | typeof ALL_FILTER | typeof FAVORITES_FILTER;

/**
 * Biblioteca de Fórmulas: busca em tempo real (nome, categoria, palavras-
 * chave e símbolos via `matchesQuery`) + filtro por categoria ou por
 * favoritos, todos client-side (sem parâmetro de URL, de propósito —
 * decisão de sprints anteriores, mantida aqui). Favoritos vêm de
 * `useFavoriteFormulas` (persistidos em localStorage). Ordem das
 * categorias = ordem de 1ª aparição em FORMULAS; com busca/filtro ativos,
 * uma categoria só aparece se sobrar pelo menos 1 fórmula visível nela —
 * evita cabeçalho de seção vazio.
 */
export function FormulasReference() {
  const categories = Array.from(new Set(FORMULAS.map((formula) => formula.category)));
  const [filter, setFilter] = useState<Filter>(ALL_FILTER);
  const [query, setQuery] = useState("");
  const { isFavorite, toggleFavorite } = useFavoriteFormulas();

  const favoriteCount = FORMULAS.filter((formula) => isFavorite(formula.id)).length;

  const visibleFormulas = FORMULAS.filter((formula) => {
    if (!matchesQuery(formula, query)) return false;
    if (filter === ALL_FILTER) return true;
    if (filter === FAVORITES_FILTER) return isFavorite(formula.id);
    return formula.category === filter;
  });

  const visibleCategories = categories.filter((category) =>
    visibleFormulas.some((formula) => formula.category === category)
  );

  return (
    <div className="flex flex-col gap-8">
      <FormulaSearchBar value={query} onChange={setQuery} />

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
        <button
          type="button"
          onClick={() => setFilter(FAVORITES_FILTER)}
          aria-pressed={filter === FAVORITES_FILTER}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-(--motion-fast)",
            filter === FAVORITES_FILTER
              ? "border-accent bg-accent/10 text-text-primary"
              : "border-border text-text-secondary hover:text-text-primary"
          )}
        >
          ⭐ Favoritas ({favoriteCount})
        </button>
      </div>

      {visibleCategories.length === 0 ? (
        <p className="text-sm text-text-secondary">Nenhuma fórmula encontrada.</p>
      ) : (
        <div className="flex flex-col gap-10">
          {visibleCategories.map((category) => (
            <FormulaCategory
              key={category}
              label={FORMULA_CATEGORY_LABELS[category]}
              formulas={visibleFormulas.filter((formula) => formula.category === category)}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
}
