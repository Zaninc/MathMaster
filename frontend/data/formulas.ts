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
export type FormulaCategoryId =
  | "algebra"
  | "geometria"
  | "trigonometria"
  | "calculo"
  | "somatorios"
  | "algebra-linear"
  | "numeros-complexos"
  | "combinatoria"
  | "probabilidade";

export const FORMULA_CATEGORY_LABELS: Record<FormulaCategoryId, string> = {
  algebra: "Álgebra",
  geometria: "Geometria",
  trigonometria: "Trigonometria",
  calculo: "Cálculo",
  somatorios: "Somatórios",
  "algebra-linear": "Álgebra Linear",
  "numeros-complexos": "Números Complexos",
  combinatoria: "Combinatória",
  probabilidade: "Probabilidade",
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
  // Sprint V2.2 — Motor de Matrizes, ordem pedida pelo Theo.
  {
    id: "multiplicacao-matrizes",
    title: "Multiplicação de matrizes",
    latex: String.raw`(AB)_{ij} = \sum_{k=1}^{n} a_{ik}\,b_{kj}`,
    category: "algebra-linear",
  },
  {
    id: "determinante-matriz-2x2",
    title: "Determinante (matriz 2x2)",
    latex: String.raw`\det\begin{bmatrix}a&b\\c&d\end{bmatrix} = ad-bc`,
    category: "algebra-linear",
  },
  {
    id: "inversa-matriz-2x2",
    title: "Inversa (matriz 2x2)",
    latex: String.raw`\begin{bmatrix}a&b\\c&d\end{bmatrix}^{-1} = \frac{1}{ad-bc}\begin{bmatrix}d&-b\\-c&a\end{bmatrix}`,
    category: "algebra-linear",
  },
  {
    id: "transposta-matriz",
    title: "Transposta de uma matriz",
    latex: String.raw`\begin{bmatrix}a&b\\c&d\end{bmatrix}^{T} = \begin{bmatrix}a&c\\b&d\end{bmatrix}`,
    category: "algebra-linear",
  },
  {
    id: "matriz-identidade",
    title: "Matriz identidade",
    latex: String.raw`I_2 = \begin{bmatrix}1&0\\0&1\end{bmatrix}`,
    category: "algebra-linear",
  },
  {
    id: "traco-matriz",
    title: "Traço de uma matriz",
    latex: String.raw`\operatorname{tr}(A) = \sum_{i=1}^{n} a_{ii}`,
    category: "algebra-linear",
  },
  // Sprint V2.4 — Sistemas Lineares (motor já existente desde antes desta
  // sprint; só faltava a exposição na Biblioteca de Fórmulas). Integradas
  // em "algebra-linear" (não uma categoria própria), mesmo raciocínio de
  // "Matrizes" acima — evita fragmentar a biblioteca.
  {
    id: "sistema-linear-2x2",
    title: "Sistema linear 2x2 (forma geral)",
    latex: String.raw`\begin{cases}a_1x+b_1y=c_1\\a_2x+b_2y=c_2\end{cases}`,
    category: "algebra-linear",
  },
  {
    id: "sistema-linear-forma-matricial",
    title: "Forma matricial de um sistema linear",
    latex: String.raw`AX=B`,
    category: "algebra-linear",
  },
  {
    id: "sistema-linear-condicao-solucao-unica",
    title: "Condição de solução única (determinante)",
    latex: String.raw`\det(A)\neq0 \implies \text{solução única}`,
    category: "algebra-linear",
  },
  {
    id: "regra-cramer",
    title: "Regra de Cramer",
    latex: String.raw`x_i = \frac{\det(A_i)}{\det(A)}`,
    category: "algebra-linear",
  },
  // Sprint V2.3 — Motor de Números Complexos, ordem pedida pelo Theo.
  {
    id: "definicao-numero-complexo",
    title: "Definição de número complexo",
    latex: String.raw`z = a + bi,\quad i^2 = -1`,
    category: "numeros-complexos",
  },
  {
    id: "conjugado-complexo",
    title: "Conjugado",
    latex: String.raw`\overline{a+bi} = a-bi`,
    category: "numeros-complexos",
  },
  {
    id: "modulo-complexo",
    title: "Módulo",
    latex: String.raw`|a+bi| = \sqrt{a^2+b^2}`,
    category: "numeros-complexos",
  },
  {
    id: "argumento-complexo",
    title: "Argumento",
    latex: String.raw`\arg(a+bi) = \theta,\quad \tan(\theta) = \frac{b}{a}`,
    category: "numeros-complexos",
  },
  {
    id: "forma-polar-complexo",
    title: "Forma polar",
    latex: String.raw`z = r\left(\cos(\theta) + i\sin(\theta)\right)`,
    category: "numeros-complexos",
  },
  {
    id: "formula-euler",
    title: "Fórmula de Euler",
    latex: String.raw`e^{i\theta} = \cos(\theta) + i\sin(\theta)`,
    category: "numeros-complexos",
  },
  // Sprint V2.5 — Motor de Sistemas Polinomiais Não Lineares. Categoria
  // "algebra" (não uma nova categoria, nem "algebra-linear" — um sistema
  // não linear não envolve matriz/vetor): a posição no array não precisa
  // ficar contígua às outras entradas "algebra" (`FormulaCategory` agrupa
  // por `category`, não por posição no array).
  {
    id: "sistema-nao-linear-exemplo",
    title: "Sistema não linear (parábola + reta)",
    latex: String.raw`\begin{cases}x^2+y=5\\x-y=1\end{cases}`,
    category: "algebra",
  },
  // Sprint V2.6 — Motor de Polinômios Avançados. "Produto notável" (ver
  // quadrado-soma/quadrado-diferença), "Diferença de quadrados" e "Cubo
  // perfeito" (ver cubo-soma/cubo-diferença) já existiam desde a Sprint 4
  // — só as duas fórmulas abaixo eram uma lacuna real.
  {
    id: "grau-polinomio",
    title: "Grau de um polinômio",
    latex: String.raw`\deg\left(a_nx^n+\cdots+a_1x+a_0\right)=n,\quad a_n\neq0`,
    category: "algebra",
  },
  {
    id: "fatoracao-raizes",
    title: "Relação entre fatoração e raízes",
    latex: String.raw`P(x)=a\left(x-r_1\right)\left(x-r_2\right)\cdots\left(x-r_n\right)`,
    category: "algebra",
  },
  // Sprint V2.7 — Motor de Combinatória. Categoria nova (mesmo padrão da
  // V2.3 com "numeros-complexos"): entra ao final do array, então a seção
  // aparece por último na página — ordem de exibição = ordem de 1ª
  // aparição da categoria. Notação alinhada com o motor
  // (`combinatorics/formatter.py`) e com o teclado: C_{n,k} / A_{n,k} /
  // P_n / n!.
  {
    id: "fatorial",
    title: "Fatorial",
    latex: String.raw`n! = n\cdot(n-1)\cdot(n-2)\cdots 2\cdot 1,\quad 0! = 1`,
    category: "combinatoria",
  },
  {
    id: "permutacao-simples",
    title: "Permutação simples",
    latex: String.raw`P_n = n!`,
    category: "combinatoria",
  },
  {
    id: "arranjo-simples",
    title: "Arranjo simples",
    latex: String.raw`A_{n,k} = \frac{n!}{(n-k)!}`,
    category: "combinatoria",
  },
  {
    // Sprint V2.7.1 — notação internacional \binom{n}{k} no lugar de
    // C_{n,k} (só a representação visual; título/categoria intocados).
    id: "combinacao-simples",
    title: "Combinação simples",
    latex: String.raw`\binom{n}{k} = \frac{n!}{k!\,(n-k)!}`,
    category: "combinatoria",
  },
  {
    id: "permutacao-repeticao",
    title: "Permutação com repetição",
    latex: String.raw`P_n^{a,b,\ldots} = \frac{n!}{a!\,b!\cdots}`,
    category: "combinatoria",
  },
  // Sprint V2.8 — Motor de Probabilidade. Mesmo padrão de "combinatoria"
  // acima: categoria nova ao final do array, notação alinhada com o motor
  // (`probability/formatter.py`) e com o teclado (P(A), P(A^c), P(A∪B),
  // P(A∩B), P(A|B), \binom{n}{k}p^k(1-p)^{n-k}).
  {
    id: "probabilidade-classica",
    title: "Probabilidade Clássica",
    latex: String.raw`P(A) = \dfrac{\text{casos favoráveis}}{\text{casos possíveis}}`,
    category: "probabilidade",
  },
  {
    id: "complementar",
    title: "Complementar",
    latex: String.raw`P(A^{c}) = 1 - P(A)`,
    category: "probabilidade",
  },
  {
    id: "uniao-eventos",
    title: "União",
    latex: String.raw`P(A\cup B) = P(A) + P(B) - P(A\cap B)`,
    category: "probabilidade",
  },
  {
    id: "intersecao-eventos-independentes",
    title: "Interseção (Eventos Independentes)",
    latex: String.raw`P(A\cap B) = P(A)\cdot P(B)`,
    category: "probabilidade",
  },
  {
    id: "probabilidade-condicional",
    title: "Probabilidade Condicional",
    latex: String.raw`P(A\mid B) = \dfrac{P(A\cap B)}{P(B)}`,
    category: "probabilidade",
  },
  {
    id: "distribuicao-binomial",
    title: "Distribuição Binomial",
    latex: String.raw`P(X=k) = \binom{n}{k}p^{k}(1-p)^{n-k}`,
    category: "probabilidade",
  },
];
