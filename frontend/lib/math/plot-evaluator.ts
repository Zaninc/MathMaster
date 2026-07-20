import type { MathNode } from "mathjs";

/**
 * Avaliador numérico ESCOPADO A PLOTAGEM — decisão da auditoria da Sprint
 * Frontend V1 (Etapa 3): `mathjs` é carregado por dynamic import (só
 * quando a página de Gráficos precisa) e a AST resultante é validada nó a
 * nó ANTES de qualquer `compile()/evaluate()` — mesma filosofia
 * whitelist-first do backend (`safe_parsing.py`), não um parser
 * artesanal, mas também não `mathjs.evaluate()` livre.
 *
 * Bloqueado por construção (cada nó não listado explicitamente cai no
 * `default` e lança): atribuições (AssignmentNode/FunctionAssignmentNode),
 * blocos/múltiplas instruções (BlockNode), acesso a propriedade
 * (AccessorNode/IndexNode — inclui `constructor`/prototype pollution),
 * objetos/arrays, condicionais, ranges, funções fora da whitelist. "import"
 * não existe como sintaxe de expressão do mathjs (é só API JS), e mesmo
 * que existisse como símbolo cairia em SymbolNode não reconhecido.
 * Sintaxe de derivada/integral/limite do MathMaster (`d/dx`, `∫`, `lim`)
 * nunca chega aqui — este avaliador é uma linguagem separada (notação
 * mathjs: `^` para potência, `sin`/`log`/`abs`), só para amostragem
 * numérica de uma função já compreendida, nunca enviado ao backend.
 */

const ALLOWED_FUNCTIONS = new Set([
  "sin",
  "cos",
  "tan",
  "cot",
  "sec",
  "csc",
  "asin",
  "acos",
  "atan",
  "sqrt",
  "cbrt",
  "abs",
  "exp",
  "log",
  "log10",
  "pow",
]);

const ALLOWED_CONSTANTS = new Set(["pi", "e", "tau"]);
/** Exportado para lib/math/graph-normalize.ts (fonte única da única variável livre permitida). */
export const ALLOWED_VARIABLE = "x";

const ALLOWED_OPERATOR_FNS = new Set([
  "add",
  "subtract",
  "multiply",
  "divide",
  "pow",
  "unaryMinus",
  "unaryPlus",
  "mod",
]);

export class PlotExpressionError extends Error {}

function assertSafeNode(node: MathNode): void {
  switch (node.type) {
    case "OperatorNode": {
      const fn = (node as unknown as { fn: string }).fn;
      if (!ALLOWED_OPERATOR_FNS.has(fn)) {
        throw new PlotExpressionError(`Operador não permitido: ${fn}`);
      }
      node.forEach((child) => assertSafeNode(child));
      return;
    }
    case "ParenthesisNode":
      node.forEach((child) => assertSafeNode(child));
      return;
    case "ConstantNode":
      return;
    case "SymbolNode": {
      const name = (node as unknown as { name: string }).name;
      if (name === ALLOWED_VARIABLE || ALLOWED_CONSTANTS.has(name)) return;
      throw new PlotExpressionError(`Símbolo não permitido: ${name}`);
    }
    case "FunctionNode": {
      const fnName = (node as unknown as { fn: { name: string } }).fn.name;
      if (!ALLOWED_FUNCTIONS.has(fnName)) {
        throw new PlotExpressionError(`Função não permitida: ${fnName}`);
      }
      // `.forEach()` genérico também visita o identificador da própria
      // função (o "sin" de "sin(x)"), que é internamente um SymbolNode —
      // por isso percorremos `.args` diretamente, não o `.forEach()` da
      // classe base, que rejeitaria "sin" como símbolo desconhecido.
      const args = (node as unknown as { args: MathNode[] }).args;
      args.forEach((child) => assertSafeNode(child));
      return;
    }
    default:
      throw new PlotExpressionError(`Construção não permitida para plotagem: ${node.type}`);
  }
}

let mathjsPromise: Promise<typeof import("mathjs")> | null = null;

function loadMathjs(): Promise<typeof import("mathjs")> {
  if (!mathjsPromise) {
    mathjsPromise = import("mathjs");
  }
  return mathjsPromise;
}

export type PlotFn = (x: number) => number;

export async function compilePlotFunction(expression: string): Promise<PlotFn> {
  const trimmed = expression.trim();
  if (!trimmed) {
    throw new PlotExpressionError("A expressão não pode estar vazia.");
  }

  const { parse } = await loadMathjs();

  let node: MathNode;
  try {
    node = parse(trimmed);
  } catch {
    throw new PlotExpressionError("Não foi possível interpretar a expressão para plotagem.");
  }

  assertSafeNode(node);
  const compiled = node.compile();

  return (x: number) => {
    try {
      const value = compiled.evaluate({ x });
      return typeof value === "number" && Number.isFinite(value) ? value : NaN;
    } catch {
      return NaN;
    }
  };
}
