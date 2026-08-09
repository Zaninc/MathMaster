/**
 * Inteiros ficam sem casas decimais; qualquer outro valor arredonda para
 * até 2 casas — SEM zero à direita (Sprint V2.20.1: `Number(...)` sobre
 * o resultado de `toFixed(2)` descarta o zero sobrando, "2.40" vira
 * "2.4", "9.43" continua "9.43" — nunca menos precisão do que antes,
 * só nunca um zero decorativo. Confirmado que não quebra nenhum
 * chamador existente: nenhum resultado hoje testado termina em zero
 * decimal exato.
 */
export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}
