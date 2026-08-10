import { describe, expect, it } from "vitest";

import { mathFieldLatexToBackendExpression } from "./mathfield-to-backend";
import { previewLatex } from "./to-latex";

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

  it("comando LaTeX fora do catálogo (ex. matriz) devolve reason=unsupported, nunca lança", () => {
    // Integral/somatório SAÍRAM do catálogo "fora de escopo" na Sprint
    // V3.0.1 (Structured Calculus Input) — ver describe dedicado abaixo.
    // Matrizes continuam fora do catálogo (V3.0.2+).
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

  // --- Hotfix V3.0.1a: regressão de polinômios básicos --------------------
  //
  // Causa raiz da regressão: o mathjs (via `previewLatex`) NUNCA gera o
  // LaTeX "idealizado" que os testes acima usam (`x^2`, `x^3-6x^2...`) —
  // ele envolve toda variável/base em chaves TRANSPARENTES com espaço
  // interno (`{ x}`) e separa coeficiente de variável com "~" (espaço fino
  // de LaTeX), ex. "6~{ x}^{2}" para "6x²". O parser já sabia abrir
  // `{...}` e já tratava "~" como espaço — mas o detector de multiplicação
  // implícita em `parseTerm()` só reconhecia `[0-9a-zA-Z(]` como início de
  // um novo fator, nunca "{" — então "6~{x}^2" era lido como só "6",
  // truncando o resto da expressão e derrubando tudo com "unsupported".
  // Corrigido genericamente (adicionando "{" ao conjunto de gatilhos de
  // multiplicação implícita), não com um caso especial para este polinômio
  // — os testes abaixo cobrem a FORMA REAL que o mathjs produz, nunca só a
  // forma idealizada, para este tipo de regressão nunca mais passar
  // despercebido.
  describe("Hotfix V3.0.1a — polinômios básicos com a forma REAL do mathjs ({ x}, ~, espaços)", () => {
    it("x³-6x²+11x-6=0 (o caso relatado) — múltiplos termos, coeficientes, potências e igualdade", () => {
      expect(expr("{ x}^{3}-6~{ x}^{2}+11~ x-6 = 0")).toBe("x³-6x²+11x-6=0");
    });

    it("x²-4=0 continua aceito", () => {
      expect(expr("{ x}^{2}-4 = 0")).toBe("x²-4=0");
    });

    it("2x+4=10 continua aceito", () => {
      expect(expr("2~ x+4 = 10")).toBe("2x+4=10");
    });

    it("generaliza pra um polinômio nunca visto antes (grau 4, coeficientes diferentes, sinais alternados) — prova que não é hardcode", () => {
      expect(expr("{ x}^{4}+2~{ x}^{3}-3~{ x}^{2}+4~ x-5 = 0")).toBe("x⁴+2x³-3x²+4x-5=0");
    });

    it("também generaliza sem igualdade (só a expressão)", () => {
      expect(expr("3~{ x}^{2}-5~ x+2")).toBe("3x²-5x+2");
    });

    /**
     * Teste de integração real: passa pelo MESMO `previewLatex` que
     * `CalculatorWorkspace` usa pra converter exemplos/histórico/deep
     * links pra LaTeX — não uma string LaTeX escrita à mão que pode
     * divergir do que o mathjs realmente produz (foi exatamente essa
     * divergência que escondeu a regressão original). Se o mathjs mudar
     * sua serialização no futuro, este teste pega a quebra imediatamente.
     */
    it("integração real: previewLatex(texto) -> adapter aceita, pros 7 exemplos da Calculadora + o polinômio relatado", async () => {
      for (const text of [
        "x² - 4 = 0",
        "2x + 4 = 10",
        "(x+1)³",
        "√16",
        "1/2 + 1/3",
        "x³-6x²+11x-6=0",
        "π/2",
      ]) {
        const latex = await previewLatex(text);
        expect(latex, text).not.toBeNull();
        const converted = mathFieldLatexToBackendExpression(latex!);
        expect(converted.ok, `${text} -> ${latex}`).toBe(true);
      }
    });
  });

  // --- Sprint V3.0.1 (Structured Calculus Input) ---------------------------
  //
  // O adapter emite a sintaxe TÉCNICA CANÔNICA do backend diretamente
  // (`derivada(expr,var)`, `integral(expr,var[,inf,sup])`,
  // `limite(expr,var,ponto)`, `Σ(var=inf..sup) expr`) — confirmado por
  // `test_calculus_natural_notation.py` (backend) que essa forma passa
  // IDÊNTICA pela normalização de notação natural (idempotente), então
  // não há necessidade de emitir "d/dx(...)"/"∫...dx"/"lim x→p ...".
  // Todos os casos abaixo foram validados contra o backend REAL rodando
  // (`/solve`), não só contra a forma esperada — resultados conferidos:
  // ver o relatório da sprint.
  describe("Sprint V3.0.1 — Derivada (\\frac{d}{dx}(...))", () => {
    it("d/dx(x²) -> derivada(x², x)", () => {
      expect(expr("\\frac{d}{dx}\\left(x^2\\right)")).toBe("derivada(x², x)");
    });

    it("d/dx(x² + 3x) -> derivada(x²+3x, x)", () => {
      expect(expr("\\frac{d}{dx}\\left(x^2+3x\\right)")).toBe("derivada(x²+3x, x)");
    });

    it("d/dx((x²+1)³) — cadeia — -> derivada((x²+1)³, x)", () => {
      expect(expr("\\frac{d}{dx}\\left((x^2+1)^3\\right)")).toBe("derivada((x²+1)³, x)");
    });

    it("d/dx(x² sin(x)) — produto com função mínima — -> derivada(x²sin(x), x)", () => {
      expect(expr("\\frac{d}{dx}\\left(x^2\\sin(x)\\right)")).toBe("derivada(x²sin(x), x)");
    });

    it("d/dx √(x²+1) — aninhado, sem parênteses no argumento — -> derivada(√(x²+1), x)", () => {
      expect(expr("\\frac{d}{dx}\\sqrt{x^2+1}")).toBe("derivada(√(x²+1), x)");
    });

    it("variável não hardcodada em x — d/dy(...) funciona genericamente", () => {
      expect(expr("\\frac{d}{dy}\\left(x*y\\right)")).toBe("derivada(x*y, y)");
    });

    it("uma fração comum (numerador != 'd') continua sendo fração, nunca confundida com derivada", () => {
      expect(expr("\\frac{2}{dx}")).toBe("2/(dx)");
    });

    it("derivada sem expressão (slot vazio) -> incomplete", () => {
      expect(mathFieldLatexToBackendExpression("\\frac{d}{dx}\\left(\\placeholder{}\\right)")).toEqual({
        ok: false,
        reason: "incomplete",
      });
    });
  });

  describe("Sprint V3.0.1 — Integral indefinida (\\int ... dx)", () => {
    it("∫x² dx -> integral(x², x)", () => {
      expect(expr("\\int x^2\\,dx")).toBe("integral(x², x)");
    });

    it("∫x·eˣ dx -> integral(x*e^x, x)", () => {
      expect(expr("\\int x\\cdot e^{x}\\,dx")).toBe("integral(x*e^x, x)");
    });

    it("∫2x(x²+1)³ dx -> integral(2x(x²+1)³, x)", () => {
      expect(expr("\\int 2x\\left(x^2+1\\right)^3\\,dx")).toBe("integral(2x(x²+1)³, x)");
    });

    it("∫sin(x) dx -> integral(sin(x), x)", () => {
      expect(expr("\\int \\sin(x)\\,dx")).toBe("integral(sin(x), x)");
    });

    it("aninhado: ∫(x²+1)/x dx -> integral((x²+1)/x, x)", () => {
      expect(expr("\\int \\frac{x^2+1}{x}\\,dx")).toBe("integral((x²+1)/x, x)");
    });

    it("integral sem integrando (slot vazio) -> incomplete", () => {
      expect(mathFieldLatexToBackendExpression("\\int \\placeholder{}\\,dx")).toEqual({
        ok: false,
        reason: "incomplete",
      });
    });
  });

  describe("Sprint V3.0.1 — Integral definida (\\int_a^b ... dx)", () => {
    it("∫₀¹x² dx -> integral(x², x, 0, 1)", () => {
      expect(expr("\\int_{0}^{1}x^2\\,dx")).toBe("integral(x², x, 0, 1)");
    });

    it("∫₀^π sen(x) dx -> integral(sin(x), x, 0, π)", () => {
      expect(expr("\\int_{0}^{\\pi}\\sin(x)\\,dx")).toBe("integral(sin(x), x, 0, π)");
    });

    it("∫₁²x dx -> integral(x, x, 1, 2)", () => {
      expect(expr("\\int_{1}^{2}x\\,dx")).toBe("integral(x, x, 1, 2)");
    });

    it("integral definida sem limite inferior -> incomplete", () => {
      expect(mathFieldLatexToBackendExpression("\\int_{\\placeholder{}}^{1}x^2\\,dx")).toEqual({
        ok: false,
        reason: "incomplete",
      });
    });

    it("integral definida sem limite superior -> incomplete", () => {
      expect(mathFieldLatexToBackendExpression("\\int_{0}^{\\placeholder{}}x^2\\,dx")).toEqual({
        ok: false,
        reason: "incomplete",
      });
    });

    it("integral definida sem integrando -> incomplete", () => {
      expect(mathFieldLatexToBackendExpression("\\int_{0}^{1}\\placeholder{}\\,dx")).toEqual({
        ok: false,
        reason: "incomplete",
      });
    });
  });

  describe("Sprint V3.0.1 — Limite (\\lim_{x\\to p} ...)", () => {
    it("lim x→0 sin(x)/x -> limite((sin(x))/x, x, 0)", () => {
      expect(expr("\\lim_{x\\to0}\\frac{\\sin(x)}{x}")).toBe("limite((sin(x))/x, x, 0)");
    });

    it("lim x→2 (x²-4)/(x-2) -> limite((x²-4)/(x-2), x, 2)", () => {
      expect(expr("\\lim_{x\\to2}\\frac{x^2-4}{x-2}")).toBe("limite((x²-4)/(x-2), x, 2)");
    });

    it("lim x→∞ 1/x — infinito representável no MathField — -> limite(1/x, x, ∞)", () => {
      expect(expr("\\lim_{x\\to\\infty}\\frac{1}{x}")).toBe("limite(1/x, x, ∞)");
    });

    it("limite sem destino (slot vazio) -> incomplete", () => {
      expect(mathFieldLatexToBackendExpression("\\lim_{x\\to\\placeholder{}}x")).toEqual({
        ok: false,
        reason: "incomplete",
      });
    });

    it("limite sem expressão (slot vazio) -> incomplete", () => {
      expect(mathFieldLatexToBackendExpression("\\lim_{x\\to0}\\placeholder{}")).toEqual({
        ok: false,
        reason: "incomplete",
      });
    });
  });

  describe("Sprint V3.0.1 — Somatório (\\sum_{i=a}^{b} ...)", () => {
    it("Σ i=1..10 i -> Σ(i=1..10) i", () => {
      expect(expr("\\sum_{i=1}^{10}i")).toBe("Σ(i=1..10) i");
    });

    it("Σ i=1..10 i² -> Σ(i=1..10) i²", () => {
      expect(expr("\\sum_{i=1}^{10}i^2")).toBe("Σ(i=1..10) i²");
    });

    it("Σ k=1..5 k — índice diferente de i, já suportado pelo backend — -> Σ(k=1..5) k", () => {
      expect(expr("\\sum_{k=1}^{5}k")).toBe("Σ(k=1..5) k");
    });

    it("somatório sem índice -> incomplete", () => {
      expect(mathFieldLatexToBackendExpression("\\sum_{\\placeholder{}=1}^{10}i")).toEqual({
        ok: false,
        reason: "incomplete",
      });
    });

    it("somatório sem limite inferior -> incomplete", () => {
      expect(mathFieldLatexToBackendExpression("\\sum_{i=\\placeholder{}}^{10}i")).toEqual({
        ok: false,
        reason: "incomplete",
      });
    });

    it("somatório sem limite superior -> incomplete", () => {
      expect(mathFieldLatexToBackendExpression("\\sum_{i=1}^{\\placeholder{}}i")).toEqual({
        ok: false,
        reason: "incomplete",
      });
    });

    it("somatório sem expressão -> incomplete", () => {
      expect(mathFieldLatexToBackendExpression("\\sum_{i=1}^{10}\\placeholder{}")).toEqual({
        ok: false,
        reason: "incomplete",
      });
    });

    it("limites não-inteiros são rejeitados como unsupported — o backend só aceita inteiro literal (summation/parsing.py:_parse_bound)", () => {
      expect(mathFieldLatexToBackendExpression("\\sum_{i=1}^{n}i")).toEqual({ ok: false, reason: "unsupported" });
      expect(
        mathFieldLatexToBackendExpression("\\sum_{i=\\frac{1}{2}}^{10}i")
      ).toEqual({ ok: false, reason: "unsupported" });
    });
  });

  describe("Sprint V3.0.1 — regressão da V3.0/V3.0.1a (categoria Básico não pode quebrar)", () => {
    it.each([
      ["x²-4=0", "{ x}^{2}-4 = 0"],
      ["2x+4=10", "2~ x+4 = 10"],
      ["(x+1)³", "{\\left( x+1\\right)}^{3}"],
      ["1/2+1/3", "\\frac{1}{2}+\\frac{1}{3}"],
      ["√(16)", "\\sqrt{16}"],
      ["π/2", "\\frac{\\pi}{2}"],
    ])("%s continua aceito", (expected, latex) => {
      expect(expr(latex)).toBe(expected);
    });
  });
});
