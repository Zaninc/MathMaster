import { describe, expect, it } from "vitest";

import { KEYBOARD_CATEGORIES } from "./keyboard";

describe("KEYBOARD_CATEGORIES", () => {
  it("toda categoria tem pelo menos uma tecla", () => {
    for (const category of KEYBOARD_CATEGORIES) {
      expect(category.keys.length).toBeGreaterThan(0);
    }
  });

  it("toda tecla tem texto de inserção não vazio e cursorOffset dentro do range válido", () => {
    for (const category of KEYBOARD_CATEGORIES) {
      for (const key of category.keys) {
        expect(key.insert.length).toBeGreaterThan(0);
        expect(key.cursorOffset).toBeGreaterThanOrEqual(0);
        expect(key.cursorOffset).toBeLessThanOrEqual(key.insert.length);
      }
    }
  });

  it("ids de categoria são únicos", () => {
    const ids = KEYBOARD_CATEGORIES.map((category) => category.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * As formas abaixo foram validadas contra o backend real (2026-07-18):
   * log()/ln()/exp() são aceitos nativamente; log(x, a) e e**x NÃO são
   * ("e" solto é variável, não Euler) — este teste impede regressão para
   * essas formas não suportadas.
   */
  it("teclas de funções inserem apenas sintaxe que o backend aceita", () => {
    const funcoes = KEYBOARD_CATEGORIES.find((category) => category.id === "funcoes");
    const byLabel = new Map(funcoes?.keys.map((key) => [key.label, key]));

    expect(byLabel.get("log")?.insert).toBe("log()");
    expect(byLabel.get("ln")?.insert).toBe("ln()");
    expect(byLabel.get("logₐ")?.insert).toBe("log()/log()");
    // Template visual (regra central: o campo mostra o que o botão
    // promete) — `normalizeForBackend` traduz para exp( só no envio.
    expect(byLabel.get("eˣ")?.insert).toBe("eˣ()");
    expect(byLabel.get("eˣ")?.cursorOffset).toBe(3);

    for (const key of funcoes?.keys ?? []) {
      expect(key.insert).not.toMatch(/e\*\*/);
      expect(key.insert).not.toMatch(/log\([^)]*,/);
    }
  });

  it("toda tecla com latex tem ariaLabel (o KaTeX visual é aria-hidden no botão)", () => {
    for (const category of KEYBOARD_CATEGORIES) {
      for (const key of category.keys) {
        if (key.latex !== undefined) {
          expect(key.ariaLabel, `${category.id}/${key.label}`).toBeDefined();
          expect(key.latex.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("teclas promovidas a LaTeX usam a notação esperada", () => {
    const byLabel = new Map(
      KEYBOARD_CATEGORIES.flatMap((category) => category.keys).map((key) => [key.label, key])
    );
    expect(byLabel.get("x²")?.latex).toBe("x^2");
    expect(byLabel.get("a/b")?.latex).toBe("\\dfrac{a}{b}");
    expect(byLabel.get("√")?.latex).toBe("\\sqrt{x}");
    expect(byLabel.get("logₐ")?.latex).toBe("\\log_a");
    expect(byLabel.get("eˣ")?.latex).toBe("e^x");
    expect(byLabel.get("d/dx")?.latex).toBe("\\dfrac{d}{dx}");
    expect(byLabel.get("lim")?.latex).toBe("\\lim");
  });

  it("cursor das teclas de log/ln/exp cai dentro do primeiro parêntese", () => {
    const funcoes = KEYBOARD_CATEGORIES.find((category) => category.id === "funcoes");
    for (const label of ["log", "ln", "logₐ", "eˣ"]) {
      const key = funcoes?.keys.find((candidate) => candidate.label === label);
      expect(key, label).toBeDefined();
      expect(key!.insert[key!.cursorOffset - 1], label).toBe("(");
    }
  });

  /**
   * Regra central (2026-07-18): o input mostra o que o botão promete —
   * raízes em Unicode visual (o backend as aceita NATIVAMENTE: √(9)->3,
   * ∛(8)->2, validado) e templates ⁿ/eˣ( traduzidos só na fronteira de
   * envio. Nenhuma tecla insere operador cru sem operandos.
   */
  it("raízes inserem o glifo Unicode do botão com cursor dentro do parêntese", () => {
    const byLabel = new Map(
      KEYBOARD_CATEGORIES.flatMap((category) => category.keys).map((key) => [key.label, key])
    );
    expect(byLabel.get("√")?.insert).toBe("√()");
    expect(byLabel.get("√")?.cursorOffset).toBe(2);
    expect(byLabel.get("∛")?.insert).toBe("∛()");
    expect(byLabel.get("∛")?.cursorOffset).toBe(2);
  });

  it("xⁿ insere apenas o glifo sobrescrito ⁿ, sem parênteses automáticos e sem envolver seleção (mesmo padrão de x²/x³)", () => {
    const power = KEYBOARD_CATEGORIES.flatMap((category) => category.keys).find(
      (key) => key.label === "xⁿ"
    );
    expect(power?.insert).toBe("ⁿ");
    expect(power?.cursorOffset).toBe(1);
    expect(power?.selection).toBeUndefined();
  });

  it("tecla Σ (Símbolos) insere a sintaxe principal do somatório já preenchida", () => {
    const simbolos = KEYBOARD_CATEGORIES.find((category) => category.id === "simbolos");
    const key = simbolos?.keys.find((candidate) => candidate.label === "Σ");
    expect(key).toBeDefined();
    expect(key!.insert).toBe("Σ(i=1..10) i");
    expect(key!.cursorOffset).toBe(key!.insert.length);
    expect(key!.latex).toBe("\\sum_{i=1}^{n}");
    expect(key!.ariaLabel).toBeDefined();
  });

  it("tecla de matriz (Álgebra) insere o template 2x2 com cursor no primeiro elemento", () => {
    const algebra = KEYBOARD_CATEGORIES.find((category) => category.id === "algebra");
    const key = algebra?.keys.find((candidate) => candidate.label === "[[ ]]");
    expect(key).toBeDefined();
    expect(key!.insert).toBe("[[,],[,]]");
    expect(key!.cursorOffset).toBe(2);
    // Posição do cursor cai exatamente entre "[[" e a primeira vírgula —
    // o primeiro slot de elemento vazio.
    expect(key!.insert.slice(0, key!.cursorOffset)).toBe("[[");
    expect(key!.insert[key!.cursorOffset]).toBe(",");
    expect(key!.latex).toContain("\\begin{bmatrix}");
    expect(key!.ariaLabel).toBeDefined();
  });

  it("teclas de operações matriciais (Álgebra) aparecem na ordem [[ ]] -> det -> inversa -> transposta", () => {
    const algebra = KEYBOARD_CATEGORIES.find((category) => category.id === "algebra");
    const labels = algebra?.keys.map((key) => key.label) ?? [];
    const matrixLabels = labels.filter((label) => ["[[ ]]", "det(A)", "A⁻¹", "Aᵀ"].includes(label));
    expect(matrixLabels).toEqual(["[[ ]]", "det(A)", "A⁻¹", "Aᵀ"]);
  });

  it("tecla det (Álgebra) insere det() com cursor entre os parênteses e label KaTeX \\det(A)", () => {
    const algebra = KEYBOARD_CATEGORIES.find((category) => category.id === "algebra");
    const key = algebra?.keys.find((candidate) => candidate.label === "det(A)");
    expect(key).toBeDefined();
    expect(key!.insert).toBe("det()");
    expect(key!.insert[key!.cursorOffset - 1]).toBe("(");
    expect(key!.insert[key!.cursorOffset]).toBe(")");
    expect(key!.latex).toBe("\\det(A)");
    expect(key!.ariaLabel).toBeDefined();
  });

  it("tecla inversa (Álgebra) insere inv() com cursor entre os parênteses e label KaTeX A^{-1}", () => {
    const algebra = KEYBOARD_CATEGORIES.find((category) => category.id === "algebra");
    const key = algebra?.keys.find((candidate) => candidate.label === "A⁻¹");
    expect(key).toBeDefined();
    expect(key!.insert).toBe("inv()");
    expect(key!.insert[key!.cursorOffset - 1]).toBe("(");
    expect(key!.insert[key!.cursorOffset]).toBe(")");
    expect(key!.latex).toBe("A^{-1}");
    expect(key!.ariaLabel).toBeDefined();
  });

  it("tecla transposta (Álgebra) insere transpose() com cursor entre os parênteses e label KaTeX A^{T}", () => {
    const algebra = KEYBOARD_CATEGORIES.find((category) => category.id === "algebra");
    const key = algebra?.keys.find((candidate) => candidate.label === "Aᵀ");
    expect(key).toBeDefined();
    expect(key!.insert).toBe("transpose()");
    expect(key!.insert[key!.cursorOffset - 1]).toBe("(");
    expect(key!.insert[key!.cursorOffset]).toBe(")");
    expect(key!.latex).toBe("A^{T}");
    expect(key!.ariaLabel).toBeDefined();
  });

  it("nenhuma tecla matricial insere ^-1 ou ^T (sintaxe não suportada pelo parser)", () => {
    const algebra = KEYBOARD_CATEGORIES.find((category) => category.id === "algebra");
    for (const key of algebra?.keys ?? []) {
      expect(key.insert).not.toContain("^-1");
      expect(key.insert).not.toContain("^T");
    }
  });

  it("tecla de sistema linear (Álgebra) vem depois de det/inversa/transposta e insere um exemplo completo com cursor no fim", () => {
    const algebra = KEYBOARD_CATEGORIES.find((category) => category.id === "algebra");
    const labels = algebra?.keys.map((key) => key.label) ?? [];
    const relevantLabels = labels.filter((label) =>
      ["det(A)", "A⁻¹", "Aᵀ", "Sistema linear"].includes(label)
    );
    expect(relevantLabels).toEqual(["det(A)", "A⁻¹", "Aᵀ", "Sistema linear"]);

    const key = algebra?.keys.find((candidate) => candidate.label === "Sistema linear");
    expect(key).toBeDefined();
    // Mesma sintaxe multilinha que o backend já aceita nativamente
    // (`equations/dispatcher.py`: "\n"/";" separam equações de um sistema).
    expect(key!.insert).toBe("x+y=5\nx-y=1");
    expect(key!.cursorOffset).toBe(key!.insert.length);
    expect(key!.latex).toBe("\\begin{cases}x+y=5\\\\x-y=1\\end{cases}");
    expect(key!.ariaLabel).toBeDefined();
  });

  it("tecla i (Símbolos) insere a unidade imaginária minúscula", () => {
    const simbolos = KEYBOARD_CATEGORIES.find((category) => category.id === "simbolos");
    const key = simbolos?.keys.find((candidate) => candidate.label === "i");
    expect(key).toBeDefined();
    expect(key!.insert).toBe("i");
    expect(key!.cursorOffset).toBe(1);
    expect(key!.latex).toBe("i");
    expect(key!.ariaLabel).toBeDefined();
  });

  it("teclas de polinômios (Álgebra) inserem a chamada com parênteses vazios e cursor dentro deles", () => {
    const algebra = KEYBOARD_CATEGORIES.find((category) => category.id === "algebra");
    const byLabel = new Map(algebra?.keys.map((key) => [key.label, key]));

    const unary: Array<[string, string]> = [
      ["fatorar(x)", "fatorar()"],
      ["expandir(x)", "expandir()"],
      ["simplificar(x)", "simplificar()"],
      ["grau(x)", "grau()"],
      ["raízes(x)", "raizes()"],
      ["coeficientes(x)", "coeficientes()"],
    ];
    for (const [label, insert] of unary) {
      const key = byLabel.get(label);
      expect(key, label).toBeDefined();
      expect(key!.insert).toBe(insert);
      expect(key!.insert[key!.cursorOffset - 1]).toBe("(");
      expect(key!.insert[key!.cursorOffset]).toBe(")");
      expect(key!.ariaLabel).toBeDefined();
      expect(key!.latex).toBeDefined();
    }
  });

  it("tecla de divisão de polinômios (Álgebra) insere o template com 2 argumentos e cursor no primeiro", () => {
    const algebra = KEYBOARD_CATEGORIES.find((category) => category.id === "algebra");
    const key = algebra?.keys.find((candidate) => candidate.label === "divisão(a,b)");
    expect(key).toBeDefined();
    expect(key!.insert).toBe("divisao(,)");
    expect(key!.insert[key!.cursorOffset - 1]).toBe("(");
    expect(key!.insert[key!.cursorOffset]).toBe(",");
    expect(key!.ariaLabel).toBeDefined();
    expect(key!.latex).toBeDefined();
  });

  it("teclas de polinômios (Álgebra) inserem sempre a forma ASCII (raizes/divisao, nunca acentuada)", () => {
    const algebra = KEYBOARD_CATEGORIES.find((category) => category.id === "algebra");
    const raizesKey = algebra?.keys.find((candidate) => candidate.label === "raízes(x)");
    const divisaoKey = algebra?.keys.find((candidate) => candidate.label === "divisão(a,b)");
    expect(raizesKey?.insert).toBe("raizes()");
    expect(divisaoKey?.insert).toBe("divisao(,)");
  });

  it("teclas de polinômios (Álgebra) vêm depois de Sistema linear", () => {
    const algebra = KEYBOARD_CATEGORIES.find((category) => category.id === "algebra");
    const labels = algebra?.keys.map((key) => key.label) ?? [];
    const relevantLabels = labels.filter((label) =>
      [
        "Sistema linear",
        "fatorar(x)",
        "expandir(x)",
        "simplificar(x)",
        "grau(x)",
        "raízes(x)",
        "coeficientes(x)",
        "divisão(a,b)",
      ].includes(label)
    );
    expect(relevantLabels).toEqual([
      "Sistema linear",
      "fatorar(x)",
      "expandir(x)",
      "simplificar(x)",
      "grau(x)",
      "raízes(x)",
      "coeficientes(x)",
      "divisão(a,b)",
    ]);
  });

  // --- Sprint V2.7 (Motor de Combinatória) -------------------------------

  it("a aba Combinatória existe, entre Geometria e Probabilidade, com as 5 teclas da sprint", () => {
    const ids = KEYBOARD_CATEGORIES.map((category) => category.id);
    expect(ids.indexOf("combinatoria")).toBe(ids.indexOf("geometria") + 1);
    // Sprint V2.8 — "probabilidade" entra logo depois de "combinatoria",
    // empurrando "simbolos" mais uma posição (ver bloco de testes dedicado
    // abaixo, "Sprint V2.8 (Motor de Probabilidade)").
    expect(ids.indexOf("probabilidade")).toBe(ids.indexOf("combinatoria") + 1);

    const combinatoria = KEYBOARD_CATEGORIES.find((category) => category.id === "combinatoria");
    expect(combinatoria?.label).toBe("Combinatória");
    expect(combinatoria?.keys.map((key) => key.insert)).toEqual([
      "fatorial()",
      "permutacao()",
      "arranjo(,)",
      "combinacao(,)",
      "permutacao_repeticao(,)",
    ]);
  });

  it("teclas unárias de combinatória inserem parênteses vazios com cursor dentro", () => {
    const combinatoria = KEYBOARD_CATEGORIES.find((category) => category.id === "combinatoria");
    for (const insert of ["fatorial()", "permutacao()"]) {
      const key = combinatoria?.keys.find((candidate) => candidate.insert === insert);
      expect(key, insert).toBeDefined();
      expect(key!.insert[key!.cursorOffset - 1]).toBe("(");
      expect(key!.insert[key!.cursorOffset]).toBe(")");
      expect(key!.ariaLabel).toBeDefined();
      expect(key!.latex).toBeDefined();
    }
  });

  it("teclas binárias/variádicas de combinatória inserem o template com vírgula e cursor no primeiro argumento", () => {
    const combinatoria = KEYBOARD_CATEGORIES.find((category) => category.id === "combinatoria");
    for (const insert of ["arranjo(,)", "combinacao(,)", "permutacao_repeticao(,)"]) {
      const key = combinatoria?.keys.find((candidate) => candidate.insert === insert);
      expect(key, insert).toBeDefined();
      expect(key!.insert[key!.cursorOffset - 1]).toBe("(");
      expect(key!.insert[key!.cursorOffset]).toBe(",");
      expect(key!.ariaLabel).toBeDefined();
      expect(key!.latex).toBeDefined();
    }
  });

  it("teclas de combinatória inserem sempre a forma ASCII (nunca acentuada) e mostram a notação de livro didático", () => {
    const combinatoria = KEYBOARD_CATEGORIES.find((category) => category.id === "combinatoria");
    for (const key of combinatoria?.keys ?? []) {
      expect(key.insert, key.label).toMatch(/^[a-z_(),]+$/);
    }
    const latexByInsert = new Map(combinatoria?.keys.map((key) => [key.insert, key.latex]));
    expect(latexByInsert.get("fatorial()")).toBe("n!");
    expect(latexByInsert.get("permutacao()")).toBe("P_{n}");
    expect(latexByInsert.get("arranjo(,)")).toBe("A_{n,k}");
    // Sprint V2.7.1 — label visual da combinação em \binom{n}{k}.
    expect(latexByInsert.get("combinacao(,)")).toBe("\\binom{n}{k}");
    expect(latexByInsert.get("permutacao_repeticao(,)")).toBe("P_{n}^{a,b}");
  });

  it("nenhuma tecla insere um operador cru sem operandos", () => {
    for (const category of KEYBOARD_CATEGORIES) {
      for (const key of category.keys) {
        expect(key.insert, `${category.id}/${key.label}`).not.toMatch(/^[*/+\-^]+$/);
      }
    }
  });

  // --- Sprint V2.8 (Motor de Probabilidade) -------------------------------

  it("a aba Probabilidade existe, entre Combinatória e Símbolos, com as 7 teclas da sprint", () => {
    const ids = KEYBOARD_CATEGORIES.map((category) => category.id);
    expect(ids.indexOf("simbolos")).toBe(ids.indexOf("probabilidade") + 1);

    const probabilidade = KEYBOARD_CATEGORIES.find((category) => category.id === "probabilidade");
    expect(probabilidade?.label).toBe("Probabilidade");
    expect(probabilidade?.keys.map((key) => key.insert)).toEqual([
      "probabilidade(,)",
      "complementar()",
      "uniao(,,)",
      "intersecao_independente(,)",
      "condicional(,)",
      "independentes(,,)",
      "binomial(,,)",
    ]);
  });

  it("tecla unária de probabilidade insere parênteses vazios com cursor dentro", () => {
    const probabilidade = KEYBOARD_CATEGORIES.find((category) => category.id === "probabilidade");
    const key = probabilidade?.keys.find((candidate) => candidate.insert === "complementar()");
    expect(key).toBeDefined();
    expect(key!.insert[key!.cursorOffset - 1]).toBe("(");
    expect(key!.insert[key!.cursorOffset]).toBe(")");
    expect(key!.ariaLabel).toBeDefined();
    expect(key!.latex).toBeDefined();
  });

  it("teclas binárias/variádicas de probabilidade inserem o template com vírgula e cursor no primeiro argumento", () => {
    const probabilidade = KEYBOARD_CATEGORIES.find((category) => category.id === "probabilidade");
    for (const insert of [
      "probabilidade(,)",
      "uniao(,,)",
      "intersecao_independente(,)",
      "condicional(,)",
      "independentes(,,)",
      "binomial(,,)",
    ]) {
      const key = probabilidade?.keys.find((candidate) => candidate.insert === insert);
      expect(key, insert).toBeDefined();
      expect(key!.insert[key!.cursorOffset - 1]).toBe("(");
      expect(key!.insert[key!.cursorOffset]).toBe(",");
      expect(key!.ariaLabel).toBeDefined();
      expect(key!.latex).toBeDefined();
    }
  });

  it("teclas de probabilidade inserem sempre a forma ASCII e mostram a notação abstrata", () => {
    const probabilidade = KEYBOARD_CATEGORIES.find((category) => category.id === "probabilidade");
    for (const key of probabilidade?.keys ?? []) {
      expect(key.insert, key.label).toMatch(/^[a-z_(),]+$/);
    }
    const latexByInsert = new Map(probabilidade?.keys.map((key) => [key.insert, key.latex]));
    expect(latexByInsert.get("probabilidade(,)")).toBe("P(A)");
    expect(latexByInsert.get("complementar()")).toBe("P(A^{c})");
    expect(latexByInsert.get("uniao(,,)")).toBe("P(A\\cup B)");
    expect(latexByInsert.get("intersecao_independente(,)")).toBe("P(A\\cap B)");
    expect(latexByInsert.get("condicional(,)")).toBe("P(A \\mid B)");
    expect(latexByInsert.get("binomial(,,)")).toBe("\\binom{n}{k}p^{k}(1-p)^{n-k}");
  });

  // --- Sprint V3.0 (Structured Math Input) --------------------------------

  it("as 9 teclas básicas do ticket têm mathLiveInsert com slots \\placeholder{} nos templates", () => {
    const basico = KEYBOARD_CATEGORIES.find((category) => category.id === "basico");
    const byLabel = new Map(basico?.keys.map((key) => [key.label, key]));

    expect(byLabel.get("( )")?.mathLiveInsert).toBe("\\left(\\placeholder{}\\right)");
    expect(byLabel.get("x²")?.mathLiveInsert).toBe("^{2}");
    expect(byLabel.get("x³")?.mathLiveInsert).toBe("^{3}");
    expect(byLabel.get("xⁿ")?.mathLiveInsert).toBe("^{\\placeholder{}}");
    expect(byLabel.get("a/b")?.mathLiveInsert).toBe("\\frac{\\placeholder{}}{\\placeholder{}}");
    expect(byLabel.get("√")?.mathLiveInsert).toBe("\\sqrt{\\placeholder{}}");
    expect(byLabel.get("ⁿ√")?.mathLiveInsert).toBe("\\sqrt[\\placeholder{}]{\\placeholder{}}");
    expect(byLabel.get("=")?.mathLiveInsert).toBe("=");
    expect(byLabel.get("π")?.mathLiveInsert).toBe("\\pi");
  });

  it("categoria Básico tem a nova tecla de raiz n-ésima (ⁿ√), inexistente no teclado legado", () => {
    const basico = KEYBOARD_CATEGORIES.find((category) => category.id === "basico");
    const key = basico?.keys.find((candidate) => candidate.label === "ⁿ√");
    expect(key).toBeDefined();
    expect(key!.ariaLabel).toBeDefined();
  });

  it("teclas fora de Básico/Cálculo ainda não têm mathLiveInsert (fora de escopo até serem migradas)", () => {
    for (const category of KEYBOARD_CATEGORIES) {
      if (category.id === "basico" || category.id === "calculo") continue;
      for (const key of category.keys) {
        expect(key.mathLiveInsert, `${category.id}/${key.label}`).toBeUndefined();
      }
    }
  });

  // --- Sprint V3.0.1 (Structured Calculus Input) --------------------------

  it("as 5 teclas de Cálculo migradas têm mathLiveInsert com slots \\placeholder{} estruturados", () => {
    const calculo = KEYBOARD_CATEGORIES.find((category) => category.id === "calculo");
    const byLabel = new Map(calculo?.keys.map((key) => [key.label, key]));

    expect(byLabel.get("d/dx")?.mathLiveInsert).toBe("\\frac{d}{dx}\\left(\\placeholder{}\\right)");
    expect(byLabel.get("∫ dx")?.mathLiveInsert).toBe("\\int \\placeholder{}\\,dx");
    expect(byLabel.get("∫ₐᵇ dx")?.mathLiveInsert).toBe(
      "\\int_{\\placeholder{}}^{\\placeholder{}}\\placeholder{}\\,dx"
    );
    expect(byLabel.get("lim")?.mathLiveInsert).toBe("\\lim_{x\\to\\placeholder{}}\\placeholder{}");
    expect(byLabel.get("Σ")?.mathLiveInsert).toBe(
      "\\sum_{\\placeholder{i}=\\placeholder{}}^{\\placeholder{}}\\placeholder{}"
    );
    expect(byLabel.get("∞")?.mathLiveInsert).toBe("\\infty");
  });

  it("categoria Cálculo tem a nova tecla de integral definida (∫ₐᵇ dx), inexistente no teclado legado", () => {
    const calculo = KEYBOARD_CATEGORIES.find((category) => category.id === "calculo");
    const key = calculo?.keys.find((candidate) => candidate.label === "∫ₐᵇ dx");
    expect(key).toBeDefined();
    expect(key!.ariaLabel).toBeDefined();
  });

  it("Σ de Cálculo (estruturada) e Σ de Símbolos (ainda legado) coexistem sem conflito — mesmo padrão de π duplicado em Básico/V3.0", () => {
    const calculo = KEYBOARD_CATEGORIES.find((category) => category.id === "calculo");
    const simbolos = KEYBOARD_CATEGORIES.find((category) => category.id === "simbolos");
    expect(calculo?.keys.find((key) => key.label === "Σ")?.mathLiveInsert).toBeDefined();
    expect(simbolos?.keys.find((key) => key.label === "Σ")?.mathLiveInsert).toBeUndefined();
  });
});
