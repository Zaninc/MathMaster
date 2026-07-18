import { describe, expect, it } from "vitest";

import { normalizeForBackend } from "./backend-normalize";

/**
 * Formas validadas contra o backend real (2026-07-18): √(9)/∛(8)/(2)³ são
 * aceitas NATIVAMENTE (identidade deliberada — normalizar duplicaria o
 * Sprint Parser do backend); (2)ⁿ e eˣ(2) cruas são REJEITADAS, e as
 * traduções (2)**n / exp(2) avaliam.
 */
describe("normalizeForBackend", () => {
  it("traduz o template visual de exponencial eˣ( para exp(", () => {
    expect(normalizeForBackend("eˣ(2)")).toBe("exp(2)");
    expect(normalizeForBackend("eˣ(x+1)")).toBe("exp(x+1)");
    expect(normalizeForBackend("2*eˣ(3)")).toBe("2*exp(3)");
  });

  it("traduz o marcador de potência ⁿ para **n", () => {
    expect(normalizeForBackend("(2)ⁿ")).toBe("(2)**n");
    expect(normalizeForBackend("xⁿ")).toBe("x**n");
    expect(normalizeForBackend("(x+1)ⁿ")).toBe("(x+1)**n");
  });

  it("deixa intocadas as formas que o backend aceita nativamente", () => {
    for (const native of ["√(9)", "∛(8)", "(2)³", "x² - 4 = 0", "π+π", "sen(π/6)", "d/dx(x²)", "∫₀¹ x² dx"]) {
      expect(normalizeForBackend(native)).toBe(native);
    }
  });

  it("é idempotente (a saída não contém ˣ nem ⁿ)", () => {
    const once = normalizeForBackend("eˣ((2)ⁿ)");
    expect(once).toBe("exp((2)**n)");
    expect(normalizeForBackend(once)).toBe(once);
  });
});
