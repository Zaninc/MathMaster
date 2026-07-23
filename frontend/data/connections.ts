import type { GeometryShape } from "@/components/geometry/types";

import type { FormulaCategoryId } from "./formulas";

export interface RelatedLink {
  icon: string;
  label: string;
  href: string;
}

export function calculatorLink(expression: string): string {
  return `/calculadora?expression=${encodeURIComponent(expression)}`;
}

export function graphsLink(fn: string): string {
  return `/graficos?fn=${encodeURIComponent(fn)}`;
}

export function exercisesLink(topicSlug: string): string {
  return `/aprendizado?topico=${encodeURIComponent(topicSlug)}`;
}

export function formulasLink(params: { categoria?: FormulaCategoryId; q?: string }): string {
  const search = new URLSearchParams();
  if (params.categoria) search.set("categoria", params.categoria);
  if (params.q) search.set("q", params.q);
  const query = search.toString();
  return query ? `/formulas?${query}` : "/formulas";
}

/**
 * "x² - 4 = 0" é um dos QUICK_EXAMPLES (data/examples.ts), já confirmado
 * contra o backend real — reaproveitada aqui em vez de inventar uma nova
 * expressão não testada para as fórmulas de equação do 2º grau.
 */
const QUADRATIC_EXPRESSION = "x² - 4 = 0";
const QUADRATIC_FN = "x^2-4";

/**
 * Conexões de Fórmulas → Calculadora/Gráficos/Exercícios (Sistema de
 * conexões internas). Curadoria explícita por `id` de `data/formulas.ts`
 * — decisão consciente de NÃO ter um fallback genérico "abrir calculadora
 * em branco" para as fórmulas fora da lista: uma ação sem exemplo real
 * por trás não tem utilidade e só passaria a impressão de recurso quebrado
 * (`FormulaCard` simplesmente não renderiza a fileira de ações quando o
 * array vier vazio). Ampliar esta lista é seguro e isolado — nunca requer
 * tocar em `FormulaCard`/`FormulasReference`.
 *
 * `equacoes`/`algebra-basica`/`funcoes` são os únicos slugs de tópico que
 * existem hoje na seed do Supabase (0002_topics_exercises.sql). Os links
 * para `trigonometria`/`geometria` abrem `/aprendizado` sem pré-seleção
 * até esses tópicos existirem — comportamento tolerado por design (ver
 * `exercisesLink`), nunca tratado como erro.
 */
export const FORMULA_CONNECTIONS: Partial<Record<string, RelatedLink[]>> = {
  bhaskara: [
    { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink(QUADRATIC_EXPRESSION) },
    { icon: "📈", label: "Visualizar nos gráficos", href: graphsLink(QUADRATIC_FN) },
    { icon: "📝", label: "Exercícios relacionados", href: exercisesLink("equacoes") },
  ],
  delta: [
    { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink(QUADRATIC_EXPRESSION) },
    { icon: "📝", label: "Exercícios relacionados", href: exercisesLink("equacoes") },
  ],
  "soma-raizes": [
    { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink(QUADRATIC_EXPRESSION) },
    { icon: "📝", label: "Exercícios relacionados", href: exercisesLink("equacoes") },
  ],
  "produto-raizes": [
    { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink(QUADRATIC_EXPRESSION) },
    { icon: "📝", label: "Exercícios relacionados", href: exercisesLink("equacoes") },
  ],
  "quadrado-soma": [
    { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("(x+3)^2") },
    { icon: "📝", label: "Exercícios relacionados", href: exercisesLink("algebra-basica") },
  ],
  "quadrado-diferenca": [
    { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("(x-3)^2") },
    { icon: "📝", label: "Exercícios relacionados", href: exercisesLink("algebra-basica") },
  ],
  "diferenca-quadrados": [
    { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("x^2 - 9") },
    { icon: "📝", label: "Exercícios relacionados", href: exercisesLink("algebra-basica") },
  ],
  "cubo-soma": [{ icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("(x+2)^3") }],
  "cubo-diferenca": [{ icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("(x-2)^3") }],
  "potencia-mesma-base": [{ icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("x^2 * x^3") }],
  "divisao-potencias": [{ icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("x^5 / x^2") }],
  "potencia-de-potencia": [{ icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("(x^2)^3") }],
  "teorema-pitagoras": [{ icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("√(3² + 4²)") }],
  "area-circulo": [{ icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("circunferencia((0,0), 5)") }],
  "comprimento-circunferencia": [
    { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("circunferencia((0,0), 5)") },
  ],
  "relacao-fundamental-trigonometrica": [
    { icon: "📈", label: "Visualizar nos gráficos", href: graphsLink("sin(x)^2+cos(x)^2") },
    { icon: "📝", label: "Exercícios relacionados", href: exercisesLink("trigonometria") },
  ],
  tangente: [
    { icon: "📈", label: "Visualizar nos gráficos", href: graphsLink("tan(x)") },
    { icon: "📝", label: "Exercícios relacionados", href: exercisesLink("trigonometria") },
  ],
  secante: [
    { icon: "📈", label: "Visualizar nos gráficos", href: graphsLink("sec(x)") },
    { icon: "📝", label: "Exercícios relacionados", href: exercisesLink("trigonometria") },
  ],
  "lei-senos": [{ icon: "📝", label: "Exercícios relacionados", href: exercisesLink("trigonometria") }],
  "lei-cossenos": [{ icon: "📝", label: "Exercícios relacionados", href: exercisesLink("trigonometria") }],
  "derivada-potencia": [{ icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("d/dx(x² + 3x)") }],
  "integral-potencia": [{ icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("∫x² dx") }],
  "limite-fundamental": [{ icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("lim x→0 sen(x)/x") }],
  "derivada-seno": [{ icon: "📈", label: "Visualizar nos gráficos", href: graphsLink("sin(x)") }],
  "derivada-cosseno": [{ icon: "📈", label: "Visualizar nos gráficos", href: graphsLink("cos(x)") }],
  "derivada-tangente": [{ icon: "📈", label: "Visualizar nos gráficos", href: graphsLink("tan(x)") }],
  "derivada-exponencial": [{ icon: "📈", label: "Visualizar nos gráficos", href: graphsLink("exp(x)") }],
  "derivada-log-natural": [{ icon: "📈", label: "Visualizar nos gráficos", href: graphsLink("log(x)") }],
};

export function getFormulaConnections(formulaId: string): RelatedLink[] {
  return FORMULA_CONNECTIONS[formulaId] ?? [];
}

/**
 * Conexões de Geometria → Fórmulas/Exercícios que NÃO dependem dos
 * valores ao vivo do formulário (centro, raio, vértices...) — essas
 * entram estáticas aqui. A ação "Enviar equação para a calculadora"
 * depende da figura atual (`buildExpression()` já existe em
 * `GeometryWorkspace`) e por isso é montada no próprio componente, não
 * aqui — mas usa `calculatorLink`/`graphsLink` acima, então a forma da
 * URL continua centralizada num único lugar.
 *
 * Nenhuma entrada para elipse/hipérbole: o catálogo de `data/formulas.ts`
 * não tem fórmula própria pra elas, e criar um link de busca que não acha
 * nada seria pior que não ter o link (ver regra "ocultar em vez de mostrar
 * ação sem utilidade").
 */
export const GEOMETRY_CONNECTIONS: Partial<Record<GeometryShape["kind"], RelatedLink[]>> = {
  triangle: [
    { icon: "📚", label: "Ver fórmulas", href: formulasLink({ categoria: "geometria", q: "triangulo" }) },
    { icon: "📝", label: "Exercícios relacionados", href: exercisesLink("geometria") },
  ],
  circle: [
    {
      icon: "📚",
      label: "Ver fórmulas da circunferência",
      href: formulasLink({ categoria: "geometria", q: "circulo" }),
    },
  ],
};

export function getGeometryConnections(kind: GeometryShape["kind"]): RelatedLink[] {
  return GEOMETRY_CONNECTIONS[kind] ?? [];
}

/**
 * Classificador heurístico e propositalmente simples (regex sobre o texto
 * digitado, não uma análise semântica real — decisão explícita da sprint,
 * "mapeamentos simples e estáticos"). Roda sobre a expressão ORIGINAL
 * resolvida (`ResultPanel.expression`), nunca sobre o resultado.
 */
function isQuadraticEquation(expression: string): boolean {
  return /[²]|\^2\b/.test(expression) && /=/.test(expression);
}

function isDerivative(expression: string): boolean {
  return /d\s*\/\s*dx\s*\(/i.test(expression);
}

function isTrigonometric(expression: string): boolean {
  return /\b(sen|sin|cos|tan|tg)\s*\(/i.test(expression);
}

/**
 * Sprint V2.1 — reconhece a sintaxe principal do somatório (Σ(...)) e os
 * aliases secundários (sum(.../somatorio(...), só por PREFIXO — mesmo
 * critério de `is_summation_domain_expression` no backend, nunca por
 * ocorrência no meio do texto.
 */
function isSummation(expression: string): boolean {
  return /^\s*(Σ\(|sum\(|somatorio\()/i.test(expression);
}

/**
 * `x - a` de uma equação "x - a = 0" para virar uma função plotável — só
 * quando o lado direito é exatamente "0" (o único caso inequívoco); em
 * qualquer outra forma, a sugestão de gráfico é omitida (melhor não
 * sugerir do que sugerir uma função errada).
 */
function quadraticLeftHandSide(expression: string): string | null {
  const match = expression.match(/^(.*?)=\s*0\s*$/);
  return match ? match[1].trim() : null;
}

/** Sem correspondência = array vazio = `ResultPanel` não renderiza o bloco "Explorar". */
export function getCalculatorExplorations(expression: string): RelatedLink[] {
  // Checado ANTES de `isQuadraticEquation`: um corpo de somatório como
  // "Σ(i=1..5) sin(i)^2 + cos(i)^2" contém tanto "=" (no cabeçalho) quanto
  // "^2" — seria roubado pela heurística de equação do 2º grau se checado
  // depois. Mesmo raciocínio já aplicado na cascata do backend.
  if (isSummation(expression)) {
    // Gráfico NÃO incluído aqui de propósito (escopo consciente da Sprint
    // V2.1): um somatório é uma soma discreta, não uma função contínua de x
    // — reaproveitar `graphsLink(fn)` produziria uma função errada, e
    // `graph-normalize.ts`/`plot-evaluator.ts` não têm hoje nenhum
    // precedente de dado discreto (ver auditoria da sprint). Contrato
    // futuro documentado, não implementado: uma rota dedicada (não
    // `graphsLink`) recebendo `tipo=somatorio`, `variavel`, `inferior`,
    // `superior` e `expressao` como parâmetros, para uma visualização
    // discreta própria (nunca plotada como curva contínua).
    return [
      { icon: "📚", label: "Ver fórmula relacionada", href: formulasLink({ categoria: "somatorios" }) },
      { icon: "📝", label: "Praticar exercícios semelhantes", href: exercisesLink("somatorios") },
    ];
  }

  if (isQuadraticEquation(expression)) {
    const links: RelatedLink[] = [];
    const lhs = quadraticLeftHandSide(expression);
    if (lhs) links.push({ icon: "📈", label: "Ver gráfico", href: graphsLink(lhs) });
    links.push({ icon: "📚", label: "Ver fórmula relacionada", href: formulasLink({ categoria: "algebra", q: "bhaskara" }) });
    links.push({ icon: "📝", label: "Praticar exercícios semelhantes", href: exercisesLink("equacoes") });
    return links;
  }

  if (isDerivative(expression)) {
    return [{ icon: "📚", label: "Ver fórmula relacionada", href: formulasLink({ categoria: "calculo" }) }];
  }

  if (isTrigonometric(expression)) {
    return [{ icon: "📝", label: "Praticar exercícios semelhantes", href: exercisesLink("trigonometria") }];
  }

  return [];
}
