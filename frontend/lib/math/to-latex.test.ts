import katex from "katex";
import { describe, expect, it } from "vitest";

import {
  expressionToLatex,
  inputToLatex,
  previewLatex,
  resultToLatex,
  safeExpressionLatex,
  valueToLatex,
} from "./to-latex";

/** A pré-visualização real usa `throwOnError:false`; aqui usamos `true` de propósito — qualquer caso que lance aqui exporia o glifo de erro vermelho em produção. */
function assertRendersSafely(latex: string, label: string): void {
  expect(() => katex.renderToString(latex, { throwOnError: true, strict: "ignore" }), label).not.toThrow();
}

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

  it("converte os aliases sum(...)/somatorio(...) (ordem: variável, inferior, superior, expressão)", async () => {
    const sum = normalized(await expressionToLatex("sum(i,1,10,i)"));
    expect(sum).toContain("\\sum_{i=1}^{10}");

    const somatorio = normalized(await expressionToLatex("somatorio(i,1,10,i)"));
    expect(somatorio).toContain("\\sum_{i=1}^{10}");
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

  it("converte a notação Σ compacta como RESULTADO (Sprint V2.1 — somatório que não expande)", async () => {
    // O "=" dentro de "i=1..30" não pode ser confundido com o separador de
    // equação — regressão do bug real encontrado na validação manual desta
    // sprint (resultToLatex caía pro fallback de texto puro).
    const segments = await resultToLatex("Σ(i=1..30) sin(i)");
    expect(segments).toHaveLength(1);
    expect(segments![0].label).toBeNull();
    expect(normalized(segments![0].latex)).toContain("\\sum_{i=1}^{30}");
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

  // --- Sprint V2.1: sintaxe principal do somatório Σ(var=inf..sup) expr ---

  it("converte a sintaxe principal do somatório", async () => {
    const latex = normalized(await inputToLatex("Σ(i=1..10) i"));
    expect(latex).toContain("\\sum_{i=1}^{10}");
  });

  it("converte o corpo do somatório com fidelidade real (fração, não texto com '/')", async () => {
    const latex = normalized(await inputToLatex("Σ(i=1..5) ((i²+1)/(2*i))"));
    expect(latex).toContain("\\sum_{i=1}^{5}");
    expect(latex).toContain("\\frac");
    expect(latex).toContain("{i}^{2}+1");
  });

  it("preserva um corpo com mais de uma função (parênteses próprios)", async () => {
    const latex = normalized(await inputToLatex("Σ(i=1..5) sin(i)^2 + cos(i)^2"));
    expect(latex).toContain("\\sum_{i=1}^{5}");
    expect(latex).toContain("\\sin");
    expect(latex).toContain("\\cos");
  });

  it("aceita limite inferior negativo", async () => {
    const latex = normalized(await inputToLatex("Σ(i=-3..3) (2*i+1)"));
    expect(latex).toContain("\\sum_{i=-3}^{3}");
  });

  it("cabeçalho incompleto (ainda digitando) devolve null — Tier 2 assume o preview", async () => {
    expect(await inputToLatex("Σ(i=1..")).toBeNull();
    expect(await inputToLatex("Σ(i=1..10)")).toBeNull();
  });
});

/**
 * Tier 2 — pipeline tolerante da pré-visualização (Sprint KaTeX Fase 6).
 * Ao contrário de `expressionToLatex`/`inputToLatex` (Tier 1, fail-closed:
 * `null` para qualquer coisa não 100% reconhecida), `safeExpressionLatex`
 * NUNCA devolve null para entrada não vazia e o resultado é sempre
 * verificado contra o KaTeX real com `throwOnError:true` — mais rígido do
 * que a produção (`throwOnError:false`), então qualquer caso que passasse
 * aqui só por "não lançar por acidente" já teria sido pego.
 */
describe("safeExpressionLatex (Tier 2 — nunca falha)", () => {
  it("símbolo isolado", () => {
    const latex = safeExpressionLatex("π");
    expect(latex).toBe("\\pi");
    assertRendersSafely(latex, "π");
  });

  it("vários símbolos consecutivos sem estrutura matemática — todos viram comando LaTeX", () => {
    const latex = safeExpressionLatex("π ≠ ∫ e ∞ → ≤ ≥");
    const normalized = latex.replace(/\s+/g, " ").trim();
    expect(normalized).toContain("\\pi");
    expect(normalized).toContain("\\neq");
    expect(normalized).toContain("\\int");
    expect(normalized).toContain("\\infty");
    expect(normalized).toContain("\\to");
    expect(normalized).toContain("\\le");
    expect(normalized).toContain("\\ge");
    // ordem preservada, "e" solto continua literal (não é comando).
    expect(normalized.indexOf("\\pi")).toBeLessThan(normalized.indexOf("\\neq"));
    expect(normalized.indexOf("\\neq")).toBeLessThan(normalized.indexOf("\\int"));
    expect(normalized).toMatch(/\be\b/);
    assertRendersSafely(latex, "π ≠ ∫ e ∞ → ≤ ≥");
  });

  it("potência", () => {
    const latex = safeExpressionLatex("x^2");
    expect(latex.replace(/\s+/g, "")).toContain("^{2}");
    assertRendersSafely(latex, "x^2");
  });

  it("raiz — com parênteses e em forma solta", () => {
    expect(safeExpressionLatex("sqrt(x)")).toBe("\\sqrt{x}");
    expect(safeExpressionLatex("√(x)")).toBe("\\sqrt{x}");
    expect(safeExpressionLatex("√x")).toBe("\\sqrt{x}");
    for (const input of ["sqrt(x)", "√(x)", "√x"]) assertRendersSafely(safeExpressionLatex(input), input);
  });

  it("log e ln aninhados", () => {
    const latex = safeExpressionLatex("log(ln(x))");
    expect(latex).toBe("\\log\\left(\\ln\\left(x\\right)\\right)");
    assertRendersSafely(latex, "log(ln(x))");
  });

  it("derivada", () => {
    const latex = safeExpressionLatex("derivative(x^2, x)");
    expect(latex).toContain("\\frac{d}{dx}");
    assertRendersSafely(latex, "derivative(x^2, x)");
  });

  it("integral", () => {
    const latex = safeExpressionLatex("integral(x^2, x)");
    expect(latex).toContain("\\int");
    expect(latex).toContain("\\,dx");
    assertRendersSafely(latex, "integral(x^2, x)");
  });

  it("limite", () => {
    const latex = safeExpressionLatex("limit(sin(x)/x, x, 0)");
    expect(latex).toContain("\\lim_{x \\to 0}");
    expect(latex).toContain("\\sin");
    assertRendersSafely(latex, "limit(sin(x)/x, x, 0)");
  });

  it("derivada contendo limite (aninhamento de cálculo)", () => {
    const latex = safeExpressionLatex("derivative(limit(sin(x)/x, x, 0), x)");
    expect(latex).toContain("\\frac{d}{dx}");
    expect(latex).toContain("\\lim_{x \\to 0}");
    assertRendersSafely(latex, "derivative(limit(sin(x)/x, x, 0), x)");
  });

  it("integral contendo função", () => {
    const latex = safeExpressionLatex("integral(log(x), x)");
    expect(latex).toContain("\\int");
    expect(latex).toContain("\\log\\left(x\\right)");
    assertRendersSafely(latex, "integral(log(x), x)");
  });

  it("funções aninhadas (múltiplos níveis)", () => {
    const latex = safeExpressionLatex("f(log(ln(log(e^x))))");
    expect(latex).toContain("f\\left(");
    expect(latex).toContain("\\log\\left(\\ln\\left(\\log\\left(");
    assertRendersSafely(latex, "f(log(ln(log(e^x))))");
  });

  it("parênteses aninhados", () => {
    const latex = safeExpressionLatex("((()))");
    assertRendersSafely(latex, "((()))");
    expect(latex).toContain("\\left(");
  });

  it("expressão incompleta — nunca lança, nunca fica vazia, nunca usa \\left/\\right desbalanceado", () => {
    for (const input of ["log(", "ln()", "integral(", "x^", "sqrt(", "√(", "∛(", "d/dx(", "lim x→"]) {
      const latex = safeExpressionLatex(input);
      expect(latex.length, input).toBeGreaterThan(0);
      assertRendersSafely(latex, input);
    }
  });

  it("múltiplos símbolos/carets soltos não crasham nem geram 'double superscript'", () => {
    for (const input of ["^^^", "√√√", "≤≥≠→∞π∫Σ×÷−∪∈", ")))", "((("]) {
      assertRendersSafely(safeExpressionLatex(input), input);
    }
  });

  it("expressões geométricas — chamada desconhecida vira \\operatorname seguro", () => {
    const latex = safeExpressionLatex("circunferencia((0,0),5)");
    expect(latex).toContain("\\operatorname{circunferencia}");
    assertRendersSafely(latex, "circunferencia((0,0),5)");
  });

  it("nunca devolve string vazia para entrada não vazia", () => {
    for (const input of ["x", "1", "(", ")", "_", "%", "&", "#"]) {
      expect(safeExpressionLatex(input).length, input).toBeGreaterThan(0);
    }
  });

  it("somatório completo (rede de segurança, mesmo resultado do Tier 1)", () => {
    const latex = safeExpressionLatex("Σ(i=1..10) i");
    expect(latex).toContain("\\sum_{i=1}^{10}");
    assertRendersSafely(latex, "Σ(i=1..10) i");
  });

  it("somatório com cabeçalho incompleto (ainda digitando) nunca lança", () => {
    for (const input of ["Σ(i=1..", "Σ(i=1..10", "Σ("]) {
      assertRendersSafely(safeExpressionLatex(input), input);
    }
  });
});

describe("previewLatex (pipeline único da pré-visualização e do histórico)", () => {
  it("usa o Tier 1 quando a expressão é totalmente reconhecida (fração real, não texto com '/')", async () => {
    const latex = await previewLatex("(x+1)/(x-1)");
    expect(latex).not.toBeNull();
    expect(latex).toContain("\\frac");
  });

  it("cai pro Tier 2 quando o Tier 1 falha, sem nunca devolver null para símbolos/estruturas", async () => {
    const cases = [
      "π ≠ ∫ e ∞ → ≤ ≥",
      "d/dx((lim x→0 ∞) dx)",
      "derivative(limit(sin(x)/x, x, 0), x)",
      "circunferencia((0,0),5)",
      "log(",
      "x^",
    ];
    for (const input of cases) {
      const latex = await previewLatex(input);
      expect(latex, input).not.toBeNull();
      assertRendersSafely(latex as string, input);
    }
  });

  it("preserva a exceção de palavra pura sem matemática (rótulo continua texto)", async () => {
    expect(await previewLatex("crescente")).toBeNull();
    expect(await previewLatex("")).toBeNull();
    expect(await previewLatex("   ")).toBeNull();
  });

  it("continua reconhecendo a sintaxe técnica de cálculo do produto (derivada/integral/limite)", async () => {
    expect(normalized(await previewLatex("derivada(x**2, x)"))).toContain("\\frac{d}{dx}");
    expect(normalized(await previewLatex("integral(x**2, x, 0, 1)"))).toContain("\\int_{0}^{1}");
    expect(normalized(await previewLatex("limite(sen(x)/x, x, 0)"))).toContain("\\operatorname{sen}");
  });

  it("reconhece a sintaxe principal do somatório, completa ou ainda em digitação", async () => {
    expect(normalized(await previewLatex("Σ(i=1..10) i"))).toContain("\\sum_{i=1}^{10}");

    for (const input of ["Σ(i=1..", "Σ(i=1..10)", "Σ("]) {
      const latex = await previewLatex(input);
      expect(latex, input).not.toBeNull();
      assertRendersSafely(latex as string, input);
    }
  });
});
