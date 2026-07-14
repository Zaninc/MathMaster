import { describe, expect, it } from "vitest";

import { insertAtCursor } from "./insert-at-cursor";

describe("insertAtCursor", () => {
  it("insere no cursor quando não há seleção", () => {
    expect(insertAtCursor("ab", 1, 1, "X", 1)).toEqual({ value: "aXb", cursorPosition: 2 });
  });

  it("substitui o texto selecionado pelo texto inserido", () => {
    expect(insertAtCursor("hello world", 0, 5, "hi", 2)).toEqual({ value: "hi world", cursorPosition: 2 });
  });

  it("posiciona o cursor dentro do texto inserido usando cursorOffset", () => {
    expect(insertAtCursor("", 0, 0, "sen()", 4)).toEqual({ value: "sen()", cursorPosition: 4 });
  });

  it("insere no fim quando o cursor está no fim da string", () => {
    expect(insertAtCursor("2+2", 3, 3, "=", 1)).toEqual({ value: "2+2=", cursorPosition: 4 });
  });

  it("limita índices fora do intervalo válido da string", () => {
    expect(insertAtCursor("ab", 10, 20, "X", 1)).toEqual({ value: "abX", cursorPosition: 3 });
  });

  it("aceita cursorOffset 0 (cursor antes do texto inserido)", () => {
    expect(insertAtCursor("ab", 1, 1, "()", 0)).toEqual({ value: "a()b", cursorPosition: 1 });
  });
});
