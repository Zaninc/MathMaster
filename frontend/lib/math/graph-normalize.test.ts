import { describe, expect, it } from "vitest";

import { compilePlotFunction } from "./plot-evaluator";
import { normalizeForPlot, plotExpressionToLatex } from "./graph-normalize";

describe("normalizeForPlot", () => {
  it("converte superescritos Unicode para ^dígito", () => {
    expect(normalizeForPlot("x²")).toBe("x^2");
    expect(normalizeForPlot("x³ - 3x")).toBe("x^3 - 3x");
  });

  it("traduz sen/tg (PT-BR) para sin/tan (mathjs)", () => {
    expect(normalizeForPlot("sen(x)")).toBe("sin(x)");
    expect(normalizeForPlot("tg(x)")).toBe("tan(x)");
  });

  it("traduz ln para log (o log nativo do mathjs já é natural)", () => {
    expect(normalizeForPlot("ln(x)")).toBe("log(x)");
  });

  it("insere * entre identificador e ( quando não é uma função conhecida", () => {
    expect(normalizeForPlot("x(x+1)")).toBe("x*(x+1)");
  });

  it("não insere * antes de funções conhecidas (sin, log10, abs...)", () => {
    expect(normalizeForPlot("sin(x)")).toBe("sin(x)");
    expect(normalizeForPlot("log10(x)")).toBe("log10(x)");
    expect(normalizeForPlot("abs(x)")).toBe("abs(x)");
  });

  it("não mexe em outros identificadores seguidos de ( — só a variável x é reescrita", () => {
    // Regra restrita de propósito: uma tentativa de DEFINIÇÃO de função
    // como "f(x) = x^2" deve continuar sendo rejeitada pela whitelist com
    // sua mensagem original, não virar "f*(x) = x^2" (erro de sintaxe
    // genérico, uma regressão real pega pelo teste de GraphsWorkspace).
    expect(normalizeForPlot("f(x) = x^2")).toBe("f(x) = x^2");
    expect(normalizeForPlot("max(x)")).toBe("max(x)");
  });

  it("é idempotente: sintaxe já técnica passa intocada", () => {
    expect(normalizeForPlot("x^2 - 4")).toBe("x^2 - 4");
    expect(normalizeForPlot("2x + 1")).toBe("2x + 1");
    expect(normalizeForPlot("(x+1)(x-1)")).toBe("(x+1)(x-1)");
    expect(normalizeForPlot("2(x+1)")).toBe("2(x+1)");
  });

  it("combina as três regras numa única expressão", () => {
    expect(normalizeForPlot("2x² + sen(x)")).toBe("2x^2 + sin(x)");
  });
});

describe("normalizeForPlot + compilePlotFunction (integração real)", () => {
  it("x² e x^2 produzem o mesmo resultado", async () => {
    const natural = await compilePlotFunction(normalizeForPlot("x² - 4"));
    const technical = await compilePlotFunction("x^2 - 4");
    expect(natural(3)).toBe(technical(3));
  });

  it("2x e 2*x produzem o mesmo resultado", async () => {
    const natural = await compilePlotFunction(normalizeForPlot("2x + 1"));
    const technical = await compilePlotFunction("2*x + 1");
    expect(natural(3)).toBe(technical(3));
  });

  it("sen(x) e sin(x) produzem o mesmo resultado", async () => {
    const natural = await compilePlotFunction(normalizeForPlot("sen(x)"));
    const technical = await compilePlotFunction("sin(x)");
    expect(natural(0)).toBeCloseTo(technical(0));
  });

  it("ln(x) e log(x) (mathjs, natural) produzem o mesmo resultado", async () => {
    const natural = await compilePlotFunction(normalizeForPlot("ln(x)"));
    const technical = await compilePlotFunction("log(x)");
    expect(natural(Math.E)).toBeCloseTo(technical(Math.E));
  });

  it("x(x+1) e x*(x+1) produzem o mesmo resultado", async () => {
    const natural = await compilePlotFunction(normalizeForPlot("x(x+1)"));
    const technical = await compilePlotFunction("x*(x+1)");
    expect(natural(3)).toBe(technical(3));
  });

  it("(x+1)(x-1) continua funcionando (já era multiplicação implícita nativa)", async () => {
    const fn = await compilePlotFunction(normalizeForPlot("(x+1)(x-1)"));
    expect(fn(3)).toBe(8);
  });
});

describe("plotExpressionToLatex", () => {
  it("converte sintaxe técnica para LaTeX", async () => {
    const latex = await plotExpressionToLatex("x^2 - 4");
    expect(latex).not.toBeNull();
    expect(latex).toContain("^{2}");
  });

  it("converte sintaxe natural (mesma que compila) para LaTeX", async () => {
    const latex = await plotExpressionToLatex("sen(x)");
    expect(latex).toBe(await plotExpressionToLatex("sin(x)"));
  });

  it("string vazia devolve null", async () => {
    expect(await plotExpressionToLatex("   ")).toBeNull();
  });

  it("expressão malformada devolve null (fail-closed), nunca lança", async () => {
    await expect(plotExpressionToLatex("x +* 2")).resolves.toBeNull();
  });
});
