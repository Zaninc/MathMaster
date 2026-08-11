import { describe, expect, it } from "vitest";

import {
  mathFieldLatexToBackendExpression,
  repairMathLiveEnvironmentEscape,
  repairMathLiveInput,
  repairNestedFenceCorruption,
  repairNestedStructuralTemplate,
} from "./mathfield-to-backend";
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

  it("comando LaTeX fora do catálogo (ex. logaritmo) devolve reason=unsupported, nunca lança", () => {
    // Integral/somatório SAÍRAM do catálogo "fora de escopo" na Sprint
    // V3.0.1 (Structured Calculus Input); sistema/matriz/determinante
    // SAÍRAM do catálogo "fora de escopo" na Sprint V3.0.2 — ver describes
    // dedicados abaixo. log/ln (categoria Funções) continuam fora.
    expect(mathFieldLatexToBackendExpression("\\log(x)")).toEqual({
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

  // --- Sprint V3.0.2 (Structured Algebra Input) ----------------------------
  //
  // Sistemas (`\begin{cases}`), matrizes (`\begin{bmatrix|pmatrix|matrix}`),
  // determinante (`\begin{vmatrix}` — barras — e `\det(...)` — a notação
  // que `previewLatex` já produz, reconhecida pra exemplos rápidos) e
  // `\operatorname{inv|transpose}(...)`. Cada linha/célula reaproveita o
  // MESMO `parseSubExpression` (todos os casos com potência/fração/raiz/π
  // abaixo provam isso — nenhum parser de matriz/sistema separado). Todos
  // confirmados contra o backend real rodando (ver relatório da sprint).
  describe("Sprint V3.0.2 — Sistemas lineares (\\begin{cases}...\\end{cases})", () => {
    it("sistema 2x2 -> eq1;eq2", () => {
      expect(expr("\\begin{cases}x+y=5\\\\x-y=1\\end{cases}")).toBe("x+y=5;x-y=1");
    });

    it("sistema 2x2 não-linear (x² na primeira equação) -> eq1;eq2, sem alterar nada", () => {
      expect(expr("\\begin{cases}x^2+y=5\\\\x-y=1\\end{cases}")).toBe("x²+y=5;x-y=1");
    });

    it("sistema 3x3 -> eq1;eq2;eq3", () => {
      expect(expr("\\begin{cases}x+y+z=6\\\\2x-y+z=3\\\\x+2y-z=2\\end{cases}")).toBe("x+y+z=6;2x-y+z=3;x+2y-z=2");
    });

    it("sistema com potência/fração numa equação — mesmo parser de sempre, de graça", () => {
      expect(expr("\\begin{cases}x^2+y=5\\\\x-\\frac{y}{2}=1\\end{cases}")).toBe("x²+y=5;x-y/2=1");
    });

    it("regressão (forma real do mathjs, previewLatex): sistema 2x2/3x3 com espaços/til continuam aceitos", () => {
      expect(expr("\\begin{cases} x+ y = 5\\\\ x- y = 1\\end{cases}")).toBe("x+y=5;x-y=1");
      expect(expr("\\begin{cases} x+ y+ z = 6\\\\2~ x- y+ z = 3\\\\ x+2~ y- z = 2\\end{cases}")).toBe(
        "x+y+z=6;2x-y+z=3;x+2y-z=2"
      );
    });

    it("sistema com equação vazia (slot vazio) -> incomplete, nunca envia request malformada", () => {
      expect(mathFieldLatexToBackendExpression("\\begin{cases}x+y=5\\\\\\placeholder{}\\end{cases}")).toEqual({
        ok: false,
        reason: "incomplete",
      });
    });

    it("sistema com um LADO da equação vazio -> incomplete", () => {
      expect(mathFieldLatexToBackendExpression("\\begin{cases}x+y=5\\\\x-y=\\placeholder{}\\end{cases}")).toEqual({
        ok: false,
        reason: "incomplete",
      });
    });
  });

  describe("Sprint V3.0.2 — Matrizes (\\begin{bmatrix}...\\end{bmatrix})", () => {
    it("matriz 2x2 -> [[c,c],[c,c]] (sintaxe literal de matrix/parsing.py)", () => {
      expect(expr("\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}")).toBe("[[1,2],[3,4]]");
    });

    it("matriz 3x3", () => {
      expect(expr("\\begin{bmatrix}1&2&3\\\\4&5&6\\\\7&8&9\\end{bmatrix}")).toBe("[[1,2,3],[4,5,6],[7,8,9]]");
    });

    it("pmatrix/matrix (ambientes alternativos do MathLive) geram a mesma sintaxe literal", () => {
      expect(expr("\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}")).toBe("[[1,2],[3,4]]");
      expect(expr("\\begin{matrix}1&2\\\\3&4\\end{matrix}")).toBe("[[1,2],[3,4]]");
    });

    it("célula simbólica (variável, não só número) -> passa como expressão, nunca hardcodada", () => {
      expect(expr("\\begin{bmatrix}x&2\\\\3&x+1\\end{bmatrix}")).toBe("[[x,2],[3,x+1]]");
    });

    it("célula com potência/fração/raiz/π — prova que reaproveita o parser recursivo inteiro, não um parser de célula à parte", () => {
      expect(expr("\\begin{bmatrix}x^2&\\frac{1}{2}\\\\\\sqrt{2}&\\pi\\end{bmatrix}")).toBe(
        "[[x²,1/2],[√(2),π]]"
      );
    });

    it("matriz com célula vazia (2x2 ou 3x3) -> incomplete, nunca envia request malformada", () => {
      expect(mathFieldLatexToBackendExpression("\\begin{bmatrix}1&\\placeholder{}\\\\3&4\\end{bmatrix}")).toEqual({
        ok: false,
        reason: "incomplete",
      });
      expect(
        mathFieldLatexToBackendExpression(
          "\\begin{bmatrix}1&2&3\\\\4&\\placeholder{}&6\\\\7&8&9\\end{bmatrix}"
        )
      ).toEqual({ ok: false, reason: "incomplete" });
    });
  });

  describe("Sprint V3.0.2 — Determinante (\\begin{vmatrix}...\\end{vmatrix} e \\det(...))", () => {
    it("determinante 2x2 (barras, representação visual do ticket) -> det([[c,c],[c,c]])", () => {
      expect(expr("\\begin{vmatrix}1&2\\\\3&4\\end{vmatrix}")).toBe("det([[1,2],[3,4]])");
    });

    it("determinante 3x3", () => {
      expect(expr("\\begin{vmatrix}1&2&3\\\\0&1&4\\\\5&6&0\\end{vmatrix}")).toBe("det([[1,2,3],[0,1,4],[5,6,0]])");
    });

    it("\\det(...) — notação que previewLatex já produz para det(...) digitado/histórico — mesma função, nunca uma segunda", () => {
      expect(expr("\\det\\left(\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}\\right)")).toBe("det([[1,2],[3,4]])");
    });

    it("determinante 2x2/3x3 com célula vazia -> incomplete", () => {
      expect(mathFieldLatexToBackendExpression("\\begin{vmatrix}1&\\placeholder{}\\\\3&4\\end{vmatrix}")).toEqual({
        ok: false,
        reason: "incomplete",
      });
      expect(
        mathFieldLatexToBackendExpression(
          "\\begin{vmatrix}1&2&3\\\\0&\\placeholder{}&4\\\\5&6&0\\end{vmatrix}"
        )
      ).toEqual({ ok: false, reason: "incomplete" });
    });
  });

  describe("Sprint V3.0.2 — Operações matriciais (+, -, *, ^, escalar, inv, transpose)", () => {
    it("soma de matrizes -> A+B", () => {
      expect(expr("\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}+\\begin{bmatrix}5&6\\\\7&8\\end{bmatrix}")).toBe(
        "[[1,2],[3,4]]+[[5,6],[7,8]]"
      );
    });

    it("subtração de matrizes -> A-B", () => {
      expect(expr("\\begin{bmatrix}5&6\\\\7&8\\end{bmatrix}-\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}")).toBe(
        "[[5,6],[7,8]]-[[1,2],[3,4]]"
      );
    });

    it("multiplicação de matrizes -> A*B", () => {
      expect(expr("\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}\\times\\begin{bmatrix}5&6\\\\7&8\\end{bmatrix}")).toBe(
        "[[1,2],[3,4]]*[[5,6],[7,8]]"
      );
    });

    it("potência de matriz -> A^2 (NUNCA o atalho de sobrescrito Unicode — matrix/parsing.py só reconhece '^' literal, e normalize_all já reescreveria '²' para '**2' antes de chegar lá, que o motor de matrizes rejeita)", () => {
      expect(expr("\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}^2")).toBe("[[1,2],[3,4]]^2");
    });

    it("escalar × matriz EXPLÍCITO (\\times) -> 2*A", () => {
      expect(expr("2\\times\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}")).toBe("2*[[1,2],[3,4]]");
    });

    it("escalar × matriz IMPLÍCITO (sem operador, ex. tecla '2A') -> ainda emite '*' explícito — matrix/parsing.py exige, diferente do resto da multiplicação implícita", () => {
      expect(expr("2\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}")).toBe("2*[[1,2],[3,4]]");
    });

    it("inversa -> inv(A)", () => {
      expect(expr("\\operatorname{inv}\\left(\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}\\right)")).toBe(
        "inv([[1,2],[3,4]])"
      );
    });

    it("transposta -> transpose(A)", () => {
      expect(expr("\\operatorname{transpose}\\left(\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}\\right)")).toBe(
        "transpose([[1,2],[3,4]])"
      );
    });
  });

  describe("Sprint V3.0.2 — integração real: previewLatex(texto) -> adapter aceita, pros exemplos rápidos de Álgebra", () => {
    it.each([
      ["[[1,2],[3,4]]", "[[1,2],[3,4]]"],
      ["det([[1,2],[3,4]])", "det([[1,2],[3,4]])"],
      ["x+y=5; x-y=1", "x+y=5;x-y=1"],
      ["x+y+z=6; 2x-y+z=3; x+2y-z=2", "x+y+z=6;2x-y+z=3;x+2y-z=2"],
    ])("%s -> previewLatex -> adapter -> %s", async (text, expected) => {
      const latex = await previewLatex(text);
      expect(latex, text).not.toBeNull();
      expect(expr(latex!)).toBe(expected);
    });
  });

  // --- Hotfix V3.0.2a — MathLive "sai do ambiente inteiro" na barra de espaço ---
  //
  // Causa raiz (confirmada no navegador real, produção): dentro de um
  // `\begin{cases|bmatrix|pmatrix|matrix|vmatrix}`, a barra de espaço do
  // MathLive não sai só do nível mais interno (ex. do expoente de "x^2")
  // — sai da ESTRUTURA INTEIRA de uma vez, deixando o resto do que o
  // usuário digitou órfão, logo depois de `\end{...}`, sem nenhum
  // operador entre eles. Todos os valores de LaTeX abaixo são exatamente
  // os capturados via `math-field.value` real depois de reproduzir cada
  // cenário no navegador (produção, `next build`+`next start`) — nunca
  // LaTeX idealizado escrito à mão.
  describe("Hotfix V3.0.2a — repara o pulo de ambiente causado pela barra de espaço do MathLive", () => {
    describe("repairMathLiveEnvironmentEscape (função pura, testada isolada)", () => {
      it("sistema: devolve o conteúdo órfão pro fim da ÚLTIMA linha com conteúdo real, não pro fim do ambiente", () => {
        expect(repairMathLiveEnvironmentEscape("\\begin{cases}x^2\\\\ \\placeholder{}\\end{cases}-4=0")).toBe(
          "\\begin{cases}x^2-4=0\\\\ \\placeholder{}\\end{cases}"
        );
      });

      it("sistema sem aninhamento (space escapa mesmo sem expoente envolvido)", () => {
        expect(repairMathLiveEnvironmentEscape("\\begin{cases}x\\\\ \\placeholder{}\\end{cases}+y")).toBe(
          "\\begin{cases}x+y\\\\ \\placeholder{}\\end{cases}"
        );
      });

      it("sistema: repara mesmo com o ambiente já 100% preenchido (protege a ÚLTIMA linha, cujo placeholder já foi parcialmente consumido)", () => {
        expect(repairMathLiveEnvironmentEscape("\\begin{cases}x+y=5\\\\ x\\end{cases}-y=1")).toBe(
          "\\begin{cases}x+y=5\\\\ x-y=1\\end{cases}"
        );
      });

      it("matriz: devolve o conteúdo órfão pra célula certa (célula 1,1), não pro fim da matriz", () => {
        expect(
          repairMathLiveEnvironmentEscape(
            "\\begin{bmatrix}x & \\placeholder{}\\\\ \\placeholder{} & \\placeholder{}\\end{bmatrix}+1"
          )
        ).toBe("\\begin{bmatrix}x+1 & \\placeholder{}\\\\ \\placeholder{} & \\placeholder{}\\end{bmatrix}");
      });

      it("nunca ativa numa matriz 100% preenchida — A^2/A+B/2*A continuam intocados (operação legítima, não um pulo)", () => {
        const power = "\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}^2";
        const sum = "\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}+\\begin{bmatrix}5&6\\\\7&8\\end{bmatrix}";
        expect(repairMathLiveEnvironmentEscape(power)).toBe(power);
        expect(repairMathLiveEnvironmentEscape(sum)).toBe(sum);
      });

      it("nunca engole o CONTEÚDO de uma segunda estrutura genuína (matrizA + matrizB) — a captura do órfão sempre para no próximo \\begin{", () => {
        // Cenário composto e de baixa probabilidade (exige a matriz A ainda
        // incompleta E um "+matrizB" genuíno digitado por cima do estado já
        // quebrado) — a segunda matriz nunca é tocada/reescrita; o pior caso
        // é a primeira célula ganhar um "+" sem operando (`"x+"`), que o
        // parser já rejeita com segurança como `incomplete` (nunca crasha,
        // nunca envia request malformada) — confirmado abaixo.
        const latex =
          "\\begin{bmatrix}x & \\placeholder{}\\\\ \\placeholder{} & \\placeholder{}\\end{bmatrix}+\\begin{bmatrix}5&6\\\\7&8\\end{bmatrix}";
        const repaired = repairMathLiveEnvironmentEscape(latex);
        expect(repaired).toContain("\\begin{bmatrix}5&6\\\\7&8\\end{bmatrix}");
        expect(mathFieldLatexToBackendExpression(repaired)).toEqual({ ok: false, reason: "incomplete" });
      });

      it("sem conteúdo órfão nenhum (LaTeX já bem-formado) -> devolve intocado", () => {
        const latex = "\\begin{cases}x+y=5\\\\x-y=1\\end{cases}";
        expect(repairMathLiveEnvironmentEscape(latex)).toBe(latex);
      });
    });

    it("integração: sistema 2x2 totalmente escapado (as duas linhas) -> adapter aceita e converte corretamente", () => {
      expect(expr("\\begin{cases}x+y=5\\\\ x-y=1\\end{cases}")).toBe("x+y=5;x-y=1");
    });

    it("integração: matriz com célula parcialmente escapada -> adapter aceita e converte corretamente", () => {
      expect(
        expr("\\begin{bmatrix}x+1 & 2\\\\ 3 & 4\\end{bmatrix}")
      ).toBe("[[x+1,2],[3,4]]");
    });

    it("integração: sistema com linha AINDA genuinamente vazia continua incomplete (o reparo nunca inventa conteúdo)", () => {
      expect(mathFieldLatexToBackendExpression("\\begin{cases}x^2-4=0\\\\ \\placeholder{}\\end{cases}")).toEqual({
        ok: false,
        reason: "incomplete",
      });
    });
  });

  // --- Hotfix V3.0.2c — Matrix Expression Hardening ------------------------
  //
  // PROBLEMA CRÍTICO 1 (matriz aninhada) e PROBLEMA CRÍTICO 2/3 (corrupção
  // de cerca `\left/\right` em inv/transpose+matriz). Todos os LaTeX
  // abaixo são exatamente os capturados via `math-field.value` real no
  // navegador (produção), reproduzindo cada cenário clicando as teclas de
  // verdade — nunca LaTeX idealizado escrito à mão.
  describe("Hotfix V3.0.2c — Matrix Expression Hardening", () => {
    describe("repairNestedStructuralTemplate (PROBLEMA CRÍTICO 1 — matriz aninhada)", () => {
      it("matriz clicada duas vezes sem sair da célula -> vira estrutura IRMÃ, nunca aninhada", () => {
        const nested =
          "\\begin{bmatrix}1 & 2\\\\ 3 & 4\\begin{bmatrix}\\placeholder{} & \\placeholder{}\\\\ \\placeholder{} & \\placeholder{}\\end{bmatrix}\\end{bmatrix}";
        expect(repairNestedStructuralTemplate(nested)).toBe(
          "\\begin{bmatrix}1 & 2\\\\ 3 & 4\\end{bmatrix}\\begin{bmatrix}\\placeholder{} & \\placeholder{}\\\\ \\placeholder{} & \\placeholder{}\\end{bmatrix}"
        );
      });

      it("sistema clicado duas vezes sem sair da célula -> mesmo tratamento (qualquer ambiente aninhado em qualquer outro)", () => {
        const nested = "\\begin{cases}x\\begin{cases}\\placeholder{}\\\\\\placeholder{}\\end{cases}\\end{cases}";
        expect(repairNestedStructuralTemplate(nested)).toBe(
          "\\begin{cases}x\\end{cases}\\begin{cases}\\placeholder{}\\\\\\placeholder{}\\end{cases}"
        );
      });

      it("negativo: matriz + matriz já como irmãs (cursor movido corretamente) permanece intocada", () => {
        const siblings = "\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}\\begin{bmatrix}5&6\\\\7&8\\end{bmatrix}";
        expect(repairNestedStructuralTemplate(siblings)).toBe(siblings);
      });

      it("negativo: nenhum ambiente estruturado presente -> intocado", () => {
        const plain = "x^2-4=0";
        expect(repairNestedStructuralTemplate(plain)).toBe(plain);
      });
    });

    describe("repairNestedFenceCorruption (PROBLEMA CRÍTICO 2/3 — \\left/\\right corrompido)", () => {
      it("template recém-inserido (A⁻¹ + Matriz, ANTES de digitar) -- \\right) já deslocado, sem \\right.", () => {
        const fresh =
          "\\operatorname{\\mathrm{inv}}\\left(\\begin{bmatrix}\\right)\\placeholder{} & \\placeholder{}\\\\ \\placeholder{} & \\placeholder{}\\end{bmatrix}";
        expect(repairNestedFenceCorruption(fresh)).toBe(
          "\\operatorname{\\mathrm{inv}}\\left(\\begin{bmatrix}\\placeholder{} & \\placeholder{}\\\\ \\placeholder{} & \\placeholder{}\\end{bmatrix}\\right)"
        );
      });

      it("depois de digitar '1' no primeiro placeholder -- \\right) e \\right. deslocados", () => {
        const typed =
          "\\operatorname{\\mathrm{inv}}\\left(\\begin{bmatrix}\\right)1\\right. & \\placeholder{}\\\\ \\placeholder{} & \\placeholder{}\\end{bmatrix}";
        expect(repairNestedFenceCorruption(typed)).toBe(
          "\\operatorname{\\mathrm{inv}}\\left(\\begin{bmatrix}1 & \\placeholder{}\\\\ \\placeholder{} & \\placeholder{}\\end{bmatrix}\\right)"
        );
      });

      it("mesma assinatura com Aᵀ (transpose) e outro conteúdo digitado ('x')", () => {
        const typed =
          "\\operatorname{\\mathrm{transpose}}\\left(\\begin{bmatrix}\\right)x\\right. & \\placeholder{}\\\\ \\placeholder{} & \\placeholder{}\\end{bmatrix}";
        expect(repairNestedFenceCorruption(typed)).toBe(
          "\\operatorname{\\mathrm{transpose}}\\left(\\begin{bmatrix}x & \\placeholder{}\\\\ \\placeholder{} & \\placeholder{}\\end{bmatrix}\\right)"
        );
      });

      it("negativo: nunca ativa sem um \\left( antes -- \\right) sozinho, fora de contexto, fica intocado", () => {
        const noFence = "\\begin{bmatrix}\\right)1&2\\\\3&4\\end{bmatrix}";
        expect(repairNestedFenceCorruption(noFence)).toBe(noFence);
      });

      it("negativo: LaTeX bem-formado (sem nenhum \\right) deslocado) nunca é alterado", () => {
        const wellFormed = "\\operatorname{inv}\\left(\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}\\right)";
        expect(repairNestedFenceCorruption(wellFormed)).toBe(wellFormed);
      });
    });

    describe("canonicalização de \\operatorname{inv|transpose|det} (grafias reais do MathLive)", () => {
      it.each([
        ["\\operatorname{inv}", "inv"],
        ["\\operatorname{\\mathrm{inv}}", "inv"],
        ["\\mathrm{inv}", "inv"],
        ["\\operatorname{transpose}", "transpose"],
        ["\\operatorname{\\mathrm{transpose}}", "transpose"],
        ["\\mathrm{transpose}", "transpose"],
        ["\\operatorname{det}", "det"],
        ["\\operatorname{\\mathrm{det}}", "det"],
        ["\\mathrm{det}", "det"],
      ] as const)("%s(matriz) -> %s(...)", (command, name) => {
        expect(expr(`${command}\\left(\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}\\right)`)).toBe(
          `${name}([[1,2],[3,4]])`
        );
      });

      it("\\det continua funcionando como comando nativo separado (não precisa de \\operatorname)", () => {
        expect(expr("\\det\\left(\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}\\right)")).toBe("det([[1,2],[3,4]])");
      });
    });

    describe("integração completa: PROBLEMA CRÍTICO 1 (matriz adjacente a matriz)", () => {
      it("adjacência estruturada (cursor movido corretamente pra fora) -> multiplicação implícita", () => {
        const adjacent = "\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}\\begin{bmatrix}5&6\\\\7&8\\end{bmatrix}";
        expect(expr(adjacent)).toBe("[[1,2],[3,4]]*[[5,6],[7,8]]");
      });

      it("matriz clicada duas vezes SEM sair da célula (aninhada) -> mesmo resultado, depois do reparo", () => {
        const nested =
          "\\begin{bmatrix}1 & 2\\\\ 3 & 4\\begin{bmatrix}5 & 6\\\\ 7 & 8\\end{bmatrix}\\end{bmatrix}";
        expect(expr(nested)).toBe("[[1,2],[3,4]]*[[5,6],[7,8]]");
      });

      it("matriz aninhada AINDA incompleta -> incomplete, nunca crasha, nunca envia request malformada", () => {
        const nestedIncomplete =
          "\\begin{bmatrix}1 & 2\\\\ 3 & 4\\begin{bmatrix}\\placeholder{} & 6\\\\ 7 & 8\\end{bmatrix}\\end{bmatrix}";
        expect(mathFieldLatexToBackendExpression(nestedIncomplete)).toEqual({ ok: false, reason: "incomplete" });
      });
    });

    describe("integração completa: PROBLEMA CRÍTICO 2/3 (inv/transpose + matriz, ponta a ponta)", () => {
      it("A⁻¹ + Matriz 2×2, LaTeX real capturado ANTES de digitar (bem-formado) -> incomplete", () => {
        const fresh =
          "\\operatorname{\\mathrm{inv}}\\left(\\begin{bmatrix}\\placeholder{} & \\placeholder{}\\\\ \\placeholder{} & \\placeholder{}\\end{bmatrix}\\right)";
        expect(mathFieldLatexToBackendExpression(fresh)).toEqual({ ok: false, reason: "incomplete" });
      });

      it("A⁻¹ + Matriz 2×2, célula 1,1 digitada com corrupção de cerca -> ainda incomplete (resto vazio), nunca crasha", () => {
        const partiallyTyped =
          "\\operatorname{\\mathrm{inv}}\\left(\\begin{bmatrix}\\right)1\\right. & \\placeholder{}\\\\ \\placeholder{} & \\placeholder{}\\end{bmatrix}";
        expect(mathFieldLatexToBackendExpression(partiallyTyped)).toEqual({ ok: false, reason: "incomplete" });
      });

      it("A⁻¹ + Matriz 2×2 totalmente preenchida (com a corrupção de cerca na célula 1,1) -> resolve corretamente", () => {
        const fullyTyped =
          "\\operatorname{\\mathrm{inv}}\\left(\\begin{bmatrix}\\right)1\\right. & 2\\\\ 3 & 4\\end{bmatrix}";
        expect(expr(fullyTyped)).toBe("inv([[1,2],[3,4]])");
      });

      it("Aᵀ + Matriz 2×2 totalmente preenchida -> resolve corretamente", () => {
        const fullyTyped =
          "\\operatorname{\\mathrm{transpose}}\\left(\\begin{bmatrix}\\right)1\\right. & 2\\\\ 3 & 4\\end{bmatrix}";
        expect(expr(fullyTyped)).toBe("transpose([[1,2],[3,4]])");
      });
    });

    describe("negativos obrigatórios — nunca canonicalizar incorretamente", () => {
      it("A + B nunca vira A*B", () => {
        expect(expr("\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}+\\begin{bmatrix}5&6\\\\7&8\\end{bmatrix}")).toBe(
          "[[1,2],[3,4]]+[[5,6],[7,8]]"
        );
      });

      it("det(A)+2 nunca vira det(A*2) -- soma acontece FORA da função, nunca dentro", () => {
        expect(expr("\\det\\left(\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}\\right)+2")).toBe("det([[1,2],[3,4]])+2");
      });

      it("matriz totalmente preenchida + operador legítimo nunca é tocada pelo pipeline de reparo", () => {
        const legit = "\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}^2";
        expect(repairMathLiveInput(legit)).toBe(legit);
      });

      it("duas matrizes SEPARADAS por operador legítimo nunca são fundidas em uma só chamada", () => {
        const legit = "\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}*\\begin{bmatrix}5&6\\\\7&8\\end{bmatrix}";
        expect(repairMathLiveInput(legit)).toBe(legit);
      });

      it("escalar + matriz (operação real, não confundida com adjacência) continua explícita", () => {
        expect(expr("2\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}")).toBe("2*[[1,2],[3,4]]");
      });

      it("comando LaTeX desconhecido continua unsupported, nunca lança", () => {
        expect(() => mathFieldLatexToBackendExpression("\\unknowncommand{x}")).not.toThrow();
        expect(mathFieldLatexToBackendExpression("\\unknowncommand{x}").ok).toBe(false);
      });
    });

    describe("célula de matriz com estruturas — potência, fração, raiz (regressão V3.0.2, reconfirmada)", () => {
      it("célula com potência/fração/raiz/π dentro de A⁻¹ (composição completa)", () => {
        expect(
          expr(
            "\\operatorname{inv}\\left(\\begin{bmatrix}x^2&\\frac{1}{2}\\\\\\sqrt{2}&\\pi\\end{bmatrix}\\right)"
          )
        ).toBe("inv([[x²,1/2],[√(2),π]])");
      });
    });
  });
});
