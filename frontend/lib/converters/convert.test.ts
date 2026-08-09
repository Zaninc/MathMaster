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

describe("convert — dados (Sprint V2.20.1, base decimal, nunca KiB/MiB/GiB)", () => {
  it("8 bit -> byte = 1", () => {
    expect(convert("dados", 8, unit("dados", "bit"), unit("dados", "byte"))?.value).toBe(1);
  });

  it("1 byte -> bit = 8", () => {
    expect(convert("dados", 1, unit("dados", "byte"), unit("dados", "bit"))?.value).toBe(8);
  });

  it("1000 byte -> KB = 1", () => {
    expect(convert("dados", 1000, unit("dados", "byte"), unit("dados", "KB"))?.value).toBe(1);
  });

  it("1 MB -> byte = 1000000", () => {
    expect(convert("dados", 1, unit("dados", "MB"), unit("dados", "byte"))?.value).toBe(1_000_000);
  });

  it("1 GB -> MB = 1000", () => {
    expect(convert("dados", 1, unit("dados", "GB"), unit("dados", "MB"))?.value).toBe(1000);
  });

  it("1 TB -> GB = 1000", () => {
    expect(convert("dados", 1, unit("dados", "TB"), unit("dados", "GB"))?.value).toBe(1000);
  });

  it("passo a passo bate com o exemplo do ticket (1 GB -> MB)", () => {
    const outcome = convert("dados", 1, unit("dados", "GB"), unit("dados", "MB"));
    expect(outcome?.steps).toEqual(["1 GB = 1000 MB", "1 × 1000 = 1000"]);
  });
});

describe("convert — energia (Sprint V2.20.1)", () => {
  it("1 kJ -> J = 1000", () => {
    expect(convert("energia", 1, unit("energia", "kJ"), unit("energia", "J"))?.value).toBe(1000);
  });

  it("1 cal -> J = 4.184", () => {
    expect(convert("energia", 1, unit("energia", "cal"), unit("energia", "J"))?.value).toBe(4.184);
  });

  it("1 kcal -> J = 4184", () => {
    expect(convert("energia", 1, unit("energia", "kcal"), unit("energia", "J"))?.value).toBe(4184);
  });

  it("1 Wh -> J = 3600", () => {
    expect(convert("energia", 1, unit("energia", "Wh"), unit("energia", "J"))?.value).toBe(3600);
  });

  it("1 kWh -> Wh = 1000", () => {
    expect(convert("energia", 1, unit("energia", "kWh"), unit("energia", "Wh"))?.value).toBe(1000);
  });

  it("passo a passo bate com o exemplo do ticket (1 kcal -> J)", () => {
    const outcome = convert("energia", 1, unit("energia", "kcal"), unit("energia", "J"));
    expect(outcome?.steps).toEqual(["1 kcal = 4184 J", "1 × 4184 = 4184"]);
  });
});

describe("convert — pressão (Sprint V2.20.1)", () => {
  it("1 kPa -> Pa = 1000", () => {
    expect(convert("pressao", 1, unit("pressao", "kPa"), unit("pressao", "Pa"))?.value).toBe(1000);
  });

  it("1 bar -> Pa = 100000", () => {
    expect(convert("pressao", 1, unit("pressao", "bar"), unit("pressao", "Pa"))?.value).toBe(100_000);
  });

  it("1 atm -> Pa = 101325", () => {
    expect(convert("pressao", 1, unit("pressao", "atm"), unit("pressao", "Pa"))?.value).toBe(101_325);
  });

  it("1 atm -> kPa = 101.325", () => {
    expect(convert("pressao", 1, unit("pressao", "atm"), unit("pressao", "kPa"))?.value).toBeCloseTo(101.325, 9);
  });

  it("1 psi -> Pa ≈ 6894.7573 (sem excesso de casas na exibição)", () => {
    const outcome = convert("pressao", 1, unit("pressao", "psi"), unit("pressao", "Pa"));
    expect(outcome?.value).toBeCloseTo(6894.757293168, 6);
    expect(outcome?.formatted).toBe("6894.76");
  });

  it("passo a passo bate com o exemplo do ticket (1 atm -> kPa) — resultado exibido em 2 casas (101.33), consistente com formatNumber", () => {
    const outcome = convert("pressao", 1, unit("pressao", "atm"), unit("pressao", "kPa"));
    expect(outcome?.steps).toEqual(["1 atm = 101.325 kPa", "1 × 101.325 = 101.33"]);
    expect(outcome?.value).toBe(101.325);
  });
});

describe("convert — potência (Sprint V2.20.1, hp = horsepower mecânico, nunca CV)", () => {
  it("1 kW -> W = 1000", () => {
    expect(convert("potencia", 1, unit("potencia", "kW"), unit("potencia", "W"))?.value).toBe(1000);
  });

  it("1 hp -> W ≈ 745.6999", () => {
    expect(convert("potencia", 1, unit("potencia", "hp"), unit("potencia", "W"))?.value).toBeCloseTo(745.6999, 4);
  });

  it("1000 W -> kW = 1", () => {
    expect(convert("potencia", 1000, unit("potencia", "W"), unit("potencia", "kW"))?.value).toBe(1);
  });
});

describe("convert — frequência (Sprint V2.20.1)", () => {
  it("1000 Hz -> kHz = 1", () => {
    expect(convert("frequencia", 1000, unit("frequencia", "Hz"), unit("frequencia", "kHz"))?.value).toBe(1);
  });

  it("1 MHz -> Hz = 1000000", () => {
    expect(convert("frequencia", 1, unit("frequencia", "MHz"), unit("frequencia", "Hz"))?.value).toBe(1_000_000);
  });

  it("1 GHz -> MHz = 1000", () => {
    expect(convert("frequencia", 1, unit("frequencia", "GHz"), unit("frequencia", "MHz"))?.value).toBe(1000);
  });

  it("2.4 GHz -> MHz = 2400", () => {
    expect(convert("frequencia", 2.4, unit("frequencia", "GHz"), unit("frequencia", "MHz"))?.value).toBe(2400);
  });

  it("passo a passo bate com o exemplo do ticket (2.4 GHz -> MHz)", () => {
    const outcome = convert("frequencia", 2.4, unit("frequencia", "GHz"), unit("frequencia", "MHz"));
    expect(outcome?.steps).toEqual(["1 GHz = 1000 MHz", "2.4 × 1000 = 2400"]);
  });
});

describe("convert — regressão explícita das categorias da V2.20 (matemática intocada)", () => {
  it("180° -> rad = π", () => {
    expect(convert("angulo", 180, unit("angulo", "deg"), unit("angulo", "rad"))?.exactLatex).toBe("\\pi");
  });

  it("0°C -> °F = 32", () => {
    expect(convert("temperatura", 0, unit("temperatura", "C"), unit("temperatura", "F"))?.value).toBe(32);
  });

  it("1 km -> m = 1000", () => {
    expect(convert("comprimento", 1, unit("comprimento", "km"), unit("comprimento", "m"))?.value).toBe(1000);
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
