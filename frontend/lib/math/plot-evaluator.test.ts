import { describe, expect, it } from "vitest";

import { compilePlotFunction, PlotExpressionError } from "./plot-evaluator";

describe("compilePlotFunction — expressões válidas", () => {
  it("avalia uma expressão polinomial", async () => {
    const fn = await compilePlotFunction("x^2 - 4");
    expect(fn(3)).toBe(5);
  });

  it("avalia funções trigonométricas e constantes conhecidas", async () => {
    const fn = await compilePlotFunction("sin(x)");
    expect(fn(0)).toBeCloseTo(0);
  });

  it("avalia multiplicação implícita", async () => {
    const fn = await compilePlotFunction("2x + 1");
    expect(fn(3)).toBe(7);
  });

  it("retorna NaN para divisão por zero em vez de lançar", async () => {
    const fn = await compilePlotFunction("1/x");
    expect(Number.isNaN(fn(0))).toBe(true);
  });
});

describe("compilePlotFunction — bloqueado por whitelist", () => {
  it("rejeita atribuição", async () => {
    await expect(compilePlotFunction("a = 5")).rejects.toBeInstanceOf(PlotExpressionError);
  });

  it("rejeita definição de função", async () => {
    await expect(compilePlotFunction("f(x) = x^2")).rejects.toBeInstanceOf(PlotExpressionError);
  });

  it("rejeita função fora da whitelist", async () => {
    await expect(compilePlotFunction("derivative(x^2, x)")).rejects.toBeInstanceOf(PlotExpressionError);
  });

  it("rejeita acesso a propriedade", async () => {
    await expect(compilePlotFunction("x.constructor")).rejects.toBeInstanceOf(PlotExpressionError);
  });

  it("rejeita array/objeto", async () => {
    await expect(compilePlotFunction("[1, 2, 3]")).rejects.toBeInstanceOf(PlotExpressionError);
  });

  it("rejeita símbolo desconhecido (só 'x' é variável livre permitida)", async () => {
    await expect(compilePlotFunction("y + 1")).rejects.toBeInstanceOf(PlotExpressionError);
  });

  it("rejeita múltiplas instruções", async () => {
    await expect(compilePlotFunction("x; x")).rejects.toBeInstanceOf(PlotExpressionError);
  });

  it("rejeita expressão vazia", async () => {
    await expect(compilePlotFunction("   ")).rejects.toBeInstanceOf(PlotExpressionError);
  });

  it("rejeita sintaxe malformada sem vazar erro interno do mathjs", async () => {
    await expect(compilePlotFunction("x +* 2")).rejects.toBeInstanceOf(PlotExpressionError);
  });
});
