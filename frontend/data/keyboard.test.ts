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
});
