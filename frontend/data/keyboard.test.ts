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

  it("nenhuma tecla insere um operador cru sem operandos", () => {
    for (const category of KEYBOARD_CATEGORIES) {
      for (const key of category.keys) {
        expect(key.insert, `${category.id}/${key.label}`).not.toMatch(/^[*/+\-^]+$/);
      }
    }
  });
});
