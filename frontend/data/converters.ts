/**
 * Sprint V2.20 — catálogo dos Conversores (/ferramentas/conversores).
 * Mesmo espírito de `data/formulas.ts`/`data/tools.ts`: só DADOS aqui
 * (categorias, unidades, rótulos, unidade padrão de origem/destino) —
 * toda a matemática de conversão vive em `lib/converters/convert.ts`,
 * que nunca importa este arquivo (recebe as unidades já resolvidas como
 * argumento, mantendo a lógica pura e testável isoladamente).
 */
export type ConverterCategoryId =
  | "comprimento"
  | "massa"
  | "area"
  | "volume"
  | "tempo"
  | "temperatura"
  | "velocidade"
  | "angulo";

export interface ConverterUnit {
  /** Identificador estável usado pelas tabelas de conversão — nunca o rótulo (pode mudar de exibição sem quebrar a lógica). */
  id: string;
  /** Símbolo mostrado nos seletores/resultado (ex. "km", "°C", "mph"). */
  label: string;
  /** Nome por extenso — usado só como rótulo acessível do `<option>`. */
  name: string;
}

export interface ConverterCategory {
  id: ConverterCategoryId;
  label: string;
  units: ConverterUnit[];
  defaultFromId: string;
  defaultToId: string;
}

/**
 * Ordem de exibição das categorias = ordem aqui (mesma convenção de
 * `FORMULAS` em `data/formulas.ts`). Categoria inicial da página é
 * sempre `CONVERTER_CATEGORIES[0]` ("Comprimento", pedido explícito do
 * ticket).
 */
export const CONVERTER_CATEGORIES: ConverterCategory[] = [
  {
    id: "comprimento",
    label: "Comprimento",
    defaultFromId: "km",
    defaultToId: "m",
    units: [
      { id: "mm", label: "mm", name: "Milímetro" },
      { id: "cm", label: "cm", name: "Centímetro" },
      { id: "m", label: "m", name: "Metro" },
      { id: "km", label: "km", name: "Quilômetro" },
      { id: "in", label: "in", name: "Polegada" },
      { id: "ft", label: "ft", name: "Pé" },
      { id: "yd", label: "yd", name: "Jarda" },
      { id: "mi", label: "mi", name: "Milha" },
    ],
  },
  {
    id: "massa",
    label: "Massa",
    defaultFromId: "kg",
    defaultToId: "g",
    units: [
      { id: "mg", label: "mg", name: "Miligrama" },
      { id: "g", label: "g", name: "Grama" },
      { id: "kg", label: "kg", name: "Quilograma" },
      { id: "t", label: "t", name: "Tonelada" },
      { id: "oz", label: "oz", name: "Onça" },
      { id: "lb", label: "lb", name: "Libra" },
    ],
  },
  {
    id: "area",
    label: "Área",
    defaultFromId: "m2",
    defaultToId: "cm2",
    units: [
      { id: "cm2", label: "cm²", name: "Centímetro quadrado" },
      { id: "m2", label: "m²", name: "Metro quadrado" },
      { id: "km2", label: "km²", name: "Quilômetro quadrado" },
      { id: "ha", label: "ha", name: "Hectare" },
      { id: "in2", label: "in²", name: "Polegada quadrada" },
      { id: "ft2", label: "ft²", name: "Pé quadrado" },
    ],
  },
  {
    id: "volume",
    label: "Volume",
    defaultFromId: "L",
    defaultToId: "mL",
    units: [
      { id: "mL", label: "mL", name: "Mililitro" },
      { id: "L", label: "L", name: "Litro" },
      { id: "cm3", label: "cm³", name: "Centímetro cúbico" },
      { id: "m3", label: "m³", name: "Metro cúbico" },
      { id: "flozus", label: "fl oz", name: "Onça fluida (EUA)" },
      { id: "galus", label: "gal", name: "Galão (EUA)" },
    ],
  },
  {
    id: "tempo",
    label: "Tempo",
    defaultFromId: "h",
    defaultToId: "min",
    units: [
      { id: "ms", label: "ms", name: "Milissegundo" },
      { id: "s", label: "s", name: "Segundo" },
      { id: "min", label: "min", name: "Minuto" },
      { id: "h", label: "h", name: "Hora" },
      { id: "dia", label: "dia", name: "Dia" },
    ],
  },
  {
    id: "temperatura",
    label: "Temperatura",
    defaultFromId: "C",
    defaultToId: "F",
    units: [
      { id: "C", label: "°C", name: "Celsius" },
      { id: "F", label: "°F", name: "Fahrenheit" },
      { id: "K", label: "K", name: "Kelvin" },
    ],
  },
  {
    id: "velocidade",
    label: "Velocidade",
    defaultFromId: "kmh",
    defaultToId: "ms",
    units: [
      { id: "ms", label: "m/s", name: "Metro por segundo" },
      { id: "kmh", label: "km/h", name: "Quilômetro por hora" },
      { id: "mph", label: "mph", name: "Milha por hora" },
      { id: "kn", label: "nó", name: "Nó (milha náutica por hora)" },
    ],
  },
  {
    id: "angulo",
    label: "Ângulo",
    defaultFromId: "deg",
    defaultToId: "rad",
    units: [
      { id: "deg", label: "graus", name: "Grau" },
      { id: "rad", label: "radianos", name: "Radiano" },
    ],
  },
];

export const CONVERTER_CATEGORY_LABELS: Record<ConverterCategoryId, string> = Object.fromEntries(
  CONVERTER_CATEGORIES.map((category) => [category.id, category.label])
) as Record<ConverterCategoryId, string>;
