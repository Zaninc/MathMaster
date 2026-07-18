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
    expect(byLabel.get("eˣ")?.insert).toBe("exp()");

    for (const key of funcoes?.keys ?? []) {
      expect(key.insert).not.toMatch(/e\*\*/);
      expect(key.insert).not.toMatch(/log\([^)]*,/);
      // Inserção é sempre ASCII puro — Unicode tipográfico fica só no label.
      expect(key.insert).toMatch(/^[\x20-\x7E]*$/);
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
});
