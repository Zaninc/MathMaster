import { ALLOWED_VARIABLE } from "./plot-evaluator";

/**
 * Normalização de entrada natural para a sintaxe que o avaliador de
 * plotagem (`plot-evaluator.ts`, whitelist mathjs) já entende — a
 * própria lógica de plotagem NUNCA é tocada, isto é uma camada aplicada
 * ANTES dela (mesmo padrão de fronteira de `backend-normalize.ts`: o
 * chamador normaliza, o avaliado/parser não sabe que a entrada mudou).
 *
 * O escopo aqui é deliberadamente pequeno: testado empiricamente contra
 * o mathjs real antes de escrever qualquer regex — `2x`, `2(x+1)` e
 * `(x+1)(x-1)` já são multiplicação implícita NATIVA do parser dele, não
 * precisam de normalização nenhuma. Só três formas realmente exigem
 * reescrita:
 *
 * 1. Superescritos Unicode (`x²`) — o mathjs não os reconhece, dá erro
 *    de sintaxe puro.
 * 2. `sen`/`tg` (PT-BR) e `ln` — o mathjs os trata como FunctionNode de
 *    nome desconhecido; a whitelist de `plot-evaluator.ts` rejeitaria com
 *    "Função não permitida: sen"/"ln". `ln` vira `log` porque o `log`
 *    NATIVO do mathjs já É o logaritmo natural (não base 10) — mapear
 *    `ln` pra ele é uma tradução literal, não uma reinterpretação.
 * 3. A variável `x` (a ÚNICA livre permitida) imediatamente seguida de
 *    `(` (`x(x+1)`) — o mathjs interpreta isso como CHAMADA de função
 *    "x", não multiplicação (ambíguo por construção da linguagem dele).
 *    `(x+1)(x-1)` não cai aqui porque a adjacência é `)(`, que o mathjs
 *    já resolve como multiplicação nativamente.
 *
 *    Deliberadamente restrito a `x` (não "qualquer identificador
 *    desconhecido seguido de parêntese"): uma regra mais ampla mudaria
 *    o comportamento de tentativas de DEFINIÇÃO de função como
 *    `f(x) = x^2` (hoje corretamente rejeitada pela whitelist com uma
 *    mensagem clara) — reescrever "f(" para "f*(" trocaria essa rejeição
 *    por um erro de sintaxe genérico, uma regressão real que só apareceu
 *    ao testar contra o teste existente dessa rejeição.
 */

const FUNCTION_NAME_TRANSLATIONS: Record<string, string> = {
  sen: "sin",
  tg: "tan",
  ln: "log",
};

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
};

const FUNCTION_NAME_PATTERN = /\b(sen|tg|ln)\(/g;
const SUPERSCRIPT_RUN = /[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g;
const VARIABLE_BEFORE_PAREN = new RegExp(`\\b${ALLOWED_VARIABLE}\\(`, "g");

function translateFunctionNames(expression: string): string {
  return expression.replace(FUNCTION_NAME_PATTERN, (_match, name: string) => `${FUNCTION_NAME_TRANSLATIONS[name]}(`);
}

function translateSuperscripts(expression: string): string {
  return expression.replace(
    SUPERSCRIPT_RUN,
    (run) => `^${Array.from(run, (digit) => SUPERSCRIPT_DIGITS[digit]).join("")}`
  );
}

/**
 * Só reescreve a variável `x` seguida de `(` — nunca outro identificador
 * desconhecido (ver nota da fronteira acima sobre `f(x) = x^2`). `\b`
 * evita casar o "x" dentro de um identificador maior (ex. "max(").
 */
function insertMultiplicationBeforeParen(expression: string): string {
  return expression.replace(VARIABLE_BEFORE_PAREN, `${ALLOWED_VARIABLE}*(`);
}

/**
 * Converte entrada natural (`x²`, `sen(x)`, `x(x+1)`) para a sintaxe
 * técnica que `compilePlotFunction` já aceita. Idempotente: aplicar em
 * cima de sintaxe já técnica (`x^2 - 4`, `sin(x)`) não muda nada — é
 * seguro chamar sempre, sem checar antes se a entrada "precisa".
 */
export function normalizeForPlot(expression: string): string {
  let normalized = expression.trim();
  normalized = translateFunctionNames(normalized);
  normalized = translateSuperscripts(normalized);
  normalized = insertMultiplicationBeforeParen(normalized);
  return normalized;
}

type Mathjs = typeof import("mathjs");
let mathjsPromise: Promise<Mathjs> | null = null;

/** Mesmo padrão de `plot-evaluator.ts`/`to-latex.ts`: mathjs só entra no bundle de quem converte. */
function loadMathjs(): Promise<Mathjs> {
  mathjsPromise ??= import("mathjs");
  return mathjsPromise;
}

/**
 * LaTeX de uma expressão de plotagem, para exibição na lista (nunca para
 * execução — a validação de segurança continua 100% em
 * `compilePlotFunction`/`assertSafeNode`; isto é só decoração visual, o
 * mesmo espírito fail-closed de `lib/math/to-latex.ts`). `null` = mantém
 * o texto puro digitado.
 */
export async function plotExpressionToLatex(expression: string): Promise<string | null> {
  const trimmed = expression.trim();
  if (trimmed === "") return null;
  try {
    const { parse } = await loadMathjs();
    return parse(normalizeForPlot(trimmed)).toTex();
  } catch {
    return null;
  }
}
