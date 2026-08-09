import { formatNumber } from "@/lib/utils/format";
import type { ConverterCategoryId, ConverterUnit } from "@/data/converters";

/**
 * Sprint V2.20 — motor de conversão puro (sem React, sem `data/
 * converters.ts` importado: recebe as unidades já resolvidas como
 * argumento, testável isoladamente com fixtures inline). Nunca lança —
 * entrada fora do escopo desta versão (unidade desconhecida) devolve
 * `null`, o mesmo contrato de `find_*`/`compute_*` no backend.
 *
 * Categorias LINEARES (comprimento/massa/área/volume/tempo/velocidade/
 * dados/energia/pressão/potência/frequência — Sprint V2.20.1 adicionou
 * as últimas 5 na MESMA tabela, zero função nova) passam por uma ÚNICA
 * unidade-base por categoria (metros/gramas/m²/litros/segundos/m por
 * segundo/bits/joules/pascais/watts/hertz) —
 * `LINEAR_FACTORS[categoria][unidade]` é "quantos <base> tem 1
 * <unidade>". A conversão de QUALQUER par nunca precisa de uma tabela
 * NxN manual: `fator = de.factor / para.factor` (quantos "para" tem 1
 * "de"), sempre passando implicitamente pela base. Temperatura é
 * exceção deliberada (tem offset, não é multiplicativa) — usa fórmulas
 * dedicadas por par ordenado. Ângulo também é especial: grau->radiano
 * tenta preservar π como fração exata (`Bx+C`-style, ver
 * `exactRadiansFraction`) antes de cair pro decimal.
 *
 * Ruído de ponto flutuante: o FATOR par-a-par (`1 <de> = X <para>`) é
 * arredondado pra até 6 casas decimais ANTES de ser usado no cálculo —
 * nunca depois. Isso garante que o passo "Como foi convertido" mostrado
 * ao aluno seja sempre uma multiplicação genuína (nunca "5 × 0.62 = 5000"
 * com um fator visualmente arredondado mas um resultado calculado a
 * partir do valor SEM arredondar, que seria uma inconsistência real —
 * "inventar passo matemático incorreto", exatamente o que o ticket
 * pediu pra nunca acontecer).
 */

export interface ConversionOutcome {
  /** Valor numérico do resultado — sempre finito quando `outcome !== null`. */
  value: number;
  /** `value` já formatado por `formatNumber` (reuso do utilitário existente, nunca um formatador novo). */
  formatted: string;
  /** LaTeX (`\frac{\pi}{2}`, sem delimitadores) só quando uma forma exata confiável existe — hoje só grau->radiano com grau inteiro. `null` caso contrário. */
  exactLatex: string | null;
  /** Linhas de texto simples (podem conter "×"/"π"/"°" Unicode) da seção "Como foi convertido" — nunca reaproveita `exactLatex` bruto aqui, monta a própria versão em texto puro. */
  steps: string[];
}

type LinearCategoryId = Exclude<ConverterCategoryId, "temperatura" | "angulo">;

/** "Quantos <base> tem 1 <unidade>" — base de cada categoria linear documentada ao lado do id. */
const LINEAR_FACTORS: Record<LinearCategoryId, Record<string, number>> = {
  // base: metro
  comprimento: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 },
  // base: grama
  massa: { mg: 0.001, g: 1, kg: 1000, t: 1_000_000, oz: 28.349523125, lb: 453.59237 },
  // base: metro quadrado
  area: { cm2: 0.0001, m2: 1, km2: 1_000_000, ha: 10_000, in2: 0.00064516, ft2: 0.09290304 },
  // base: litro. fl oz/gal seguem o padrão AMERICANO (US customary) —
  // documentado explicitamente pra nunca existir ambiguidade com o
  // imperial britânico (que teria fatores diferentes): 1 galão americano
  // = 231 polegadas cúbicas EXATAS = 3.785411784 L; 1 fl oz americana =
  // galão/128 = 29.5735295625 mL.
  volume: { mL: 0.001, L: 1, cm3: 0.001, m3: 1000, flozus: 0.0295735295625, galus: 3.785411784 },
  // base: segundo
  tempo: { ms: 0.001, s: 1, min: 60, h: 3600, dia: 86400 },
  // base: metro por segundo. "nó" = milha náutica (1852 m) por hora.
  velocidade: { ms: 1, kmh: 1000 / 3600, mph: 1609.344 / 3600, kn: 1852 / 3600 },
  // Sprint V2.20.1 — base: bit. 1 byte = 8 bits (definição explícita do
  // ticket). KB/MB/GB/TB em base DECIMAL (SI, ×1000) — nunca KiB/MiB/GiB
  // (base 1024, fora de escopo desta versão, documentado também na UI
  // via `ConverterCategory.note`, pra nunca ficar ambíguo pro usuário).
  dados: { bit: 1, byte: 8, KB: 8000, MB: 8_000_000, GB: 8_000_000_000, TB: 8_000_000_000_000 },
  // base: joule. 1 cal = 4.184 J (caloria termoquímica, a convenção mais
  // comum) — 1 kcal/1 Wh/1 kWh derivados dela e de 3600 s/h, nunca
  // redigitados como constantes independentes.
  energia: { J: 1, kJ: 1000, cal: 4.184, kcal: 4184, Wh: 3600, kWh: 3_600_000 },
  // base: pascal. 1 psi = 6894.757293168 Pa (definição exata do ticket,
  // derivada de 1 psi = 1 lbf/in² com lbf em newtons — reproduzida aqui
  // como constante, nunca recalculada a partir de massa/comprimento).
  pressao: { Pa: 1, kPa: 1000, bar: 100_000, atm: 101_325, psi: 6894.757293168 },
  // base: watt. "hp" aqui é SEMPRE o horsepower MECÂNICO (745.6998715822702 W)
  // — nunca confundido com CV (735.49875 W, métrico) nem com hp elétrico/
  // caldeira; se um desses for necessário no futuro, entra como unidade
  // PRÓPRIA (ex. "cv"), nunca reaproveitando o id "hp".
  potencia: { W: 1, kW: 1000, hp: 745.6998715822702 },
  // base: hertz.
  frequencia: { Hz: 1, kHz: 1000, MHz: 1_000_000, GHz: 1_000_000_000 },
};

/**
 * Fator par-a-par (`1 <de> = <factor> <para>`) arredondado pra até 8
 * algarismos significativos — só pro TEXTO explicativo, NUNCA usado pra
 * calcular `value` (ver `convertLinear`: o resultado real vem sempre de
 * `(value*fromFactor)/toFactor`, na ordem que evita arredondamento
 * acumulado). `exact` diz se o arredondamento mudou alguma coisa —
 * quando muda (ex. segundo/minuto, uma dízima), os passos usam "≈" em
 * vez de "=", pra nunca afirmar uma igualdade que não é literalmente
 * verdadeira ("nunca inventar um passo matemático incorreto").
 */
function roundedFactor(value: number): { text: string; exact: boolean } {
  if (Number.isInteger(value)) return { text: String(value), exact: true };
  const rounded = Number(value.toPrecision(8));
  return { text: String(rounded), exact: rounded === value };
}

function convertLinear(
  categoryId: LinearCategoryId,
  value: number,
  from: ConverterUnit,
  to: ConverterUnit
): ConversionOutcome | null {
  const table = LINEAR_FACTORS[categoryId];
  const fromFactor = table[from.id];
  const toFactor = table[to.id];
  if (fromFactor === undefined || toFactor === undefined) return null;

  // Ordem "(value*fromFactor)/toFactor" — nunca pré-computar
  // "fromFactor/toFactor" e multiplicar por `value` depois: pra pares
  // cujo fator par-a-par é uma dízima (ex. segundo->minuto, 1/60), a
  // ordem inversa acumula erro de arredondamento (60 × (1/60)
  // arredondado vira 1.00002, não 1) — esta ordem mantém o resultado
  // exato sempre que os fatores de entrada permitem (confirmado nos
  // testes obrigatórios do ticket: 60s->min=1, 3600s->h=1, ambos exatos).
  const result = (value * fromFactor) / toFactor;
  const resultText = formatNumber(result);

  const { text: factorText, exact } = roundedFactor(fromFactor / toFactor);
  const relation = exact ? "=" : "≈";

  return {
    value: result,
    formatted: resultText,
    exactLatex: null,
    steps: [
      `1 ${from.label} ${relation} ${factorText} ${to.label}`,
      `${formatNumber(value)} × ${factorText} ${relation} ${resultText}`,
    ],
  };
}

interface TemperatureFormula {
  /** Texto da fórmula geral (sempre mostrado primeiro, nunca inventado — as 6 são as fórmulas-texto padrão de conversão de temperatura). */
  formula: string;
  compute: (v: number) => number;
  /** Linha de substituição: recebe o valor de entrada e o resultado JÁ formatado. */
  step: (value: string, result: string) => string;
}

const TEMPERATURE_FORMULAS: Record<string, TemperatureFormula> = {
  "C-F": {
    formula: "°F = °C × 9/5 + 32",
    compute: (c) => (c * 9) / 5 + 32,
    step: (v, r) => `${v} × 9/5 + 32 = ${r}`,
  },
  "F-C": {
    formula: "°C = (°F - 32) × 5/9",
    compute: (f) => ((f - 32) * 5) / 9,
    step: (v, r) => `(${v} - 32) × 5/9 = ${r}`,
  },
  "C-K": {
    formula: "K = °C + 273.15",
    compute: (c) => c + 273.15,
    step: (v, r) => `${v} + 273.15 = ${r}`,
  },
  "K-C": {
    formula: "°C = K - 273.15",
    compute: (k) => k - 273.15,
    step: (v, r) => `${v} - 273.15 = ${r}`,
  },
  "F-K": {
    formula: "K = (°F - 32) × 5/9 + 273.15",
    compute: (f) => ((f - 32) * 5) / 9 + 273.15,
    step: (v, r) => `(${v} - 32) × 5/9 + 273.15 = ${r}`,
  },
  "K-F": {
    formula: "°F = (K - 273.15) × 9/5 + 32",
    compute: (k) => ((k - 273.15) * 9) / 5 + 32,
    step: (v, r) => `(${v} - 273.15) × 9/5 + 32 = ${r}`,
  },
};

function convertTemperature(value: number, from: ConverterUnit, to: ConverterUnit): ConversionOutcome | null {
  if (from.id === to.id) {
    const same = formatNumber(value);
    return { value, formatted: same, exactLatex: null, steps: [`${same} ${from.label} já está em ${to.label}.`] };
  }
  const conversion = TEMPERATURE_FORMULAS[`${from.id}-${to.id}`];
  if (!conversion) return null;

  const result = conversion.compute(value);
  const resultText = formatNumber(result);
  return {
    value: result,
    formatted: resultText,
    exactLatex: null,
    steps: [conversion.formula, conversion.step(formatNumber(value), resultText)],
  };
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * `graus/180` reduzido à fração irredutível `numerator/denominator` tal
 * que `radianos = numerator/denominator × π` — só quando `graus` é
 * inteiro (a única forma que este módulo sabe reduzir com confiança
 * matemática; decimal fica pro caminho aproximado, nunca "quase-exato").
 */
function exactRadiansFraction(degrees: number): { numerator: number; denominator: number } | null {
  if (!Number.isInteger(degrees)) return null;
  if (degrees === 0) return { numerator: 0, denominator: 1 };
  const divisor = gcd(Math.abs(degrees), 180);
  return { numerator: degrees / divisor, denominator: 180 / divisor };
}

function exactRadiansLatex(degrees: number): string | null {
  const fraction = exactRadiansFraction(degrees);
  if (fraction === null) return null;
  const { numerator, denominator } = fraction;
  if (numerator === 0) return "0";
  const sign = numerator < 0 ? "-" : "";
  const magnitude = Math.abs(numerator);
  const piTerm = magnitude === 1 ? "\\pi" : `${magnitude}\\pi`;
  return denominator === 1 ? `${sign}${piTerm}` : `${sign}\\frac{${piTerm}}{${denominator}}`;
}

function exactRadiansPlainText(degrees: number): string | null {
  const fraction = exactRadiansFraction(degrees);
  if (fraction === null) return null;
  const { numerator, denominator } = fraction;
  if (numerator === 0) return "0";
  const sign = numerator < 0 ? "-" : "";
  const magnitude = Math.abs(numerator);
  const piTerm = magnitude === 1 ? "π" : `${magnitude}π`;
  return denominator === 1 ? `${sign}${piTerm}` : `${sign}${piTerm}/${denominator}`;
}

function convertAngle(value: number, from: ConverterUnit, to: ConverterUnit): ConversionOutcome | null {
  if (from.id === to.id) {
    const same = formatNumber(value);
    return { value, formatted: same, exactLatex: null, steps: [`${same} ${from.label} já está em ${to.label}.`] };
  }
  if (from.id === "deg" && to.id === "rad") {
    const result = (value * Math.PI) / 180;
    const exactLatex = exactRadiansLatex(value);
    const exactText = exactRadiansPlainText(value);
    const resultText = exactText ?? formatNumber(result);
    return {
      value: result,
      formatted: formatNumber(result),
      exactLatex,
      steps: [`${formatNumber(value)} × π/180`, `= ${resultText}`],
    };
  }
  if (from.id === "rad" && to.id === "deg") {
    // Entrada é sempre um número puro (`<input type="number">` nunca
    // aceita o caractere "π") — nunca tenta reconhecer "isto É π" a
    // partir de um decimal digitado (parser improvisado, explicitamente
    // fora de escopo). `Math.PI` passado diretamente (ex. num teste
    // unitário chamando esta função) já dá 180 exato — é só o CAMPO de
    // texto que não sabe representar π simbolicamente, documentado como
    // limitação conhecida no relatório da sprint.
    const result = (value * 180) / Math.PI;
    const resultText = formatNumber(result);
    return {
      value: result,
      formatted: resultText,
      exactLatex: null,
      steps: [`${formatNumber(value)} × 180/π`, `= ${resultText}`],
    };
  }
  return null;
}

export function convert(
  categoryId: ConverterCategoryId,
  value: number,
  from: ConverterUnit,
  to: ConverterUnit
): ConversionOutcome | null {
  if (!Number.isFinite(value)) return null;
  if (categoryId === "temperatura") return convertTemperature(value, from, to);
  if (categoryId === "angulo") return convertAngle(value, from, to);
  return convertLinear(categoryId, value, from, to);
}
