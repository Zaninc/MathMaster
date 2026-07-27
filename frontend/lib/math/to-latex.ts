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

/**
 * Só o alfabeto que o mathjs entende sobra depois da transliteração.
 * ";" (Sprint V2.2.1) — separador de instrução de um programa de matriz
 * ("A=[[1,2],[3,4]]; det(A)"), mesmo papel de "\n" (já coberto por `\s`) —
 * o mathjs já entende os dois nativamente como fim de instrução dentro de
 * um `BlockNode`.
 */
const SAFE_CHARSET = /^[0-9A-Za-z_+\-*/^.,()[\]<>=!;\s]*$/;

// Sprint V2.2 (Motor de Matrizes) — "traço(" é o único alias PT-BR de
// matriz com caractere fora do ASCII ("ç"); os outros três
// (determinante/inversa/transposta) já são puro ASCII e não precisam
// disso. Reescrito para o nome canônico ANTES da checagem de
// `SAFE_CHARSET` (que rejeitaria "ç") — mesmo espírito de `_apply_aliases`
// em `parser/normalize.py` no backend: só na forma de chamada de função
// (nome seguido de "("), nunca substring solta.
const _TRAÇO_ALIAS_PATTERN = /\btraço\s*\(/g;

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
    .replace(/≠/g, "!=")
    .replace(_TRAÇO_ALIAS_PATTERN, "trace(");

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
 * Sprint V2.2 (Motor de Matrizes) — aliases PT-BR de função de matriz.
 * O mathjs já entende nativamente "[[1,2],[3,4]]" como matriz (ArrayNode) e
 * já sabe renderizar `det`/`inv`/`transpose`/`trace` com a notação bonita
 * própria (`\det(...)`, `^{-1}`, `^\top`, `\mathrm{tr}(...)`) — os três
 * aliases puramente ASCII (nomes que o mathjs não reconhece) precisam de um
 * caso aqui, reproduzindo BYTE A BYTE o que o serializer default já produz
 * para o nome canônico correspondente (ver `to-latex.test.ts`, que compara
 * os dois diretamente). "traço" (com "ç") não entra aqui — é reescrito
 * direto para "trace(" em `transliterate()`, porque "ç" cairia na
 * whitelist de caracteres do Tier 1 antes mesmo de chegar a este handler.
 */
const MATRIX_ALIAS_LATEX: Record<string, (arg: string) => string> = {
  determinante: (arg) => `\\det\\left(${arg}\\right)`,
  inversa: (arg) => `\\left(${arg}\\right)^{-1}`,
  transposta: (arg) => `\\left(${arg}\\right)^\\top`,
};

/**
 * Sprint V2.3 (Motor de Números Complexos) — o mathjs já reconhece
 * "conjugado"/"modulo"/"argumento"/"conj"/"abs"/"arg" nativamente como
 * chamadas de função (`FunctionNode`, sintaxe genérica de chamada), mas o
 * serializer default não conhece esses NOMES específicos e cairia no
 * `\mathrm{nome}(...)` genérico (confirmado empiricamente) — notação
 * matemática padrão própria para cada uma, mesmo padrão de
 * `MATRIX_ALIAS_LATEX` acima. "abs"/"modulo" e "conj"/"conjugado" usam a
 * MESMA função aqui (semântica idêntica, só o nome digitado muda).
 */
const COMPLEX_ALIAS_LATEX: Record<string, (arg: string) => string> = {
  conjugado: (arg) => `\\overline{${arg}}`,
  conj: (arg) => `\\overline{${arg}}`,
  modulo: (arg) => `\\left|${arg}\\right|`,
  abs: (arg) => `\\left|${arg}\\right|`,
  argumento: (arg) => `\\arg\\left(${arg}\\right)`,
  arg: (arg) => `\\arg\\left(${arg}\\right)`,
};

/**
 * Sprint V2.6 (Motor de Polinômios Avançados) — as sete operações não têm
 * notação matemática dedicada (diferente de det/inv/conjugado/etc.), só o
 * nome em português como `\operatorname` — mesmo tratamento tipográfico já
 * usado para `sen`/`tg` em `FUNCTION_LATEX`. Chaves são sempre a forma
 * ASCII (`raizes`/`divisao`, nunca `raízes`/`divisão`): as formas
 * acentuadas ficam fora de `SAFE_CHARSET` (mesmo motivo de "traço" no
 * Motor de Matrizes) e nunca chegam a este handler — o teclado sempre
 * insere a forma ASCII, e a entrada acentuada digitada manualmente ainda
 * funciona (backend aceita as duas), só cai para o fallback genérico do
 * Tier 2 em vez desta notação dedicada.
 */
const POLYNOMIAL_OPERATION_LATEX: Record<string, string> = {
  fatorar: "\\operatorname{fatorar}",
  expandir: "\\operatorname{expandir}",
  simplificar: "\\operatorname{simplificar}",
  grau: "\\operatorname{grau}",
  coeficientes: "\\operatorname{coeficientes}",
  raizes: "\\operatorname{raízes}",
  divisao: "\\operatorname{divisão}",
};

/**
 * Sprint V2.7 (Motor de Combinatória) — diferente das operações de
 * polinômio (que não têm notação dedicada), aqui cada chamada tem a
 * notação de livro didático própria: C_{n,k}, A_{n,k}, P_n, n!. A notação
 * depende da POSIÇÃO dos argumentos, então a tabela guarda funções (mesmo
 * padrão de `MATRIX_ALIAS_LATEX`/`COMPLEX_ALIAS_LATEX`), com a aridade
 * errada devolvendo `undefined` para cair no fallback genérico. Chaves são
 * sempre a forma ASCII ("combinacao", nunca "combinação") — mesmo motivo
 * documentado em `POLYNOMIAL_OPERATION_LATEX` acima; as formas acentuadas
 * têm entradas paralelas no Tier 2.
 *
 * "C"/"A"/"P" maiúsculos são as CABEÇAS que o backend devolve na dedução
 * simbólica ("C(10,3) = 10!/(3!*7!) = 120") e também aliases de entrada
 * aceitos por `combinatorics/parsing.py` — restritos a argumentos
 * numéricos (`ConstantNode`) para nunca reinterpretar um uso simbólico
 * legítimo de uma variável de matriz ("A(...)" num programa com "A=[[…]]").
 */
function factorialArgumentLatex(node: MathNode, options: TexOptions): string {
  const rendered = texOf(node, options);
  return node.type === "ConstantNode" || node.type === "SymbolNode"
    ? `${rendered}!`
    : `\\left(${rendered}\\right)!`;
}

type CombinatoricsRenderer = (
  nodeArgs: MathNode[],
  options: TexOptions
) => string | undefined;

const combinationLatex: CombinatoricsRenderer = (nodeArgs, options) =>
  nodeArgs.length === 2
    ? `C_{${texOf(nodeArgs[0], options)},${texOf(nodeArgs[1], options)}}`
    : undefined;

const arrangementLatex: CombinatoricsRenderer = (nodeArgs, options) =>
  nodeArgs.length === 2
    ? `A_{${texOf(nodeArgs[0], options)},${texOf(nodeArgs[1], options)}}`
    : undefined;

const permutationLatex: CombinatoricsRenderer = (nodeArgs, options) =>
  nodeArgs.length === 1 ? `P_{${texOf(nodeArgs[0], options)}}` : undefined;

const factorialLatex: CombinatoricsRenderer = (nodeArgs, options) =>
  nodeArgs.length === 1 ? factorialArgumentLatex(nodeArgs[0], options) : undefined;

const permutationRepetitionLatex: CombinatoricsRenderer = (nodeArgs, options) =>
  nodeArgs.length >= 2
    ? `P_{${texOf(nodeArgs[0], options)}}^{${nodeArgs
        .slice(1)
        .map((arg) => texOf(arg, options))
        .join(",")}}`
    : undefined;

const numericOnly = (renderer: CombinatoricsRenderer): CombinatoricsRenderer => {
  return (nodeArgs, options) =>
    nodeArgs.every((arg) => arg.type === "ConstantNode")
      ? renderer(nodeArgs, options)
      : undefined;
};

const COMBINATORICS_LATEX: Record<string, CombinatoricsRenderer> = {
  fatorial: factorialLatex,
  fat: factorialLatex,
  permutacao: permutationLatex,
  arranjo: arrangementLatex,
  combinacao: combinationLatex,
  permutacao_repeticao: permutationRepetitionLatex,
  C: numericOnly(combinationLatex),
  A: numericOnly(arrangementLatex),
  P: numericOnly(permutationLatex),
};

/**
 * Handler passado ao `toTex` do mathjs — cobre só o vocabulário do produto
 * e os wrappers de cálculo; todo o resto (frações, raízes, potências,
 * trigonometria canônica, matrizes) fica com o serializer default do
 * mathjs.
 */
function productHandler(node: MathNode, options: TexOptions): string | undefined {
  if (node.type === "SymbolNode") {
    return (node as unknown as { name?: string }).name === "Infinity" ? "\\infty" : undefined;
  }

  // Sprint V2.6 (Motor de Polinômios Avançados) — `coeficientes(...)`
  // devolve uma lista achatada ("[1, 2, 0, -5]"), sintaxe de array válida
  // do mathjs. Sem este caso, o serializer default renderiza QUALQUER
  // array (incl. um vetor achatado) como uma matriz COLUNA
  // (`\begin{bmatrix}1\\2\\0\\-5\end{bmatrix}`, confirmado empiricamente)
  // — errado para uma lista de coeficientes, que deve ler horizontalmente.
  // Só intercepta o caso ACHATADO (nenhum item é ele mesmo um array): uma
  // matriz literal ("[[1,2],[3,4]]", sempre um array de arrays) devolve
  // `undefined` aqui e continua com o serializer default, 100% inalterado.
  if (node.type === "ArrayNode") {
    const items = (node as unknown as { items: MathNode[] }).items;
    if (items.length === 0 || items.some((item) => item.type === "ArrayNode")) return undefined;
    const rendered = items.map((item) => texOf(item, options)).join(",\\,");
    return `\\left[${rendered}\\right]`;
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

  if (name !== null && name in MATRIX_ALIAS_LATEX && nodeArgs.length === 1) {
    return MATRIX_ALIAS_LATEX[name](texOf(nodeArgs[0], options));
  }

  if (name !== null && name in COMPLEX_ALIAS_LATEX && nodeArgs.length === 1) {
    return COMPLEX_ALIAS_LATEX[name](texOf(nodeArgs[0], options));
  }

  if (name !== null && name in POLYNOMIAL_OPERATION_LATEX) {
    const rendered = nodeArgs.map((arg) => texOf(arg, options)).join(",\\,");
    return `${POLYNOMIAL_OPERATION_LATEX[name]}\\left(${rendered}\\right)`;
  }

  if (name !== null && name in COMBINATORICS_LATEX) {
    const rendered = COMBINATORICS_LATEX[name](nodeArgs, options);
    if (rendered !== undefined) return rendered;
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

  // Aliases secundários do somatório (sintaxe principal é "Σ(var=inf..sup)
  // expr", tratada à parte em `inputToLatex`/`tryWholeSum" — esta forma só
  // existe porque "sum(...)"/"somatorio(...)" já É sintaxe mathjs válida
  // (chamada de função com 4 argumentos), então o mathjs a reconheceria
  // sozinho e a renderizaria com o template genérico se este caso não
  // existisse aqui. Ordem oficial: variável, limite inferior, limite
  // superior, expressão — mesma ordem do backend (`summation/parsing.py`).
  if ((name === "sum" || name === "somatorio") && nodeArgs.length === 4) {
    const variable = texOf(nodeArgs[0], options);
    const lower = texOf(nodeArgs[1], options);
    const upper = texOf(nodeArgs[2], options);
    const body = texOf(nodeArgs[3], options);
    return `\\sum_{${variable}=${lower}}^{${upper}} ${body}`;
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

// Sprint V2.2 (Motor de Matrizes) — mesmo marcador léxico do backend
// (`matrix/dispatcher.py:_MATRIX_LITERAL_MARKER`): "[[" é inequívoco,
// nenhuma outra forma do catálogo usa colchete duplo.
const MATRIX_LITERAL_PREFIX = "[[";

// Sprint V2.2.1 (Variáveis Locais para Matrizes) — instruções separadas
// por quebra de linha ou ";" ("A=[[1,2],[3,4]]\nB=...\nA*B"), mesmo
// critério de separador do backend (`matrix/parsing.py:_split_statements`).
const MULTI_STATEMENT_MARKER = /[\n;]/;

/**
 * Sprint V2.4 (Sistemas Lineares) — divide um sistema em equações por
 * quebra de linha OU ";" no nível mais alto (fora de parênteses/colchetes/
 * chaves), mesmo bracket-counting de
 * `connections.ts:splitMatrixStatements` (duplicado aqui de propósito —
 * módulos de camadas diferentes, mesmo critério de separador do backend em
 * `equations/dispatcher.py:_split_equations`).
 */
function splitSystemLines(text: string): string[] {
  const lines: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") depth -= 1;
    if ((char === "\n" || char === ";") && depth === 0) {
      const line = current.trim();
      if (line !== "") lines.push(line);
      current = "";
      continue;
    }
    current += char;
  }
  const tail = current.trim();
  if (tail !== "") lines.push(tail);
  return lines;
}

/** Uma linha "parece" uma única equação: exatamente um "=" de igualdade (não "<="/"=="/etc.), com os dois lados não vazios. */
function isSingleEquationLine(line: string): boolean {
  const parts = line.split(EQUATION_SPLIT);
  return parts.length === 2 && parts[0].trim() !== "" && parts[1].trim() !== "";
}

// Sprint V2.4 — mesmo critério de exclusão do backend
// (`matrix/dispatcher.py:is_matrix_domain_expression`, checado ANTES de
// equations na cascata de `math_engine/dispatcher.py`): "[[" ou uma
// chamada de função de matriz em QUALQUER posição do texto significa que
// o roteador real trata a entrada inteira como matriz, nunca como sistema
// — precisa ser excluído aqui pelo mesmo motivo, senão um programa de
// matriz com várias atribuições ("A=[[1,2],[3,4]]\nB=...") seria lido
// erroneamente como sistema (cada atribuição TEM a forma "nome = valor").
const SYSTEM_EXCLUDED_MATRIX_PATTERN =
  /\b(det|inv|transpose|trace|determinante|inversa|transposta|traço)\s*\(/i;

/**
 * Sprint V2.5 (Motor de Sistemas Polinomiais Não Lineares) — o backend
 * agora resolve sistemas POLINOMIAIS de qualquer grau (potência, produto
 * entre incógnitas — `equations/nonlinear.py`, via `sympy.nonlinsolve`),
 * não só sistemas lineares. Funções transcendentais das incógnitas
 * (seno/cosseno/tangente/log/ln/exp/módulo) continuam fora de escopo —
 * o backend rejeita com uma `ExpressionError` amigável
 * (`nonlinear.py:solve_nonlinear_system`, guarda `is_polynomial_system`).
 * O frontend NUNCA valida polinomialidade de verdade (o backend continua
 * sendo a fonte final) — só evita ATIVAR o recurso polido de "sistema"
 * (\begin{cases}, bloco Explorar) quando a entrada tem uma chamada de
 * função transcendental claramente identificável.
 */
const TRANSCENDENTAL_SYSTEM_MARKER_PATTERN =
  /\b(sen|sin|cos|tg|tan|asin|acos|atan|log|ln|exp|Abs|modulo)\s*\(/i;

/**
 * Sprint V2.4/V2.5 (Sistemas de Equações) — reconhece 2+ equações
 * separadas por quebra de linha/";" (mesmo critério do backend,
 * `equations/dispatcher.py:solve_equation_text`) e as envolve em
 * "\begin{cases}...\end{cases}" — sistemas lineares E polinomiais não
 * lineares (potência, produto entre incógnitas) recebem o MESMO
 * tratamento visual, já que "\begin{cases}" não distingue grau. Cada
 * linha é convertida pelo MESMO pipeline de equação única
 * (`expressionToLatex` recursivo — nunca reentra neste branch, porque
 * uma linha isolada nunca tem 2+ linhas). `null` = não é um sistema
 * (menos de 2 linhas, alguma linha não é uma equação única, colide com o
 * domínio de matriz, ou tem uma função transcendental — fora de escopo
 * mesmo do motor não linear) — quem chama cai para o pipeline normal de
 * expressão/equação única.
 */
async function polynomialSystemToLatex(text: string): Promise<string | null> {
  if (text.includes(MATRIX_LITERAL_PREFIX) || SYSTEM_EXCLUDED_MATRIX_PATTERN.test(text)) return null;
  if (!MULTI_STATEMENT_MARKER.test(text)) return null;

  const lines = splitSystemLines(text);
  if (lines.length < 2 || !lines.every(isSingleEquationLine)) return null;
  if (lines.some((line) => TRANSCENDENTAL_SYSTEM_MARKER_PATTERN.test(line))) return null;

  const rendered: string[] = [];
  for (const line of lines) {
    const latex = await expressionToLatex(line);
    if (latex === null) return null;
    rendered.push(latex);
  }
  return `\\begin{cases}${rendered.join("\\\\")}\\end{cases}`;
}

/**
 * Expressão ou equação/lista de igualdades ("x = 2", "f(2) = 10",
 * "x₁ = -2"). Cada lado é convertido separadamente — "=" nunca chega ao
 * mathjs (lá seria atribuição, com outro significado).
 *
 * Sprint V2.1 (apresentação progressiva): checa a notação Σ ANTES de
 * dividir por "=" — o cabeçalho "Σ(i=1..30) ..." tem um "=" próprio (parte
 * do "i=1..30") que `EQUATION_SPLIT` cortaria no lugar errado. Necessário
 * aqui (não só em `inputToLatex`) porque, a partir desta sprint, o BACKEND
 * pode devolver a própria notação Σ como `result` (somatório que não
 * expande) — `resultToLatex`/`valueToLatex` chegam a esta função também.
 *
 * Sprint V2.2.1: mesmo raciocínio para um PROGRAMA de matriz com
 * atribuições ("A=[[1,2],[3,4]]\nB=[[5,6],[7,8]]\nA*B") — cada atribuição
 * tem o seu próprio "=", e `EQUATION_SPLIT` (pensado para no máximo um
 * "=", eco de uma equação simples) cortaria isso em pedaços errados. O
 * mathjs já entende "A=matriz\nB=matriz\nexpr" nativamente como um
 * programa de várias instruções (`BlockNode`/`AssignmentNode`, com
 * `\begin{bmatrix}` e tudo) — delega direto pra lá em vez de tentar
 * dividir por "=" primeiro. Detecção: precisa ter uma matriz literal E
 * mais de uma instrução (quebra de linha ou ";") — um "x = 2" comum
 * (sem "[[") continua indo pelo caminho de sempre, intocado.
 */
export async function expressionToLatex(text: string): Promise<string | null> {
  const trimmed = text.trim();
  const sigmaSum = await sigmaSumToLatex(trimmed);
  if (sigmaSum !== null) return sigmaSum;

  if (trimmed.includes(MATRIX_LITERAL_PREFIX) && MULTI_STATEMENT_MARKER.test(trimmed)) {
    return singleExpressionToLatex(trimmed);
  }

  const system = await polynomialSystemToLatex(trimmed);
  if (system !== null) return system;

  const pieces = trimmed.split(EQUATION_SPLIT).map((side) => side.trim());
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

/**
 * Sprint V2.3 (Motor de Números Complexos) — forma polar. O backend
 * produz SEMPRE a forma exata "{r}(cos({θ})+i·sin({θ}))"
 * (`complex/dispatcher.py:_render_polar`) — nunca digitada pelo usuário,
 * só devolvida como RESULTADO. O "·" e a justaposição "r(" (sem "*")
 * fazem essa string ficar FORA do que o mathjs entende como uma única
 * expressão (confirmado empiricamente: "·" quebra o parser), então
 * precisa de reconhecimento estrutural dedicado, ANTES do pipeline
 * genérico — mesma filosofia classify-first do resto deste arquivo/do
 * `formatter/` do backend. Reconstrução exata (não regex "solto"): só
 * casa quando a string INTEIRA bate byte a byte com "r(cos(θ)+i·sin(θ))"
 * para o r/θ extraídos — nunca "adivinha" a partir de um prefixo.
 */
function parsePolarForm(text: string): { r: string; theta: string } | null {
  const trimmed = text.trim();
  const marker = "(cos(";
  const markerIndex = trimmed.indexOf(marker);
  if (markerIndex === -1) return null;
  const r = trimmed.slice(0, markerIndex);
  if (r === "") return null;

  const thetaOpenIndex = markerIndex + marker.length - 1;
  const thetaCloseIndex = findMatchingParen(trimmed, thetaOpenIndex);
  if (thetaCloseIndex === null) return null;
  const theta = trimmed.slice(thetaOpenIndex + 1, thetaCloseIndex);

  const reconstructed = `${r}(cos(${theta})+i·sin(${theta}))`;
  return trimmed === reconstructed ? { r, theta } : null;
}

async function polarFormToLatex(text: string): Promise<string | null> {
  const parsed = parsePolarForm(text);
  if (parsed === null) return null;
  const r = await singleExpressionToLatex(parsed.r);
  const theta = await singleExpressionToLatex(parsed.theta);
  if (r === null || theta === null) return null;
  return `${r}\\left(\\cos\\left(${theta}\\right) + i\\sin\\left(${theta}\\right)\\right)`;
}

const PERIODIC_SUFFIX = /^(.*),\s*([a-z])\s*∈\s*ℤ$/;

/**
 * Valor matemático em qualquer forma do catálogo do backend, da mais
 * estruturada para a mais simples (classify-first, primeira que casar):
 * " ou " -> ", k ∈ ℤ" -> "∪" -> " e " -> lista de igualdades -> matriz ->
 * tupla/intervalo -> expressão/equação.
 */
export async function valueToLatex(text: string): Promise<string | null> {
  const trimmed = text.trim();
  if (trimmed in SET_GLYPH_LATEX) return SET_GLYPH_LATEX[trimmed];

  // Precisa vir ANTES de `pairToLatex`: o regex de tupla/intervalo aceita
  // "[...]" com exatamente duas partes separadas por vírgula de nível
  // mais alto — uma matriz de exatamente duas linhas ("[[1,2],[3,4]]")
  // colidiria com essa forma e seria lida como uma tupla de dois
  // vetores-linha em vez de uma matriz 2x2 (o mathjs já sabe renderizar
  // matrizes nativamente, incluindo dentro de `det(...)`/`inv(...)`/etc.,
  // então basta cair direto no pipeline de expressão).
  if (trimmed.startsWith(MATRIX_LITERAL_PREFIX)) {
    return expressionToLatex(trimmed);
  }

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

  const polar = await polarFormToLatex(trimmed);
  if (polar !== null) return polar;

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
const SUM_SIGMA_PREFIX = /^Σ\(/;

/**
 * "Σ(variavel=inferior..superior) expressao" — sintaxe principal do
 * somatório (Sprint V2.1). Diferente de derivada/integral/limite, o corpo
 * não fica dentro dos mesmos parênteses do cabeçalho (pode conter parênteses
 * próprios, ex. "Σ(i=1..5) sin(i)^2 + cos(i)^2"), então usa o mesmo
 * bracket-matching de `findMatchingParen` em vez de um regex único.
 * Retorna `null` (cabeçalho incompleto/malformado) em vez de lançar — quem
 * chama cai para o Tier 2, que nunca falha.
 */
async function sigmaSumToLatex(trimmed: string): Promise<string | null> {
  if (!SUM_SIGMA_PREFIX.test(trimmed)) return null;
  const openIndex = trimmed.indexOf("(");
  const close = findMatchingParen(trimmed, openIndex);
  if (close === null) return null;

  const header = trimmed.slice(openIndex + 1, close);
  const body = trimmed.slice(close + 1).trim();
  const eqIndex = header.indexOf("=");
  if (eqIndex === -1 || body === "") return null;
  const dotsIndex = header.indexOf("..", eqIndex);
  if (dotsIndex === -1) return null;

  const variable = header.slice(0, eqIndex).trim();
  const lowerRaw = header.slice(eqIndex + 1, dotsIndex).trim();
  const upperRaw = header.slice(dotsIndex + 2).trim();

  const lower = await singleExpressionToLatex(lowerRaw);
  const upper = await singleExpressionToLatex(upperRaw);
  const bodyLatex = await expressionToLatex(body);
  if (lower === null || upper === null || bodyLatex === null) return null;

  return `\\sum_{${variable}=${lower}}^{${upper}} ${bodyLatex}`;
}

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

  const sigmaSum = await sigmaSumToLatex(trimmed);
  if (sigmaSum !== null) return sigmaSum;

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

/* =====================================================================
 * TIER 2 — pré-visualização tolerante (Sprint KaTeX Fase 6)
 *
 * O pipeline acima (`inputToLatex`/`expressionToLatex`) é fail-closed por
 * design: só devolve LaTeX quando a expressão INTEIRA é reconhecida com
 * fidelidade total (o mathjs consegue fazer parse dela). Isso é correto
 * para o eco de uma expressão JÁ RESOLVIDA pelo backend (sempre
 * bem-formada), mas é a causa raiz do bug da pré-visualização: enquanto o
 * usuário digita, a entrada quase sempre está incompleta ou é uma
 * combinação solta de símbolos ("π ≠ ∫ e ∞ → ≤ ≥") — nada disso é uma
 * expressão mathjs válida, então o Tier 1 devolve `null` para a entrada
 * INTEIRA e a pré-visualização caía para texto bruto.
 *
 * `safeExpressionLatex` é o pipeline de segurança: NUNCA lança, NUNCA
 * devolve vazio para entrada não vazia, sempre devolve algo que o KaTeX
 * consegue desenhar. Em vez de exigir uma árvore sintática completa, faz
 * conversão estrutural recursiva (mesmo balanceamento de parênteses de
 * `findMatchingParen`/`splitTopLevel` acima) com substituição de símbolo
 * como fallback final por caractere — nunca "tudo ou nada". `previewLatex`
 * é A ÚNICA função que consumidores de apresentação (preview, histórico)
 * devem chamar: tenta o Tier 1 (fidelidade máxima) primeiro, cai pro
 * Tier 2 (nunca falha) depois.
 * ===================================================================== */

/** Símbolos isolados sem estrutura ao redor -> comando LaTeX equivalente. */
const PREVIEW_SYMBOL_LATEX: Record<string, string> = {
  "π": "\\pi",
  "∞": "\\infty",
  "→": "\\to",
  "≠": "\\neq",
  "≤": "\\le",
  "≥": "\\ge",
  "∫": "\\int",
  "Σ": "\\sum",
  "×": "\\times",
  "÷": "\\div",
  "−": "-",
  "∪": "\\cup",
  "∈": "\\in",
  "ℝ": "\\mathbb{R}",
  "ℤ": "\\mathbb{Z}",
  "ℕ": "\\mathbb{N}",
  "ℚ": "\\mathbb{Q}",
  "ℂ": "\\mathbb{C}",
};

/** Funções conhecidas com UM argumento — usadas tanto completas ("nome(arg)") quanto vazias ("nome()", digitação incompleta). */
const PREVIEW_UNARY_LATEX: Record<string, (arg: string) => string> = {
  sqrt: (a) => `\\sqrt{${a}}`,
  cbrt: (a) => `\\sqrt[3]{${a}}`,
  log: (a) => `\\log\\left(${a}\\right)`,
  ln: (a) => `\\ln\\left(${a}\\right)`,
  sen: (a) => `\\operatorname{sen}\\left(${a}\\right)`,
  sin: (a) => `\\sin\\left(${a}\\right)`,
  cos: (a) => `\\cos\\left(${a}\\right)`,
  tg: (a) => `\\operatorname{tg}\\left(${a}\\right)`,
  tan: (a) => `\\tan\\left(${a}\\right)`,
  sec: (a) => `\\sec\\left(${a}\\right)`,
  exp: (a) => `e^{${a}}`,
  // Sprint V2.3 (Motor de Números Complexos) — mesma notação de
  // `COMPLEX_ALIAS_LATEX` (Tier 1), duplicada aqui de propósito: o Tier 2
  // nunca importa do Tier 1 (funções puras independentes, ver cabeçalho
  // da seção Tier 2 abaixo).
  conjugado: (a) => `\\overline{${a}}`,
  conj: (a) => `\\overline{${a}}`,
  modulo: (a) => `\\left|${a}\\right|`,
  abs: (a) => `\\left|${a}\\right|`,
  argumento: (a) => `\\arg\\left(${a}\\right)`,
  arg: (a) => `\\arg\\left(${a}\\right)`,
  // Sprint V2.7 (Motor de Combinatória) — mesma notação de
  // `COMBINATORICS_LATEX` (Tier 1), duplicada aqui de propósito (o Tier 2
  // nunca importa do Tier 1). O Tier 2 é o único caminho das formas
  // ACENTUADAS ("permutação(5)" cai fora de `SAFE_CHARSET` no Tier 1).
  // O argumento aqui já é uma string LaTeX: parênteses no fatorial só
  // quando ele não é um átomo simples ("(x+1)!" vs "6!").
  fatorial: (a) => (/^[0-9A-Za-z]*$/.test(a) ? `${a}!` : `\\left(${a}\\right)!`),
  fat: (a) => (/^[0-9A-Za-z]*$/.test(a) ? `${a}!` : `\\left(${a}\\right)!`),
  permutacao: (a) => `P_{${a}}`,
  "permutação": (a) => `P_{${a}}`,
};

/** Nome da função conhecida -> comando LaTeX "cru" (sem argumento), para o caso de chamada incompleta ("log(" ainda sem fechar). */
const PREVIEW_COMMAND_WORD: Record<string, string> = {
  sqrt: "\\sqrt",
  cbrt: "\\sqrt[3]",
  log: "\\log",
  ln: "\\ln",
  sen: "\\operatorname{sen}",
  sin: "\\sin",
  cos: "\\cos",
  tg: "\\operatorname{tg}",
  tan: "\\tan",
  sec: "\\sec",
  conjugado: "\\overline{}",
  conj: "\\overline{}",
  modulo: "|",
  abs: "|",
  argumento: "\\arg",
  arg: "\\arg",
};

/**
 * Apelidos aceitos em `renderCall` para os wrappers de cálculo — os nomes
 * PT-BR (`derivada`/`limite`) são a sintaxe técnica real do backend
 * (`natural_notation.py`); os nomes em inglês (`derivative`/`limit`) não
 * são aceitos por ele, mas ganham a MESMA notação bonita aqui porque isto
 * é só apresentação (o texto enviado ao backend nunca passa por aqui) —
 * sem isso, digitar `derivative(...)` cairia no `\operatorname{}` genérico
 * em vez de `d/dx`. `somatorio`/`sum` seguem o mesmo espírito: o backend
 * não resolve somatórios ainda, mas a pré-visualização não precisa saber
 * disso para desenhar o símbolo corretamente.
 */
const DERIVATIVE_NAMES = new Set(["derivada", "derivative"]);
const LIMIT_NAMES = new Set(["limite", "limit"]);
const SUM_NAMES = new Set(["somatorio", "somatório", "sum"]);

// Sprint V2.7 (Motor de Combinatória) — notação de livro didático no
// preview tolerante, incluindo as grafias acentuadas que o backend aceita
// (`combinatorics/parsing.py`) mas que nunca chegam ao Tier 1.
const COMBINATION_NAMES = new Set(["combinacao", "combinação"]);
const ARRANGEMENT_NAMES = new Set(["arranjo"]);
const PERMUTATION_REPETITION_NAMES = new Set([
  "permutacao_repeticao",
  "permutação_repetição",
  "permutacao_repetição",
  "permutação_repeticao",
]);

const PREVIEW_IDENTIFIER = /^[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ0-9_]*/;
const PREVIEW_SUPERSCRIPT_RUN = /^[⁰¹²³⁴⁵⁶⁷⁸⁹⁻ⁿ]+/;
const PREVIEW_SUBSCRIPT_RUN = /^[₀₁₂₃₄₅₆₇₈₉₋]+/;

/** Escapa os caracteres LaTeX especiais realisticamente alcançáveis em texto solto (ex. identificador "ponto_medio"). */
function escapeLatexText(text: string): string {
  return text.replace(/[_%#&]/g, (ch) => `\\${ch}`);
}

/** "nome(argsText)" já reconhecido e balanceado -> LaTeX. Nunca lança. */
function renderCall(name: string, argsText: string): string {
  const rawArgs = splitTopLevel(argsText, ",").map((part) => part.trim());
  const args = rawArgs.map((part) => convertFragment(part));

  if (args.length === 1 && name in PREVIEW_UNARY_LATEX) {
    return PREVIEW_UNARY_LATEX[name](args[0]);
  }
  if (DERIVATIVE_NAMES.has(name) && args.length === 2) {
    return `\\frac{d}{d${rawArgs[1]}}\\left(${args[0]}\\right)`;
  }
  if (name === "integral" && args.length === 2) {
    return `\\int ${args[0]}\\,d${rawArgs[1]}`;
  }
  if (name === "integral" && args.length === 4) {
    return `\\int_{${args[2]}}^{${args[3]}} ${args[0]}\\,d${rawArgs[1]}`;
  }
  if (LIMIT_NAMES.has(name) && args.length === 3) {
    return `\\lim_{${rawArgs[1]} \\to ${args[2]}} ${args[0]}`;
  }
  if (SUM_NAMES.has(name) && args.length === 4) {
    // Ordem oficial: variável, limite inferior, limite superior, expressão
    // (mesma ordem do backend, `summation/parsing.py`).
    return `\\sum_{${escapeLatexText(rawArgs[0])}=${args[1]}}^{${args[2]}} ${args[3]}`;
  }
  if (COMBINATION_NAMES.has(name) && args.length === 2) {
    return `C_{${args[0]},${args[1]}}`;
  }
  if (ARRANGEMENT_NAMES.has(name) && args.length === 2) {
    return `A_{${args[0]},${args[1]}}`;
  }
  if (PERMUTATION_REPETITION_NAMES.has(name) && args.length >= 2) {
    return `P_{${args[0]}}^{${args.slice(1).join(",")}}`;
  }

  const label = name.length < 3 ? escapeLatexText(name) : `\\operatorname{${escapeLatexText(name)}}`;
  return `${label}\\left(${args.join(", ")}\\right)`;
}

/** Tenta casar uma chamada "nome(...)" a partir de `pos` — não precisa ocupar o resto do texto (usado pelo flatScan). */
function matchCallAt(text: string, pos: number): { latex: string; end: number } | null {
  const idMatch = text.slice(pos).match(PREVIEW_IDENTIFIER);
  if (!idMatch) return null;
  let after = pos + idMatch[0].length;
  while (text[after] === " ") after += 1;
  if (text[after] !== "(") return null;
  const close = findMatchingParen(text, after);
  if (close === null) return null;
  return { latex: renderCall(idMatch[0], text.slice(after + 1, close)), end: close + 1 };
}

function tryWholeDerivative(text: string): string | null {
  const match = text.match(DERIVATIVE_INPUT);
  if (!match) return null;
  const openIndex = match[0].length - 1;
  const close = findMatchingParen(text, openIndex);
  if (close === null || close !== text.length - 1) return null;
  const inner = text.slice(openIndex + 1, close);
  return `\\frac{d}{d${match[1]}}\\left(${convertFragment(inner)}\\right)`;
}

function tryWholeIntegral(text: string): string | null {
  const asciiBounded = text.match(INTEGRAL_ASCII_BOUNDS);
  const unicodeBounded = asciiBounded ? null : text.match(INTEGRAL_UNICODE_BOUNDS);
  const bounded = asciiBounded ?? unicodeBounded;
  if (bounded) {
    let lower: string;
    let upper: string;
    if (unicodeBounded) {
      lower = translateRun(bounded[1], SUBSCRIPT_TO_ASCII) ?? convertFragment(bounded[1]);
      upper = translateRun(bounded[2], SUPERSCRIPT_TO_ASCII) ?? convertFragment(bounded[2]);
    } else {
      lower = convertFragment(bounded[1]);
      upper = convertFragment(bounded[2]);
    }
    const body = convertFragment(stripOuterParens(bounded[3]));
    return `\\int_{${lower}}^{${upper}} ${body}\\,d${bounded[4]}`;
  }
  const indefinite = text.match(INTEGRAL_INDEFINITE);
  if (indefinite) {
    const body = convertFragment(stripOuterParens(indefinite[1]));
    return `\\int ${body}\\,d${indefinite[2]}`;
  }
  return null;
}

function tryWholeLimit(text: string): string | null {
  const match = text.match(LIMIT_INPUT);
  if (!match) return null;
  const point = convertFragment(match[2]);
  const body = convertFragment(match[3]);
  return `\\lim_{${match[1]} \\to ${point}} ${body}`;
}

/**
 * Rede de segurança do Tier 2 para a sintaxe principal do somatório
 * ("Σ(var=inf..sup) expr") — usada só quando o Tier 1 (`sigmaSumToLatex`,
 * via mathjs, fidelidade máxima) não reconhece a entrada (típico durante a
 * digitação, cabeçalho ainda incompleto). Mesmo bracket-matching de
 * `findMatchingParen`; nunca lança, cai para `flatScan` linha abaixo se o
 * cabeçalho não estiver bem formado.
 */
function tryWholeSum(text: string): string | null {
  if (!text.startsWith("Σ(")) return null;
  const openIndex = text.indexOf("(");
  const close = findMatchingParen(text, openIndex);
  if (close === null) return null;

  const header = text.slice(openIndex + 1, close);
  const body = text.slice(close + 1).trim();
  const eqIndex = header.indexOf("=");
  if (eqIndex === -1 || body === "") return null;
  const dotsIndex = header.indexOf("..", eqIndex);
  if (dotsIndex === -1) return null;

  const variable = header.slice(0, eqIndex).trim();
  const lower = header.slice(eqIndex + 1, dotsIndex).trim();
  const upper = header.slice(dotsIndex + 2).trim();

  return `\\sum_{${escapeLatexText(variable)}=${convertFragment(lower)}}^{${convertFragment(upper)}} ${convertFragment(body)}`;
}

function tryWholeCall(text: string): string | null {
  const call = matchCallAt(text, 0);
  return call && call.end === text.length ? call.latex : null;
}

function tryWholeGroup(text: string): string | null {
  if (!text.startsWith("(")) return null;
  const close = findMatchingParen(text, 0);
  if (close === null || close !== text.length - 1) return null;
  return `\\left(${convertFragment(text.slice(1, close))}\\right)`;
}

/**
 * Varredura caractere a caractere — usada quando o fragmento inteiro não
 * é nenhuma forma reconhecida acima (vários símbolos soltos, uma chamada
 * NO MEIO de mais texto, entrada incompleta). Nunca lança: qualquer
 * caractere sem regra específica vira texto literal (escapado). Junta as
 * peças com espaço — sempre seguro em modo matemático (KaTeX/TeX ignoram
 * espaço de origem para leiaute) e evita comandos multi-letra colando com
 * o texto seguinte (`\pi` + "x" sem separador seria lido como um único
 * comando inválido).
 */
/**
 * O KaTeX permite só UM sobrescrito/subscrito por átomo — "^{}^{}" (dois
 * seguidos, sem base entre eles) é "Double superscript", erro de parse.
 * Isso acontece quando não há um átomo de verdade logo antes (início da
 * string, ou a peça anterior é ela mesma um sobrescrito/subscrito vazio,
 * ex. "^^^" digitado cru) — nesses casos cada "^"/"_" ganha sua PRÓPRIA
 * base invisível ("{}"), virando um átomo independente em vez de tentar
 * se anexar a um sobrescrito anterior.
 */
function needsEmptyBase(pieces: string[]): boolean {
  const last = pieces[pieces.length - 1];
  return last === undefined || /^(\{\})?[\^_]\{/.test(last);
}

function pushSup(pieces: string[], content: string): void {
  pieces.push(`${needsEmptyBase(pieces) ? "{}" : ""}^{${content}}`);
}

function pushSub(pieces: string[], content: string): void {
  pieces.push(`${needsEmptyBase(pieces) ? "{}" : ""}_{${content}}`);
}

function flatScan(text: string): string {
  const pieces: string[] = [];
  let plain = "";
  const flush = () => {
    if (plain !== "") {
      pieces.push(escapeLatexText(plain));
      plain = "";
    }
  };

  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);

    const call = matchCallAt(text, i);
    if (call) {
      flush();
      pieces.push(call.latex);
      i = call.end;
      continue;
    }

    const idMatch = rest.match(PREVIEW_IDENTIFIER);
    if (idMatch) {
      let after = i + idMatch[0].length;
      while (text[after] === " ") after += 1;
      if (text[after] === "(") {
        // "(" sem fechamento correspondente -- chamada incompleta em
        // digitação (ex. "log("): mostra o comando conhecido (ou o nome
        // literal) + "(" e segue escaneando o resto como texto solto, sem
        // usar `\left`/`\right` desbalanceado (nunca gera erro de
        // delimitador no KaTeX).
        flush();
        pieces.push((PREVIEW_COMMAND_WORD[idMatch[0]] ?? escapeLatexText(idMatch[0])) + "(");
        i = after + 1;
        continue;
      }
      plain += idMatch[0];
      i += idMatch[0].length;
      continue;
    }

    if (text[i] === "(") {
      const close = findMatchingParen(text, i);
      if (close !== null) {
        flush();
        pieces.push(`\\left(${convertFragment(text.slice(i + 1, close))}\\right)`);
        i = close + 1;
        continue;
      }
      plain += "(";
      i += 1;
      continue;
    }

    if (text[i] === "√" || text[i] === "∛") {
      const isCube = text[i] === "∛";
      let j = i + 1;
      while (text[j] === " ") j += 1;
      if (text[j] === "(") {
        const close = findMatchingParen(text, j);
        if (close !== null) {
          flush();
          const inner = convertFragment(text.slice(j + 1, close));
          pieces.push(isCube ? `\\sqrt[3]{${inner}}` : `\\sqrt{${inner}}`);
          i = close + 1;
          continue;
        }
        // "(" sem fechamento -- radical vazio, "(" segue para o próximo
        // laço ser tratado como texto solto.
        flush();
        pieces.push(isCube ? "\\sqrt[3]{}" : "\\sqrt{}");
        i = j;
        continue;
      }
      const radicand = rest.match(/^[√∛]\s*([A-Za-z0-9.]+)/);
      flush();
      if (radicand) {
        pieces.push(isCube ? `\\sqrt[3]{${radicand[1]}}` : `\\sqrt{${radicand[1]}}`);
        i += radicand[0].length;
      } else {
        pieces.push(isCube ? "\\sqrt[3]{}" : "\\sqrt{}");
        i += 1;
      }
      continue;
    }

    const supMatch = rest.match(PREVIEW_SUPERSCRIPT_RUN);
    if (supMatch) {
      flush();
      if (supMatch[0] === "ⁿ") {
        pushSup(pieces, "n");
      } else {
        const digits = translateRun(supMatch[0], SUPERSCRIPT_TO_ASCII);
        if (digits === null) pieces.push(escapeLatexText(supMatch[0]));
        else pushSup(pieces, digits);
      }
      i += supMatch[0].length;
      continue;
    }

    const subMatch = rest.match(PREVIEW_SUBSCRIPT_RUN);
    if (subMatch) {
      flush();
      const digits = translateRun(subMatch[0], SUBSCRIPT_TO_ASCII);
      if (digits === null) pieces.push(escapeLatexText(subMatch[0]));
      else pushSub(pieces, digits);
      i += subMatch[0].length;
      continue;
    }

    if (text[i] === "^") {
      let j = i + 1;
      while (text[j] === " ") j += 1;
      if (text[j] === "(") {
        const close = findMatchingParen(text, j);
        if (close !== null) {
          flush();
          pushSup(pieces, convertFragment(text.slice(j + 1, close)));
          i = close + 1;
          continue;
        }
      }
      // "[^\^]" na segunda alternativa exclui "^" do fallback de um único
      // caractere -- "^^^" gerando "^{^}" faria o KaTeX exigir grupo de
      // novo para o "^" agora DENTRO das chaves (chaves não "citam" o
      // caractere, ele continua ativo) e lançar o mesmo erro de nível 2.
      const token = text.slice(j).match(/^[A-Za-z0-9]+|^[^^]/);
      if (token) {
        flush();
        pushSup(pieces, escapeLatexText(token[0]));
        i = j + token[0].length;
        continue;
      }
      // "^" no fim da entrada (ainda digitando, nada para elevar) -- grupo
      // vazio: sintaticamente válido no KaTeX ("x^{}"), nunca lança o
      // "Expected group after '^'" que um "^" solto causaria.
      flush();
      pushSup(pieces, "");
      i += 1;
      continue;
    }

    const symbol = PREVIEW_SYMBOL_LATEX[text[i]];
    if (symbol !== undefined) {
      flush();
      pieces.push(symbol);
      i += 1;
      continue;
    }

    plain += text[i];
    i += 1;
  }

  flush();
  return pieces.join(" ");
}

/** Ponto único de recursão do Tier 2 — tenta as formas estruturais inteiras primeiro, cai pro flatScan por último. */
function convertFragment(raw: string): string {
  const text = raw.trim();
  if (text === "") return "";
  return (
    tryWholeDerivative(text) ??
    tryWholeIntegral(text) ??
    tryWholeLimit(text) ??
    tryWholeSum(text) ??
    tryWholeCall(text) ??
    tryWholeGroup(text) ??
    flatScan(text)
  );
}

/**
 * Pré-processamento puramente textual: as variantes ASCII dos mesmos
 * operadores (`<=`, `>=`, `!=`, `->`, `**`) viram os equivalentes Unicode
 * já tratados por `flatScan`/`PREVIEW_SYMBOL_LATEX` — um único caminho de
 * conversão em vez de duplicar a tabela em ASCII e Unicode.
 */
function normalizeAsciiOperators(text: string): string {
  return text
    .replace(/<=/g, "≤")
    .replace(/>=/g, "≥")
    .replace(/!=/g, "≠")
    .replace(/->/g, "→")
    .replace(/\*\*/g, "^");
}

/**
 * Tier 2 — SEMPRE devolve uma string pronta para `MathFormula` (nunca
 * lança, nunca devolve vazio para entrada não vazia). Ver o comentário da
 * seção acima para o porquê deste pipeline existir.
 */
export function safeExpressionLatex(text: string): string {
  try {
    return convertFragment(normalizeAsciiOperators(text));
  } catch {
    // Rede de segurança final -- nenhuma função acima deveria lançar, mas
    // o contrato "nunca quebra" não pode depender disso continuar
    // verdadeiro para sempre.
    return escapeLatexText(text.trim());
  }
}

/**
 * A ÚNICA função que consumidores de apresentação (pré-visualização,
 * histórico) devem chamar (Sprint KaTeX Fase 6): tenta o Tier 1
 * (`inputToLatex`, fidelidade máxima -- frações, precedência etc. via
 * mathjs) e cai pro Tier 2 (`safeExpressionLatex`, nunca falha) quando o
 * Tier 1 não reconhece a entrada inteira. `null` só nos dois casos em que
 * o texto puro já é a melhor exibição possível: vazio ou uma palavra pura
 * ("crescente") -- mesma exceção que o Tier 1 já aplicava, preservada
 * para não regredir esses rótulos para itálico com espaçamento de
 * multiplicação implícita do KaTeX.
 */
export async function previewLatex(text: string): Promise<string | null> {
  const trimmed = text.trim();
  if (trimmed === "" || BARE_WORD.test(trimmed)) return null;
  const precise = await inputToLatex(trimmed);
  return precise ?? safeExpressionLatex(trimmed);
}
