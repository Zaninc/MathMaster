import { describe, expect, it } from "vitest";

import { expressionToLatex, inputToLatex, resultToLatex, valueToLatex } from "./to-latex";

/**
 * O espaçamento fino do `toTex` do mathjs ("~", espaços) é detalhe de
 * implementação — os testes asseram a ESTRUTURA LaTeX com espaços
 * removidos, para não quebrarem num upgrade de versão do mathjs.
 */
function normalized(latex: string | null): string {
  expect(latex).not.toBeNull();
  return (latex as string).replace(/[\s~]|\\[,;:!]/g, "");
}

describe("expressionToLatex", () => {
  it("converte raízes com argumento composto", async () => {
    expect(normalized(await expressionToLatex("sqrt(x + 1)"))).toContain("\\sqrt{x+1}");
    expect(normalized(await expressionToLatex("√(x + 1)"))).toContain("\\sqrt{x+1}");
  });

  it("converte divisão para fração", async () => {
    const latex = normalized(await expressionToLatex("(x + 1)/(x - 1)"));
    expect(latex).toContain("\\frac");
    expect(latex).toContain("x+1");
    expect(latex).toContain("x-1");
  });

  it("converte potências Unicode e ASCII, incluindo expoente negativo", async () => {
    expect(normalized(await expressionToLatex("x² + y² = 25"))).toContain("^{2}");
    expect(normalized(await expressionToLatex("x**2 - 4"))).toContain("^{2}");
    expect(normalized(await expressionToLatex("2⁻³"))).toContain("^{-3}");
  });

  it("converte coeficiente implícito com raiz (2√2)", async () => {
    expect(normalized(await expressionToLatex("2√2"))).toContain("\\sqrt{2}");
  });

  it("respeita a convenção do produto para log/ln (log NUNCA vira \\ln)", async () => {
    expect(await expressionToLatex("log(100)")).toContain("\\log");
    expect(await expressionToLatex("log(100)")).not.toContain("\\ln");
    expect(await expressionToLatex("1/(x*ln(10))")).toContain("\\ln");
  });

  it("preserva a notação pt-BR sen/tg via operatorname", async () => {
    expect(await expressionToLatex("sen(x)")).toContain("\\operatorname{sen}");
    expect(await expressionToLatex("tg(x)")).toContain("\\operatorname{tg}");
  });

  it("converte equações lado a lado, incluindo subscritos de solução", async () => {
    expect(normalized(await expressionToLatex("x = 100"))).toBe("x=100");
    expect(normalized(await expressionToLatex("x₁ = -2"))).toContain("x_{1}");
    expect(normalized(await expressionToLatex("f(2) = 10"))).toContain("=10");
  });

  it("converte as formas SymPy dos wrappers de cálculo", async () => {
    const integral = normalized(await expressionToLatex("Integral(x**2, x)"));
    expect(integral).toContain("\\int");
    expect(integral).toContain("^{2}");
    expect(integral).toContain("dx");

    const limit = normalized(await expressionToLatex("Limit(sin(x)/x, x, 0)"));
    expect(limit).toContain("\\lim_{x\\to0}");
    expect(limit).toContain("\\frac");
    expect(limit).toContain("\\sin");
  });

  it("falha fechado para símbolos fora do catálogo e palavras puras", async () => {
    expect(await expressionToLatex("Perpendiculares ⊥")).toBeNull();
    expect(await expressionToLatex("crescente")).toBeNull();
    expect(await expressionToLatex("")).toBeNull();
  });

  it("chamada de função vazia (template em digitação) nunca converte — cai no fallback", async () => {
    expect(await expressionToLatex("sqrt()")).toBeNull();
    expect(await expressionToLatex("√()")).toBeNull();
    expect(await expressionToLatex("∛()")).toBeNull();
    expect(await expressionToLatex("eˣ()")).toBeNull();
    expect(await expressionToLatex("log()")).toBeNull();
    expect(await expressionToLatex("log()/log()")).toBeNull();
  });

  it("converte a raiz cúbica (Unicode e ASCII) como radical com índice", async () => {
    expect(normalized(await expressionToLatex("∛(8)"))).toContain("\\sqrt[3]{8}");
    expect(normalized(await expressionToLatex("cbrt(8)"))).toContain("\\sqrt[3]{8}");
  });

  it("renderiza os templates visuais do teclado: eˣ( como e elevado e ⁿ como expoente n", async () => {
    expect(normalized(await expressionToLatex("eˣ(2)"))).toContain("e^{2}");
    expect(normalized(await expressionToLatex("exp(2)"))).toContain("e^{2}");
    expect(normalized(await expressionToLatex("(2)ⁿ"))).toContain("^{n}");
    expect(normalized(await expressionToLatex("xⁿ"))).toContain("^{n}");
    // "²ⁿ" não é template oficial — fail-closed.
    expect(await expressionToLatex("x²ⁿ")).toBeNull();
  });
});

describe("valueToLatex", () => {
  it("converte intervalos com infinito e colchete misto", async () => {
    const latex = normalized(await valueToLatex("(-∞, 2]"));
    expect(latex).toContain("\\infty");
    expect(latex).toContain("\\right]");
  });

  it("converte união de intervalos", async () => {
    const latex = normalized(await valueToLatex("(-∞, -2) ∪ (2, ∞)"));
    expect(latex).toContain("\\cup");
    expect(latex.match(/\\infty/g)?.length).toBe(2);
  });

  it("converte tuplas de coordenadas", async () => {
    expect(normalized(await valueToLatex("(-3/2, -9/4)"))).toContain("\\frac");
  });

  it("converte listas de soluções com subscritos", async () => {
    const latex = normalized(await valueToLatex("x₁ = -2, x₂ = 2"));
    expect(latex).toContain("x_{1}");
    expect(latex).toContain("x_{2}");
  });

  it("converte soluções periódicas com 'ou' e 'k ∈ ℤ'", async () => {
    const latex = normalized(
      await valueToLatex("x = 2π*k + π/6 ou x = 2π*k + 5π/6, k ∈ ℤ")
    );
    expect(latex).toContain("\\text{ou}");
    expect(latex).toContain("k\\in\\mathbb{Z}");
    expect(latex).toContain("\\pi");
  });

  it("converte pares ligados por 'e' (focos)", async () => {
    const latex = normalized(await valueToLatex("(-4, 0) e (4, 0)"));
    expect(latex).toContain("\\text{e}");
  });

  it("mapeia conjuntos numéricos", async () => {
    expect(await valueToLatex("ℝ")).toBe("\\mathbb{R}");
    expect(await valueToLatex("ℤ")).toBe("\\mathbb{Z}");
  });
});

describe("resultToLatex", () => {
  it("segmenta resultado rotulado preservando rótulos como texto", async () => {
    const segments = await resultToLatex(
      "Tipo: circunferência; Centro: (0, 0); Raio: 5; Equação: x² + y² = 25"
    );
    expect(segments).toHaveLength(4);
    expect(segments![0]).toMatchObject({ label: "Tipo", text: "circunferência", latex: null });
    expect(segments![1].label).toBe("Centro");
    expect(segments![1].latex).not.toBeNull();
    expect(normalized(segments![3].latex)).toContain("{x}^{2}+{y}^{2}=25");
  });

  it("converte resultado puro em segmento único sem rótulo", async () => {
    const segments = await resultToLatex("x₁ = -2, x₂ = 2");
    expect(segments).toHaveLength(1);
    expect(segments![0].label).toBeNull();
    expect(normalized(segments![0].latex)).toContain("x_{1}");
  });

  it("converte resultado rotulado único (Derivada)", async () => {
    const segments = await resultToLatex("Derivada: 1/(x*ln(10))");
    expect(segments).toHaveLength(1);
    expect(segments![0].label).toBe("Derivada");
    expect(normalized(segments![0].latex)).toContain("\\frac{1}");
  });

  it("devolve null quando nada é conversível (fallback total)", async () => {
    expect(await resultToLatex("Relação entre as retas: Perpendiculares ⊥")).toBeNull();
  });

  it("mantém segmentos textuais no meio de segmentos matemáticos", async () => {
    const segments = await resultToLatex(
      "Tipo: função logarítmica; Domínio: (0, +∞); Monotonicidade: crescente"
    );
    expect(segments).toHaveLength(3);
    expect(segments![1].latex).toContain("\\infty");
    expect(segments![2].latex).toBeNull();
    expect(segments![2].text).toBe("crescente");
  });
});

describe("inputToLatex (echo da expressão digitada)", () => {
  it("converte d/dx", async () => {
    const latex = normalized(await inputToLatex("d/dx(x² + 3x)"));
    expect(latex).toContain("\\frac{d}{dx}");
    expect(latex).toContain("^{2}");
  });

  it("converte integral definida Unicode e ASCII", async () => {
    for (const input of ["∫₀¹ x² dx", "∫_0^1 x² dx"]) {
      const latex = normalized(await inputToLatex(input));
      expect(latex, input).toContain("\\int_{0}^{1}");
      expect(latex, input).toContain("dx");
    }
  });

  it("converte integral indefinida", async () => {
    const latex = normalized(await inputToLatex("∫x² dx"));
    expect(latex).toContain("\\int");
    expect(latex).toContain("^{2}");
  });

  it("converte limite em notação natural", async () => {
    const latex = normalized(await inputToLatex("lim x→0 sen(x)/x"));
    expect(latex).toContain("\\lim_{x\\to0}");
    expect(latex).toContain("\\operatorname{sen}");
  });

  it("aceita a seta ASCII '->' em limites, como o backend", async () => {
    const latex = normalized(await inputToLatex("lim x->0 sin(x)/x"));
    expect(latex).toContain("\\lim_{x\\to0}");
    expect(latex).toContain("\\sin");
  });

  it("converte a sintaxe técnica de cálculo", async () => {
    expect(normalized(await inputToLatex("derivada(x**2, x)"))).toContain("\\frac{d}{dx}");
    expect(normalized(await inputToLatex("integral(x**2, x, 0, 1)"))).toContain("\\int_{0}^{1}");
    expect(normalized(await inputToLatex("limite(sen(x)/x, x, 0)"))).toContain("\\lim_{x\\to0}");
  });

  it("falha fechado para sintaxe de geometria (tuplas)", async () => {
    expect(await inputToLatex("circunferencia((0,0),5)")).toBeNull();
    expect(await inputToLatex("distancia((0,0),(3,4))")).toBeNull();
  });
});
