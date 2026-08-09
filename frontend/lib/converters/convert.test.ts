import { describe, expect, it } from "vitest";

import { convert } from "./convert";
import { CONVERTER_CATEGORIES, type ConverterUnit } from "@/data/converters";

function unit(categoryId: string, unitId: string): ConverterUnit {
  const category = CONVERTER_CATEGORIES.find((c) => c.id === categoryId);
  if (!category) throw new Error(`categoria "${categoryId}" não encontrada`);
  const found = category.units.find((u) => u.id === unitId);
  if (!found) throw new Error(`unidade "${unitId}" não encontrada em "${categoryId}"`);
  return found;
}

describe("convert — comprimento", () => {
  it("1 km -> m = 1000", () => {
    expect(convert("comprimento", 1, unit("comprimento", "km"), unit("comprimento", "m"))?.value).toBe(1000);
  });

  it("100 cm -> m = 1", () => {
    expect(convert("comprimento", 100, unit("comprimento", "cm"), unit("comprimento", "m"))?.value).toBe(1);
  });

  it("1 in -> cm = 2.54", () => {
    expect(convert("comprimento", 1, unit("comprimento", "in"), unit("comprimento", "cm"))?.value).toBe(2.54);
  });

  it("1 mi -> km ≈ 1.609344", () => {
    expect(convert("comprimento", 1, unit("comprimento", "mi"), unit("comprimento", "km"))?.value).toBeCloseTo(
      1.609344,
      6
    );
  });

  it("passo a passo bate exatamente com o exemplo do ticket (5 km -> m)", () => {
    const outcome = convert("comprimento", 5, unit("comprimento", "km"), unit("comprimento", "m"));
    expect(outcome?.steps).toEqual(["1 km = 1000 m", "5 × 1000 = 5000"]);
    expect(outcome?.formatted).toBe("5000");
  });
});

describe("convert — massa", () => {
  it("1000 g -> kg = 1", () => {
    expect(convert("massa", 1000, unit("massa", "g"), unit("massa", "kg"))?.value).toBe(1);
  });

  it("1 kg -> g = 1000", () => {
    expect(convert("massa", 1, unit("massa", "kg"), unit("massa", "g"))?.value).toBe(1000);
  });

  it("1 lb -> kg ≈ 0.45359237", () => {
    expect(convert("massa", 1, unit("massa", "lb"), unit("massa", "kg"))?.value).toBeCloseTo(0.45359237, 8);
  });
});

describe("convert — área", () => {
  it("10000 cm² -> m² = 1", () => {
    expect(convert("area", 10000, unit("area", "cm2"), unit("area", "m2"))?.value).toBe(1);
  });

  it("1 ha -> m² = 10000", () => {
    expect(convert("area", 1, unit("area", "ha"), unit("area", "m2"))?.value).toBe(10000);
  });
});

describe("convert — volume (padrão US para fl oz/galão, documentado no módulo)", () => {
  it("1000 mL -> L = 1", () => {
    expect(convert("volume", 1000, unit("volume", "mL"), unit("volume", "L"))?.value).toBe(1);
  });

  it("1 L -> mL = 1000", () => {
    expect(convert("volume", 1, unit("volume", "L"), unit("volume", "mL"))?.value).toBe(1000);
  });

  it("1 galão US -> L = 3.785412 (US customary, 231 in³ exatos)", () => {
    expect(convert("volume", 1, unit("volume", "galus"), unit("volume", "L"))?.value).toBeCloseTo(3.785412, 5);
  });
});

describe("convert — tempo", () => {
  it("60 s -> min = 1", () => {
    expect(convert("tempo", 60, unit("tempo", "s"), unit("tempo", "min"))?.value).toBe(1);
  });

  it("3600 s -> h = 1", () => {
    expect(convert("tempo", 3600, unit("tempo", "s"), unit("tempo", "h"))?.value).toBe(1);
  });

  it("1 dia -> h = 24", () => {
    expect(convert("tempo", 1, unit("tempo", "dia"), unit("tempo", "h"))?.value).toBe(24);
  });
});

describe("convert — temperatura (fórmulas dedicadas, nunca multiplicativas)", () => {
  it("0 °C -> °F = 32", () => {
    expect(convert("temperatura", 0, unit("temperatura", "C"), unit("temperatura", "F"))?.value).toBe(32);
  });

  it("100 °C -> °F = 212", () => {
    expect(convert("temperatura", 100, unit("temperatura", "C"), unit("temperatura", "F"))?.value).toBe(212);
  });

  it("32 °F -> °C = 0", () => {
    expect(convert("temperatura", 32, unit("temperatura", "F"), unit("temperatura", "C"))?.value).toBe(0);
  });

  it("0 °C -> K = 273.15", () => {
    expect(convert("temperatura", 0, unit("temperatura", "C"), unit("temperatura", "K"))?.value).toBe(273.15);
  });

  it("273.15 K -> °C = 0", () => {
    expect(convert("temperatura", 273.15, unit("temperatura", "K"), unit("temperatura", "C"))?.value).toBe(0);
  });

  it("mostra a fórmula usada, nunca só o número (20 °C -> °F)", () => {
    const outcome = convert("temperatura", 20, unit("temperatura", "C"), unit("temperatura", "F"));
    expect(outcome?.steps[0]).toBe("°F = °C × 9/5 + 32");
    expect(outcome?.steps[1]).toBe("20 × 9/5 + 32 = 68");
    expect(outcome?.value).toBe(68);
  });

  it("F->K e K->F (pares não testados diretamente acima, mesma tabela de 6 fórmulas)", () => {
    expect(convert("temperatura", 32, unit("temperatura", "F"), unit("temperatura", "K"))?.value).toBeCloseTo(
      273.15,
      6
    );
    expect(convert("temperatura", 273.15, unit("temperatura", "K"), unit("temperatura", "F"))?.value).toBeCloseTo(
      32,
      6
    );
  });
});

describe("convert — velocidade", () => {
  it("1 m/s -> km/h = 3.6", () => {
    expect(convert("velocidade", 1, unit("velocidade", "ms"), unit("velocidade", "kmh"))?.value).toBeCloseTo(
      3.6,
      6
    );
  });

  it("100 km/h -> m/s ≈ 27.7778", () => {
    expect(convert("velocidade", 100, unit("velocidade", "kmh"), unit("velocidade", "ms"))?.value).toBeCloseTo(
      27.7778,
      3
    );
  });
});

describe("convert — ângulo (forma exata em π priorizada sobre decimal)", () => {
  it("180° -> rad, exato = π (nunca 3.141592653589793 crua)", () => {
    const outcome = convert("angulo", 180, unit("angulo", "deg"), unit("angulo", "rad"));
    expect(outcome?.exactLatex).toBe("\\pi");
    expect(outcome?.steps[1]).toBe("= π");
  });

  it("90° -> rad, exato = π/2", () => {
    const outcome = convert("angulo", 90, unit("angulo", "deg"), unit("angulo", "rad"));
    expect(outcome?.exactLatex).toBe("\\frac{\\pi}{2}");
    expect(outcome?.steps[1]).toBe("= π/2");
  });

  it("45° -> rad, exato = π/4", () => {
    const outcome = convert("angulo", 45, unit("angulo", "deg"), unit("angulo", "rad"));
    expect(outcome?.exactLatex).toBe("\\frac{\\pi}{4}");
  });

  it("360° -> rad, exato = 2π", () => {
    const outcome = convert("angulo", 360, unit("angulo", "deg"), unit("angulo", "rad"));
    expect(outcome?.exactLatex).toBe("2\\pi");
    expect(outcome?.steps[1]).toBe("= 2π");
  });

  it("0° -> rad = 0 (nunca uma fração vazia/-0)", () => {
    const outcome = convert("angulo", 0, unit("angulo", "deg"), unit("angulo", "rad"));
    expect(outcome?.exactLatex).toBe("0");
  });

  it("valor decimal (30.5°) não força uma forma exata inventada — cai pro decimal", () => {
    const outcome = convert("angulo", 30.5, unit("angulo", "deg"), unit("angulo", "rad"));
    expect(outcome?.exactLatex).toBeNull();
  });

  it("π rad -> graus = 180 (função pura aceita Math.PI diretamente; ver limitação do campo de texto documentada no módulo)", () => {
    const outcome = convert("angulo", Math.PI, unit("angulo", "rad"), unit("angulo", "deg"));
    expect(outcome?.value).toBe(180);
    expect(outcome?.formatted).toBe("180");
  });

  it("graus negativos preservam a fração exata com o sinal fora (ex. -90°)", () => {
    const outcome = convert("angulo", -90, unit("angulo", "deg"), unit("angulo", "rad"));
    expect(outcome?.exactLatex).toBe("-\\frac{\\pi}{2}");
  });
});

describe("convert — casos gerais (0, negativo, decimal, mesma unidade)", () => {
  it("valor 0 nunca quebra (qualquer categoria linear)", () => {
    expect(convert("comprimento", 0, unit("comprimento", "km"), unit("comprimento", "m"))?.value).toBe(0);
  });

  it("valor negativo é aceito quando matematicamente válido (ex. temperatura)", () => {
    expect(convert("temperatura", -40, unit("temperatura", "C"), unit("temperatura", "F"))?.value).toBe(-40);
  });

  it("valor decimal comum não produz ruído de ponto flutuante no resultado formatado", () => {
    const outcome = convert("comprimento", 0.1, unit("comprimento", "m"), unit("comprimento", "cm"));
    expect(outcome?.formatted).toBe("10");
    expect(outcome?.formatted).not.toContain("000000");
  });

  it("mesma unidade -> mesma quantidade, em toda categoria", () => {
    for (const category of CONVERTER_CATEGORIES) {
      const u = category.units[0];
      const outcome = convert(category.id, 7, u, u);
      expect(outcome?.value, `${category.id}/${u.id}`).toBe(7);
    }
  });

  it("NaN/Infinity de entrada nunca produzem um outcome (nunca propaga NaN pra UI)", () => {
    expect(convert("comprimento", NaN, unit("comprimento", "km"), unit("comprimento", "m"))).toBeNull();
    expect(convert("comprimento", Infinity, unit("comprimento", "km"), unit("comprimento", "m"))).toBeNull();
  });
});
