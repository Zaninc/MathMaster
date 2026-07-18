import type { MathNode } from "mathjs";

/**
 * Camada de apresentação LaTeX da Calculadora — converte as strings que o
 * backend devolve (já formatadas em Unicode pelo `app/formatter/`) para
 * LaTeX consumível pelo `MathFormula` (KaTeX).
 *
 * Fronteira arquitetural (decisão da Sprint KaTeX Fase 2):
 *
 * - O PARSING real é do mathjs (`parse()` + `toTex()`), a mesma dependência
 *   já isolada em chunk próprio pelos Gráficos (`plot-evaluator.ts`) —
 *   nunca um parser artesanal neste arquivo.
 * - A transliteração de glifos (² -> ^2, √( -> sqrt(, π -> pi...) é o
 *   inverso LÉXICO do contrato de apresentação do backend
 *   (`formatter/unicode_math.py`): substituição 1:1 de símbolos sem
 *   segundo significado possível, não interpretação.
 * - A estrutura do resultado (rótulos "Label: valor; ...", listas de
 *   soluções, " ou ", ", k ∈ ℤ", intervalos/tuplas, "∪") é classificada
 *   ANTES de converter — mesma filosofia classify-first do formatter do
 *   backend. Nenhuma forma fora do catálogo é "adivinhada".
 * - FAIL-CLOSED em todos os níveis: qualquer coisa não reconhecida com
 *   fidelidade total devolve `null` e o chamador mantém o texto puro de
 *   hoje. Este módulo nunca lança e nunca decide semântica — o texto
 *   enviado ao backend permanece intocado; aqui é só decoração visual.
 *
 * Consumidores atuais: `ResultPanel` (Calculadora). Futuros: histórico,
 * preview em tempo real, editor híbrido — todos devem passar por aqui em
 * vez de gerar LaTeX próprio.
 */

export interface ResultSegment {
  /** Rótulo do backend ("Derivada", "Centro"...) ou null para resultado puro. */
  label: string | null;
  /** Texto original do segmento — fallback de exibição e fonte para "Copiar". */
  text: string;
  /** LaTeX do valor, ou null se o segmento não foi reconhecido (exibir texto). */
  latex: string | null;
}

type Mathjs = typeof import("mathjs");

let mathjsPromise: Promise<Mathjs> | null = null;

/** Mesmo padrão dos Gráficos: mathjs só entra no bundle de quem converte. */
function loadMathjs(): Promise<Mathjs> {
  mathjsPromise ??= import("mathjs");
  return mathjsPromise;
}

const SUPERSCRIPT_TO_ASCII: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-",
  // Marcador do template xⁿ do teclado (expoente simbólico n) —
  // `backend-normalize.ts` o traduz para "**n" no envio.
  "ⁿ": "n",
};
const SUBSCRIPT_TO_ASCII: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
  "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9", "₋": "-",
};

const SUPERSCRIPT_RUN = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻ⁿ]+/g;
/** Sentinela interna: fora do SAFE_CHARSET por construção, derruba a conversão. */
const INVALID = "\u0000";

/** Conjuntos numéricos que o backend emite como glifo único em valores rotulados. */
const SET_GLYPH_LATEX: Record<string, string> = {
  "ℝ": "\\mathbb{R}",
  "ℤ": "\\mathbb{Z}",
  "ℕ": "\\mathbb{N}",
  "ℚ": "\\mathbb{Q}",
  "ℂ": "\\mathbb{C}",
};

/**
 * Vocabulário do produto que o toTex default do mathjs erra ou não conhece:
 * `log` no MathMaster é base 10 (o mathjs renderizaria `\ln`!), `ln` é o
 * natural, e `sen`/`tg` são a notação pt-BR legítima — preservada com
 * `\operatorname`, nunca "traduzida" para `\sin`/`\tan` (o echo deve
 * mostrar o que o usuário escreveu).
 */
const FUNCTION_LATEX: Record<string, string> = {
  log: "\\log",
  ln: "\\ln",
  sen: "\\operatorname{sen}",
  tg: "\\operatorname{tg}",
};

/** Só o alfabeto que o mathjs entende sobra depois da transliteração. */
const SAFE_CHARSET = /^[0-9A-Za-z_+\-*/^.,()[\]<>=!\s]*$/;

/** Palavra pura ("crescente", "vertical") nunca é fórmula — fica texto. */
const BARE_WORD = /^[A-Za-z]{3,}$/;

const SUBSCRIPT_VARIABLE = /^([A-Za-z])([₀₁₂₃₄₅₆₇₈₉]+)$/;

function translateRun(run: string, table: Record<string, string>): string | null {
  // "ⁿ" só é válido sozinho (é o marcador do template xⁿ, não um dígito
  // combinável) — "²ⁿ" não é template oficial e fica intocado/fail-closed.
  if (run.includes("ⁿ") && run !== "ⁿ") return null;
  const digits = Array.from(run, (ch) => table[ch] ?? INVALID).join("");
  if (digits.includes(INVALID) || digits === "-" || digits.lastIndexOf("-") > 0) return null;
  return digits;
}

/**
 * Unicode de apresentação -> sintaxe mathjs. Inverso 1:1 do contrato do
 * formatter do backend; nada aqui interpreta estrutura.
 */
function transliterate(text: string): string | null {
  let out = text
    // Template visual oficial do teclado ("eˣ(" é token único; ˣ não é
    // digitável) — mesma tradução que `backend-normalize.ts` faz no envio.
    .replace(/eˣ\(/g, "exp(")
    .replace(/\*\*/g, "^")
    .replace(/π/g, "pi")
    .replace(/∞/g, "Infinity")
    .replace(/\boo\b/g, "Infinity")
    .replace(/−/g, "-")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/≠/g, "!=");

  out = out
    .replace(/√\s*\(/g, "sqrt(")
    .replace(/√\s*([A-Za-z0-9.]+)/g, "sqrt($1)")
    .replace(/∛\s*\(/g, "cbrt(")
    .replace(/∛\s*([A-Za-z0-9.]+)/g, "cbrt($1)");

  out = out.replace(SUPERSCRIPT_RUN, (run, offset: number, whole: string) => {
    const previous = offset > 0 ? whole[offset - 1] : "";
    if (!/[A-Za-z0-9)]/.test(previous)) return INVALID;
    const exponent = translateRun(run, SUPERSCRIPT_TO_ASCII);
    // Sem parênteses: "^(2)" viraria um ParenthesisNode e o toTex mostraria
    // "{x}^{\left(2\right)}" — parênteses visíveis dentro do expoente.
    return exponent === null ? INVALID : `^${exponent}`;
  });

  if (out.includes(INVALID) || !SAFE_CHARSET.test(out)) return null;
  return out;
}

interface TexOptions {
  handler: (node: MathNode, options: TexOptions) => string | undefined;
}

function texOf(node: MathNode, options: TexOptions): string {
  return (node as unknown as { toTex(options: TexOptions): string }).toTex(options);
}

function functionName(node: MathNode): string | null {
  return (node as unknown as { fn?: { name?: string } }).fn?.name ?? null;
}

function args(node: MathNode): MathNode[] {
  return (node as unknown as { args: MathNode[] }).args;
}

/**
 * Handler passado ao `toTex` do mathjs — cobre só o vocabulário do produto
 * e os wrappers de cálculo; todo o resto (frações, raízes, potências,
 * trigonometria canônica) fica com o serializer default do mathjs.
 */
function productHandler(node: MathNode, options: TexOptions): string | undefined {
  if (node.type === "SymbolNode") {
    return (node as unknown as { name?: string }).name === "Infinity" ? "\\infty" : undefined;
  }
  if (node.type !== "FunctionNode") return undefined;
  const name = functionName(node);
  const nodeArgs = args(node);

  // Chamada sem argumentos ("sqrt()", "log()") = template incompleto em
  // digitação. O toTex default do mathjs renderizaria o NOME INTERNO
  // pós-transliteração ("\mathrm{sqrt}()" para um input "√()"), expondo
  // uma string diferente da digitada — contra o contrato input==preview.
  // Lançar derruba a conversão inteira -> fallback com o texto atual.
  if (nodeArgs.length === 0) {
    throw new Error("chamada de função sem argumentos — entrada incompleta");
  }

  if (name !== null && name in FUNCTION_LATEX) {
    const rendered = nodeArgs.map((arg) => texOf(arg, options)).join(",\\,");
    return `${FUNCTION_LATEX[name]}\\left(${rendered}\\right)`;
  }

  // exp() renderiza como "e elevado" — a linguagem visual do produto
  // (tecla eˣ), tanto para o template eˣ( quanto para exp( digitado/vindo
  // do histórico.
  if (name === "exp" && nodeArgs.length === 1) {
    return `e^{${texOf(nodeArgs[0], options)}}`;
  }

  if ((name === "Integral" || name === "integral") && nodeArgs.length >= 2) {
    const body = texOf(nodeArgs[0], options);
    const variable = texOf(nodeArgs[1], options);
    if (nodeArgs.length === 4) {
      const lower = texOf(nodeArgs[2], options);
      const upper = texOf(nodeArgs[3], options);
      return `\\int_{${lower}}^{${upper}} ${body}\\,d${variable}`;
    }
    if (nodeArgs.length === 2) return `\\int ${body}\\,d${variable}`;
  }

  if ((name === "Derivative" || name === "derivada") && nodeArgs.length === 2) {
    const body = texOf(nodeArgs[0], options);
    const variable = texOf(nodeArgs[1], options);
    return `\\frac{d}{d${variable}}\\left(${body}\\right)`;
  }

  if ((name === "Limit" || name === "limite") && nodeArgs.length === 3) {
    const body = texOf(nodeArgs[0], options);
    const variable = texOf(nodeArgs[1], options);
    const point = texOf(nodeArgs[2], options);
    return `\\lim_{${variable} \\to ${point}} ${body}`;
  }

  return undefined;
}

/** Converte UMA expressão (sem "="). Null = forma não reconhecida. */
async function singleExpressionToLatex(text: string): Promise<string | null> {
  const trimmed = text.trim();
  if (trimmed === "" || BARE_WORD.test(trimmed)) return null;

  const subscripted = trimmed.match(SUBSCRIPT_VARIABLE);
  if (subscripted) {
    const digits = translateRun(subscripted[2], SUBSCRIPT_TO_ASCII);
    return digits === null ? null : `${subscripted[1]}_{${digits}}`;
  }

  const source = transliterate(trimmed);
  if (source === null) return null;

  try {
    const { parse } = await loadMathjs();
    return parse(source).toTex({ handler: productHandler } as object);
  } catch {
    return null;
  }
}

/** Divide `text` pelo separador considerando só ocorrências fora de ()/[]. */
function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(" || ch === "[") depth += 1;
    else if (ch === ")" || ch === "]") depth -= 1;
    else if (depth === 0 && text.startsWith(separator, i)) {
      parts.push(text.slice(start, i));
      start = i + separator.length;
      i = start - 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

const EQUATION_SPLIT = /(?<![<>!=])=(?!=)/;

/**
 * Expressão ou equação/lista de igualdades ("x = 2", "f(2) = 10",
 * "x₁ = -2"). Cada lado é convertido separadamente — "=" nunca chega ao
 * mathjs (lá seria atribuição, com outro significado).
 */
export async function expressionToLatex(text: string): Promise<string | null> {
  const pieces = text
    .trim()
    .split(EQUATION_SPLIT)
    .map((side) => side.trim());
  if (pieces.some((piece) => piece === "")) return null;

  const rendered: string[] = [];
  for (const piece of pieces) {
    const latex = await singleExpressionToLatex(piece);
    if (latex === null) return null;
    rendered.push(latex);
  }
  return rendered.join(" = ");
}

/** "(a, b)" / "[a, b)" — tupla ou intervalo (mesma renderização visual). */
async function pairToLatex(text: string): Promise<string | null> {
  const match = text.trim().match(/^([([])\s*(.*)\s*([)\]])$/);
  if (!match) return null;
  const inner = splitTopLevel(match[2], ",");
  if (inner.length !== 2) return null;

  const left = await singleExpressionToLatex(inner[0]);
  const right = await singleExpressionToLatex(inner[1]);
  if (left === null || right === null) return null;

  const open = match[1] === "[" ? "\\left[" : "\\left(";
  const close = match[3] === "]" ? "\\right]" : "\\right)";
  return `${open} ${left},\\; ${right} ${close}`;
}

const PERIODIC_SUFFIX = /^(.*),\s*([a-z])\s*∈\s*ℤ$/;

/**
 * Valor matemático em qualquer forma do catálogo do backend, da mais
 * estruturada para a mais simples (classify-first, primeira que casar):
 * " ou " -> ", k ∈ ℤ" -> "∪" -> " e " -> lista de igualdades -> tupla/
 * intervalo -> expressão/equação.
 */
export async function valueToLatex(text: string): Promise<string | null> {
  const trimmed = text.trim();
  if (trimmed in SET_GLYPH_LATEX) return SET_GLYPH_LATEX[trimmed];

  const alternatives = splitTopLevel(trimmed, " ou ");
  if (alternatives.length > 1) {
    return joinConverted(alternatives, "\\;\\text{ou}\\;");
  }

  const periodic = trimmed.match(PERIODIC_SUFFIX);
  if (periodic) {
    const head = await valueToLatex(periodic[1]);
    return head === null ? null : `${head},\\; ${periodic[2]} \\in \\mathbb{Z}`;
  }

  const unionParts = splitTopLevel(trimmed, " ∪ ");
  if (unionParts.length > 1) {
    return joinConverted(unionParts, " \\cup ", pairToLatex);
  }

  const conjunctionParts = splitTopLevel(trimmed, " e ");
  if (conjunctionParts.length > 1) {
    return joinConverted(conjunctionParts, "\\;\\text{e}\\;");
  }

  const listParts = splitTopLevel(trimmed, ",");
  if (listParts.length > 1 && listParts.every((part) => EQUATION_SPLIT.test(part))) {
    return joinConverted(listParts, ",\\; ", expressionToLatex);
  }

  return (await pairToLatex(trimmed)) ?? (await expressionToLatex(trimmed));
}

async function joinConverted(
  parts: string[],
  glue: string,
  convert: (part: string) => Promise<string | null> = valueToLatex
): Promise<string | null> {
  const rendered: string[] = [];
  for (const part of parts) {
    const latex = await convert(part.trim());
    if (latex === null) return null;
    rendered.push(latex);
  }
  return rendered.join(glue);
}

const LABELED_PIECE = /^([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9 ]*):\s+(.*)$/;

/**
 * Resultado completo do backend -> segmentos para exibição. Null = nenhuma
 * parte foi convertida (chamador mantém o texto puro atual). Segmentos
 * individuais não reconhecidos ficam com `latex: null` (exibidos como
 * texto), preservando rótulos como "Monotonicidade: crescente" intactos.
 */
export async function resultToLatex(result: string): Promise<ResultSegment[] | null> {
  const trimmed = result.trim();
  if (trimmed === "") return null;

  const pieces = trimmed.includes("; ") ? trimmed.split("; ") : [trimmed];
  const labeledPieces = pieces.map((piece) => piece.match(LABELED_PIECE));

  let segments: ResultSegment[];
  if (labeledPieces.every((match) => match !== null)) {
    segments = await Promise.all(
      labeledPieces.map(async (match) => ({
        label: match![1],
        text: match![2],
        latex: await valueToLatex(match![2]),
      }))
    );
  } else if (pieces.length === 1) {
    segments = [{ label: null, text: trimmed, latex: await valueToLatex(trimmed) }];
  } else {
    return null;
  }

  return segments.some((segment) => segment.latex !== null) ? segments : null;
}

function findMatchingParen(text: string, openIndex: number): number | null {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return null;
}

/** Remove UM par de parênteses externo que envolva o texto inteiro. */
function stripOuterParens(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("(")) return trimmed;
  return findMatchingParen(trimmed, 0) === trimmed.length - 1 ? trimmed.slice(1, -1) : trimmed;
}

const DERIVATIVE_INPUT = /^d\/d([a-zA-Z])\s*\(/;
const INTEGRAL_ASCII_BOUNDS = /^∫\s*_([^\s^]+)\^(\S+)\s+(.+?)\s*d([a-zA-Z])$/;
const INTEGRAL_UNICODE_BOUNDS = /^∫\s*([₀₁₂₃₄₅₆₇₈₉₋]+)([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)\s*(.+?)\s*d([a-zA-Z])$/;
const INTEGRAL_INDEFINITE = /^∫\s*(.+?)\s*d([a-zA-Z])$/;
// "->" além de "→": o backend aceita as duas setas (`_VAR_ARROW` em
// natural_notation.py) — o catálogo daqui espelha o reconhecimento de lá.
const LIMIT_INPUT = /^lim\s*(?:_\{|\(|_)?\s*([a-zA-Z])\s*(?:->|→)\s*([^)}\s]+)\s*(?:\}|\))?\s*(.+)$/;

async function boundsToLatex(raw: string, table: Record<string, string> | null): Promise<string | null> {
  const ascii = table === null ? raw : translateRun(raw, table);
  return ascii === null ? null : singleExpressionToLatex(ascii);
}

/**
 * Echo da expressão digitada — reconhece as três notações naturais de
 * cálculo do produto (as MESMAS formas fixas de `natural_notation.py` do
 * backend, aqui só para exibição: a semântica continua 100% no backend)
 * e cai para expressão comum. Null = exibir o texto digitado como está.
 */
export async function inputToLatex(text: string): Promise<string | null> {
  const trimmed = text.trim();

  const derivative = trimmed.match(DERIVATIVE_INPUT);
  if (derivative) {
    const openIndex = trimmed.indexOf("(", 4);
    if (findMatchingParen(trimmed, openIndex) !== trimmed.length - 1) return null;
    const body = await expressionToLatex(trimmed.slice(openIndex + 1, -1));
    return body === null ? null : `\\frac{d}{d${derivative[1]}}\\left(${body}\\right)`;
  }

  const integralBounded =
    trimmed.match(INTEGRAL_ASCII_BOUNDS) ?? trimmed.match(INTEGRAL_UNICODE_BOUNDS);
  if (integralBounded) {
    const isUnicode = INTEGRAL_UNICODE_BOUNDS.test(trimmed);
    const lower = await boundsToLatex(integralBounded[1], isUnicode ? SUBSCRIPT_TO_ASCII : null);
    const upper = await boundsToLatex(integralBounded[2], isUnicode ? SUPERSCRIPT_TO_ASCII : null);
    const body = await expressionToLatex(stripOuterParens(integralBounded[3]));
    if (lower === null || upper === null || body === null) return null;
    return `\\int_{${lower}}^{${upper}} ${body}\\,d${integralBounded[4]}`;
  }

  const integral = trimmed.match(INTEGRAL_INDEFINITE);
  if (integral) {
    const body = await expressionToLatex(stripOuterParens(integral[1]));
    return body === null ? null : `\\int ${body}\\,d${integral[2]}`;
  }

  const limit = trimmed.match(LIMIT_INPUT);
  if (limit) {
    const point = await singleExpressionToLatex(limit[2]);
    const body = await expressionToLatex(limit[3]);
    if (point === null || body === null) return null;
    return `\\lim_{${limit[1]} \\to ${point}} ${body}`;
  }

  return expressionToLatex(trimmed);
}
