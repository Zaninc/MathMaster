import { describe, expect, it } from "vitest";

import { mathFieldLatexToBackendExpression } from "./mathfield-to-backend";

function expr(latex: string): string {
  const result = mathFieldLatexToBackendExpression(latex);
  if (!result.ok) throw new Error(`esperava sucesso, falhou com reason=${result.reason} para "${latex}"`);
  return result.expression;
}

describe("mathFieldLatexToBackendExpression", () => {
  it("números e variáveis passam direto", () => {
    expect(expr("42")).toBe("42");
    expect(expr("x")).toBe("x");
    expect(expr("3.14")).toBe("3.14");
  });

  it("soma/subtração/multiplicação implícita e explícita", () => {
    expect(expr("2x+4=10")).toBe("2x+4=10");
    expect(expr("x-1")).toBe("x-1");
    expect(expr("2\\times 3")).toBe("2*3");
    expect(expr("2\\cdot 3")).toBe("2*3");
    expect(expr("-4")).toBe("-4");
  });

  it("igualdade — exemplo do ticket: x²-4=0", () => {
    expect(expr("x^2-4=0")).toBe("x²-4=0");
  });

  it("fração — exemplo do ticket: 1/2 visual -> \\frac{1}{2} -> 1/2", () => {
    expect(expr("\\frac{1}{2}")).toBe("1/2");
    expect(expr("\\frac{1}{2}+\\frac{1}{3}")).toBe("1/2+1/3");
  });

  it("fração com numerador/denominador compostos ganha parênteses", () => {
    expect(expr("\\frac{x+1}{x-1}")).toBe("(x+1)/(x-1)");
  });

  it("potência — dígito único vira sobrescrito Unicode, igual ao teclado existente", () => {
    expect(expr("x^2")).toBe("x²");
    expect(expr("x^3")).toBe("x³");
  });

  it("potência composta usa ^ — sintaxe já aceita pelo backend (sem parênteses supérfluos para expoente numérico puro)", () => {
    expect(expr("x^{12}")).toBe("x^12");
    expect(expr("x^{-1}")).toBe("x^(-1)");
  });

  it("parênteses — exemplo do ticket: (x+1)² -> \\left(x+1\\right)^2 -> (x+1)^2", () => {
    expect(expr("\\left(x+1\\right)^2")).toBe("(x+1)²");
    expect(expr("(x+1)^3")).toBe("(x+1)³");
  });

  it("raiz quadrada — exemplo do ticket: √x -> \\sqrt{x} -> sqrt(x) (convenção real: √(x))", () => {
    expect(expr("\\sqrt{x}")).toBe("√(x)");
    expect(expr("\\sqrt{16}")).toBe("√(16)");
  });

  it("raiz cúbica usa o glifo ∛ já existente no teclado", () => {
    expect(expr("\\sqrt[3]{8}")).toBe("∛(8)");
  });

  it("raiz n-ésima genérica cai para potência fracionária (backend-nativa)", () => {
    expect(expr("\\sqrt[4]{16}")).toBe("(16)**(1/(4))");
  });

  it("raiz de expressão composta — exemplo do ticket: √(x+1)", () => {
    expect(expr("\\sqrt{x+1}")).toBe("√(x+1)");
  });

  it("π sozinho e em produto", () => {
    expect(expr("\\pi")).toBe("π");
    expect(expr("\\pi/2")).toBe("π/2");
    expect(expr("2\\pi")).toBe("2π");
  });

  it("regressão: x³-6x²+11x-6", () => {
    expect(expr("x^3-6x^2+11x-6")).toBe("x³-6x²+11x-6");
  });

  it("regressão: (x+1)³", () => {
    expect(expr("(x+1)^3")).toBe("(x+1)³");
  });

  it("slot vazio (\\placeholder{} não preenchido) devolve reason=incomplete", () => {
    expect(mathFieldLatexToBackendExpression("\\frac{1}{\\placeholder{}}")).toEqual({
      ok: false,
      reason: "incomplete",
    });
    expect(mathFieldLatexToBackendExpression("x^{\\placeholder{}}")).toEqual({ ok: false, reason: "incomplete" });
    expect(mathFieldLatexToBackendExpression("\\sqrt{}")).toEqual({ ok: false, reason: "incomplete" });
  });

  it("comando LaTeX fora do catálogo (ex. integral) devolve reason=unsupported, nunca lança", () => {
    expect(mathFieldLatexToBackendExpression("\\int_0^1 x^2\\,dx")).toEqual({ ok: false, reason: "unsupported" });
    expect(mathFieldLatexToBackendExpression("\\sum_{i=1}^{10} i")).toEqual({ ok: false, reason: "unsupported" });
    expect(mathFieldLatexToBackendExpression("\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}")).toEqual({
      ok: false,
      reason: "unsupported",
    });
  });

  it("é fail-closed: nunca lança para entrada arbitrária, sempre devolve {ok:false}", () => {
    for (const bogus of ["\\unknown{x}", "@#$", "\\frac{1}", "((("]) {
      expect(() => mathFieldLatexToBackendExpression(bogus)).not.toThrow();
      expect(mathFieldLatexToBackendExpression(bogus).ok).toBe(false);
    }
  });
});
