/**
 * Fronteira ÚNICA de normalização antes do envio ao backend (`apiClient.
 * solve()`): traduz os templates visuais do teclado matemático que o
 * backend NÃO aceita para a sintaxe canônica que ele aceita. Nunca altera
 * o valor visível no input — só o payload.
 *
 * Escopo deliberadamente mínimo (validado contra o backend real em
 * 2026-07-18) — só os templates oficiais do teclado que o parser do
 * backend rejeita:
 *
 * - `eˣ(` -> `exp(`   (o backend rejeita "eˣ(2)"; "exp(2)" avalia)
 * - `ⁿ`   -> `**n`    (o backend rejeita "(2)ⁿ"; "(2)**n" avalia — o
 *                      expoente é o símbolo n, exatamente o que o rótulo
 *                      xⁿ promete; expoentes numéricos usam ²/³, nativos)
 *
 * √()/∛()/²/³/π/∞ etc. ficam INTOCADOS de propósito: o Sprint Parser do
 * backend já os aceita nativamente (`√(9)`->3, `∛(8)`->2, `(2)³`->8) —
 * reescrevê-los aqui duplicaria o parser dele, contra a fronteira
 * documentada em `frontend/README.md`. Os caracteres ˣ (U+02E3) e
 * ⁿ (U+207F) não são digitáveis em teclado físico — só entram pelos
 * botões do teclado matemático, então as substituições são inequívocas.
 *
 * Idempotente: a saída não contém ˣ nem ⁿ.
 */
export function normalizeForBackend(expression: string): string {
  return expression.replace(/eˣ\(/g, "exp(").replace(/ⁿ/g, "**n");
}
