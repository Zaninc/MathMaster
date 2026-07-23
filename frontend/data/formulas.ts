/**
 * Dados da Biblioteca de Fórmulas (/formulas). Separado de data/tools.ts
 * desde a Etapa 1; na Etapa 2 as expressões migraram de texto Unicode
 * solto para LaTeX compatível com KaTeX (components/shared/MathFormula),
 * e ganharam `id` estável — categoria virou slug estável (`category`)
 * com rótulo PT-BR à parte (`FORMULA_CATEGORY_LABELS`). Etapa 3 expandiu
 * o catálogo (7→29 fórmulas) e adicionou o filtro por categoria em
 * FormulasReference.tsx — o slug de categoria criado na Etapa 2 é o que
 * torna esse filtro possível sem tocar nos dados. Expansão seguinte
 * acrescentou mais 17 fórmulas (29→46), sempre ao final do bloco da
 * categoria correspondente — preserva a ordem visual das já existentes.
 */
export type FormulaCategoryId = "algebra" | "geometria" | "trigonometria" | "calculo" | "somatorios";

export const FORMULA_CATEGORY_LABELS: Record<FormulaCategoryId, string> = {
  algebra: "Álgebra",
  geometria: "Geometria",
  trigonometria: "Trigonometria",
  calculo: "Cálculo",
  somatorios: "Somatórios",
};

export interface FormulaEntry {
  id: string;
  title: string;
  /** LaTeX sem delimitadores `$`/`\[`, pronto para MathFormula. */
  latex: string;
  category: FormulaCategoryId;
}

/** Ordem de exibição das categorias = ordem de 1ª aparição aqui (preserva a ordem da Etapa 1). */
export const FORMULAS: FormulaEntry[] = [
  {
    id: "bhaskara",
    title: "Fórmula de Bhaskara",
    latex: String.raw`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`,
    category: "algebra",
  },
  {
    id: "quadrado-soma",
    title: "Quadrado da soma",
    latex: String.raw`(a+b)^2 = a^2 + 2ab + b^2`,
    category: "algebra",
  },
  {
    id: "quadrado-diferenca",
    title: "Quadrado da diferença",
    latex: String.raw`(a-b)^2 = a^2 - 2ab + b^2`,
    category: "algebra",
  },
  {
    id: "diferenca-quadrados",
    title: "Diferença de quadrados",
    latex: String.raw`a^2-b^2=(a-b)(a+b)`,
    category: "algebra",
  },
  {
    id: "soma-raizes",
    title: "Soma das raízes",
    latex: String.raw`x_1+x_2=-\frac{b}{a}`,
    category: "algebra",
  },
  {
    id: "produto-raizes",
    title: "Produto das raízes",
    latex: String.raw`x_1x_2=\frac{c}{a}`,
    category: "algebra",
  },
  {
    id: "potencia-mesma-base",
    title: "Potência de mesma base",
    latex: String.raw`a^m \cdot a^n = a^{m+n}`,
    category: "algebra",
  },
  {
    id: "cubo-soma",
    title: "Cubo da soma",
    latex: String.raw`(a+b)^3 = a^3 + 3a^2b + 3ab^2 + b^3`,
    category: "algebra",
  },
  {
    id: "cubo-diferenca",
    title: "Cubo da diferença",
    latex: String.raw`(a-b)^3 = a^3 - 3a^2b + 3ab^2 - b^3`,
    category: "algebra",
  },
  {
    id: "divisao-potencias",
    title: "Divisão de potências",
    latex: String.raw`\frac{a^m}{a^n} = a^{m-n}`,
    category: "algebra",
  },
  {
    id: "potencia-de-potencia",
    title: "Potência de potência",
    latex: String.raw`(a^m)^n = a^{mn}`,
    category: "algebra",
  },
  {
    id: "delta",
    title: "Delta (discriminante)",
    latex: String.raw`\Delta = b^2 - 4ac`,
    category: "algebra",
  },
  {
    id: "teorema-pitagoras",
    title: "Teorema de Pitágoras",
    latex: String.raw`a^2 + b^2 = c^2`,
    category: "geometria",
  },
  {
    id: "area-circulo",
    title: "Área do círculo",
    latex: String.raw`A = \pi r^2`,
    category: "geometria",
  },
  {
    id: "area-triangulo",
    title: "Área do triângulo",
    latex: String.raw`A = \frac{bh}{2}`,
    category: "geometria",
  },
  {
    id: "comprimento-circunferencia",
    title: "Comprimento da circunferência",
    latex: String.raw`C = 2\pi r`,
    category: "geometria",
  },
  {
    id: "area-retangulo",
    title: "Área do retângulo",
    latex: String.raw`A = bh`,
    category: "geometria",
  },
  {
    id: "area-trapezio",
    title: "Área do trapézio",
    latex: String.raw`A = \frac{(B+b)h}{2}`,
    category: "geometria",
  },
  {
    id: "volume-cubo",
    title: "Volume do cubo",
    latex: String.raw`V = a^3`,
    category: "geometria",
  },
  {
    id: "volume-cilindro",
    title: "Volume do cilindro",
    latex: String.raw`V = \pi r^2 h`,
    category: "geometria",
  },
  {
    id: "volume-esfera",
    title: "Volume da esfera",
    latex: String.raw`V = \frac{4}{3}\pi r^3`,
    category: "geometria",
  },
  {
    id: "area-losango",
    title: "Área do losango",
    latex: String.raw`A = \frac{D \cdot d}{2}`,
    category: "geometria",
  },
  {
    id: "area-hexagono-regular",
    title: "Área do hexágono regular",
    latex: String.raw`A = \frac{3\sqrt{3}}{2}l^2`,
    category: "geometria",
  },
  {
    id: "volume-cone",
    title: "Volume do cone",
    latex: String.raw`V = \frac{\pi r^2 h}{3}`,
    category: "geometria",
  },
  {
    id: "volume-piramide",
    title: "Volume da pirâmide",
    latex: String.raw`V = \frac{A_b \cdot h}{3}`,
    category: "geometria",
  },
  {
    id: "relacao-fundamental-trigonometrica",
    title: "Relação fundamental",
    latex: String.raw`\sin^2(x) + \cos^2(x) = 1`,
    category: "trigonometria",
  },
  {
    id: "tangente",
    title: "Definição da tangente",
    latex: String.raw`\tan(x)=\frac{\sin(x)}{\cos(x)}`,
    category: "trigonometria",
  },
  {
    id: "lei-senos",
    title: "Lei dos senos",
    latex: String.raw`\frac{a}{\sin(A)}=\frac{b}{\sin(B)}=\frac{c}{\sin(C)}`,
    category: "trigonometria",
  },
  {
    id: "lei-cossenos",
    title: "Lei dos cossenos",
    latex: String.raw`c^2=a^2+b^2-2ab\cos(C)`,
    category: "trigonometria",
  },
  {
    id: "conversao-radianos",
    title: "Conversão para radianos",
    latex: String.raw`\theta_{\mathrm{rad}}=\theta_{\mathrm{graus}}\frac{\pi}{180}`,
    category: "trigonometria",
  },
  {
    id: "seno-soma",
    title: "Seno da soma",
    latex: String.raw`\sin(a+b)=\sin(a)\cos(b)+\cos(a)\sin(b)`,
    category: "trigonometria",
  },
  {
    id: "cosseno-soma",
    title: "Cosseno da soma",
    latex: String.raw`\cos(a+b)=\cos(a)\cos(b)-\sin(a)\sin(b)`,
    category: "trigonometria",
  },
  {
    id: "seno-diferenca",
    title: "Seno da diferença",
    latex: String.raw`\sin(a-b)=\sin(a)\cos(b)-\cos(a)\sin(b)`,
    category: "trigonometria",
  },
  {
    id: "conversao-graus",
    title: "Conversão para graus",
    latex: String.raw`\theta_{\mathrm{graus}}=\theta_{\mathrm{rad}}\frac{180}{\pi}`,
    category: "trigonometria",
  },
  {
    id: "secante",
    title: "Definição da secante",
    latex: String.raw`\sec(x)=\frac{1}{\cos(x)}`,
    category: "trigonometria",
  },
  {
    id: "derivada-potencia",
    title: "Derivada da potência",
    latex: String.raw`\frac{d}{dx}\left(x^n\right) = nx^{n-1}`,
    category: "calculo",
  },
  {
    id: "integral-potencia",
    title: "Integral da potência",
    latex: String.raw`\int x^n\,dx = \frac{x^{n+1}}{n+1} + C`,
    category: "calculo",
  },
  {
    id: "regra-cadeia",
    title: "Regra da cadeia",
    latex: String.raw`\frac{d}{dx}f(g(x))=f'(g(x))g'(x)`,
    category: "calculo",
  },
  {
    id: "derivada-seno",
    title: "Derivada do seno",
    latex: String.raw`\frac{d}{dx}\sin(x)=\cos(x)`,
    category: "calculo",
  },
  {
    id: "derivada-cosseno",
    title: "Derivada do cosseno",
    latex: String.raw`\frac{d}{dx}\cos(x)=-\sin(x)`,
    category: "calculo",
  },
  {
    id: "integral-exponencial",
    title: "Integral exponencial",
    latex: String.raw`\int e^x\,dx=e^x+C`,
    category: "calculo",
  },
  {
    id: "limite-fundamental",
    title: "Limite fundamental",
    latex: String.raw`\lim_{x\to0}\frac{\sin(x)}{x}=1`,
    category: "calculo",
  },
  {
    id: "derivada-exponencial",
    title: "Derivada da exponencial",
    latex: String.raw`\frac{d}{dx}\left(e^x\right) = e^x`,
    category: "calculo",
  },
  {
    id: "derivada-log-natural",
    title: "Derivada do logaritmo natural",
    latex: String.raw`\frac{d}{dx}\left(\ln(x)\right) = \frac{1}{x}`,
    category: "calculo",
  },
  {
    id: "integracao-por-partes",
    title: "Integração por partes",
    latex: String.raw`\int u\,dv = uv - \int v\,du`,
    category: "calculo",
  },
  {
    id: "derivada-tangente",
    title: "Derivada da tangente",
    latex: String.raw`\frac{d}{dx}\tan(x)=\sec^2(x)`,
    category: "calculo",
  },
  // Sprint V2.1 — Somatórios, ordem pedida pelo Theo.
  {
    id: "soma-primeiros-naturais",
    title: "Soma dos primeiros n naturais",
    latex: String.raw`\sum_{i=1}^{n} i = \frac{n(n+1)}{2}`,
    category: "somatorios",
  },
  {
    id: "soma-primeiros-quadrados",
    title: "Soma dos primeiros n quadrados",
    latex: String.raw`\sum_{i=1}^{n} i^2 = \frac{n(n+1)(2n+1)}{6}`,
    category: "somatorios",
  },
  {
    id: "soma-primeiros-cubos",
    title: "Soma dos primeiros n cubos",
    latex: String.raw`\sum_{i=1}^{n} i^3 = \left(\frac{n(n+1)}{2}\right)^2`,
    category: "somatorios",
  },
  {
    id: "soma-pa-finita",
    title: "Soma de PA finita",
    latex: String.raw`S_n = \frac{(a_1+a_n)n}{2}`,
    category: "somatorios",
  },
  {
    id: "soma-pg-finita",
    title: "Soma de PG finita",
    latex: String.raw`S_n = \frac{a_1(q^n-1)}{q-1},\; q \neq 1`,
    category: "somatorios",
  },
];
