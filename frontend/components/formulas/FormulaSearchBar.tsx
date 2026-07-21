interface FormulaSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

/** Busca em tempo real (sem debounce — filtro local sobre <60 fórmulas, custo desprezível). */
export function FormulaSearchBar({ value, onChange }: FormulaSearchBarProps) {
  return (
    <input
      type="search"
      role="searchbox"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Pesquisar fórmula..."
      aria-label="Pesquisar fórmula"
      className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:max-w-sm"
    />
  );
}
