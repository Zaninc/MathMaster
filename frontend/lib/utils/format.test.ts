import { describe, expect, it } from "vitest";

import { formatNumber } from "./format";

describe("formatNumber", () => {
  it("mostra inteiros sem casas decimais", () => {
    expect(formatNumber(20)).toBe("20");
    expect(formatNumber(-5)).toBe("-5");
    expect(formatNumber(0)).toBe("0");
  });

  it("arredonda não inteiros para 2 casas decimais", () => {
    expect(formatNumber(9.4339)).toBe("9.43");
    expect(formatNumber(1 / 3)).toBe("0.33");
  });
});
