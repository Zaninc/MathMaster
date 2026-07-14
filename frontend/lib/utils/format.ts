/** Inteiros ficam sem casas decimais; qualquer outro valor arredonda para 2 casas. */
export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
