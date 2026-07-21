import { FORMULA_CATEGORY_LABELS, FORMULAS, type FormulaEntry } from "@/data/formulas";

/** Remove acentos e normaliza caixa — "Pitágoras"/"pitagoras" e "Cálculo"/"calculo" casam igual. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * O catálogo usa LaTeX (`\sin`, `\Delta`, `\int`...), mas o usuário digita em
 * português ou símbolo solto ("sen", "delta", "Δ"). Cada padrão cujo comando
 * aparece no LaTeX da fórmula contribui os tokens equivalentes ao índice de
 * busca — sem precisar de um campo `keywords` mantido à mão por fórmula.
 */
const SYMBOL_ALIASES: Array<{ pattern: RegExp; tokens: string }> = [
  { pattern: /\\Delta/, tokens: "delta discriminante Δ" },
  { pattern: /\\int/, tokens: "integral ∫" },
  { pattern: /\\sin/, tokens: "seno sen sin" },
  { pattern: /\\cos/, tokens: "cosseno cos" },
  { pattern: /\\tan/, tokens: "tangente tan" },
  { pattern: /\\sec/, tokens: "secante sec" },
  { pattern: /\\ln/, tokens: "logaritmo natural ln log" },
  { pattern: /\\lim/, tokens: "limite lim" },
  { pattern: /\\sqrt/, tokens: "raiz quadrada sqrt" },
  { pattern: /\\pi/, tokens: "pi π" },
  { pattern: /\\frac\{d\}/, tokens: "derivada" },
];

function buildIndex(formula: FormulaEntry): string {
  const symbolTokens = SYMBOL_ALIASES.filter(({ pattern }) => pattern.test(formula.latex))
    .map(({ tokens }) => tokens)
    .join(" ");
  return normalize(
    [formula.title, FORMULA_CATEGORY_LABELS[formula.category], formula.latex, symbolTokens].join(" ")
  );
}

const SEARCH_INDEX = new Map(FORMULAS.map((formula) => [formula.id, buildIndex(formula)]));

/** `query` vazia (ou só espaços) sempre casa — é o estado "sem busca ativa". */
export function matchesQuery(formula: FormulaEntry, query: string): boolean {
  const normalizedQuery = normalize(query.trim());
  if (normalizedQuery === "") return true;
  return (SEARCH_INDEX.get(formula.id) ?? "").includes(normalizedQuery);
}
