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
  // Sprint V2.2 — Motor de Matrizes.
  "multiplicacao-matrizes": [
    { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("[[1,2],[3,4]]*[[5,6],[7,8]]") },
    { icon: "📝", label: "Exercícios relacionados", href: exercisesLink("algebra-linear") },
  ],
  "determinante-matriz-2x2": [
    { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("det([[1,2],[3,4]])") },
    { icon: "📝", label: "Exercícios relacionados", href: exercisesLink("algebra-linear") },
  ],
  "inversa-matriz-2x2": [
    { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("inv([[1,2],[3,4]])") },
    { icon: "📝", label: "Exercícios relacionados", href: exercisesLink("algebra-linear") },
  ],
  "transposta-matriz": [
    { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("transpose([[1,2],[3,4]])") },
  ],
  "matriz-identidade": [{ icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("[[1,0],[0,1]]") }],
  "traco-matriz": [{ icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("trace([[1,2],[3,4]])") }],
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
 * Sprint V2.2 (Motor de Matrizes) — mesmo critério do backend
 * (`matrix/dispatcher.py:is_matrix_domain_expression`): "[[" em qualquer
 * posição (uma matriz pode vir depois de um escalar, "2 * [[1,2],[3,4]]")
 * ou uma chamada de função de matriz conhecida, canônica ou alias PT-BR.
 */
const MATRIX_FUNCTION_PATTERN =
  /\b(det|inv|transpose|trace|determinante|inversa|transposta|traço)\s*\(/i;

function isMatrix(expression: string): boolean {
  return expression.includes("[[") || MATRIX_FUNCTION_PATTERN.test(expression);
}

/**
 * Sprint V2.2.1 (Variáveis Locais para Matrizes) — a expressão INTEIRA já
 * É uma chamada pronta a det/inv/transpose/trace (canônico ou alias
 * PT-BR), ex. "det(A)". Usado para decidir quando OMITIR "Ver
 * propriedades": compor "det(det(A))" não faz sentido — a propriedade já
 * é o resultado pedido.
 */
const MATRIX_PROPERTY_CALL_PATTERN =
  /^(det|inv|transpose|trace|determinante|inversa|transposta|traço)\s*\(.*\)$/i;

function isMatrixPropertyCall(statement: string): boolean {
  return MATRIX_PROPERTY_CALL_PATTERN.test(statement.trim());
}

/**
 * Sprint V2.2.1 — divide um programa de matriz em instruções por quebra de
 * linha OU ";" no nível mais alto (fora de colchetes/parênteses/chaves) —
 * mesmo bracket-counting de `matrix/parsing.py:_split_statements` no
 * backend, nunca um split ingênuo (uma matriz formatada em várias linhas,
 * "[[1, 2],\n [3, 4]]", tem sua própria quebra de linha DENTRO do
 * colchete — nível > 0, não pode virar um corte de instrução). Instruções
 * vazias são descartadas.
 */
function splitMatrixStatements(expression: string): string[] {
  const statements: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of expression) {
    if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") depth -= 1;
    if ((char === "\n" || char === ";") && depth === 0) {
      const statement = current.trim();
      if (statement !== "") statements.push(statement);
      current = "";
      continue;
    }
    current += char;
  }
  const tail = current.trim();
  if (tail !== "") statements.push(tail);
  return statements;
}

/**
 * A ÚLTIMA instrução de um programa de matriz — "a exploração continua
 * baseada na expressão final" (Sprint V2.2.1). Para qualquer expressão de
 * instrução única (99% dos casos, nenhuma mudança de comportamento) é a
 * própria expressão, já cortada.
 */
function extractFinalStatement(expression: string): string {
  const statements = splitMatrixStatements(expression);
  return statements.length > 0 ? statements[statements.length - 1] : expression.trim();
}

/**
 * Link de "Ver propriedades": reconstrói o programa inteiro com a MESMA
 * sequência de atribuições, só envolvendo a instrução final em
 * "det(...)" — preserva as variáveis já definidas, para o link continuar
 * resolvível (ex. "A=[[1,2],[3,4]]\nA" -> "A=[[1,2],[3,4]]\ndet(A)").
 */
function buildMatrixPropertiesLink(expression: string): string {
  const statements = splitMatrixStatements(expression);
  if (statements.length === 0) return calculatorLink(`det(${expression.trim()})`);
  const finalStatement = statements[statements.length - 1];
  const program = [...statements.slice(0, -1), `det(${finalStatement})`].join("\n");
  return calculatorLink(program);
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
  // Sprint V2.2.1 — "a exploração continua baseada na expressão final":
  // um programa de matriz com atribuições ("A=[[1,2],[3,4]]\ndet(A)") é
  // classificado pela ÚLTIMA instrução, não pelo texto inteiro (que teria
  // "=" e "[[" de sobra, sem relação com o que de fato foi resolvido).
  // Para 99% dos casos (instrução única, sem atribuição) é a própria
  // expressão — nenhuma mudança de comportamento.
  const finalStatement = extractFinalStatement(expression);

  // Checado ANTES de `isQuadraticEquation`: um corpo de somatório como
  // "Σ(i=1..5) sin(i)^2 + cos(i)^2" contém tanto "=" (no cabeçalho) quanto
  // "^2" — seria roubado pela heurística de equação do 2º grau se checado
  // depois. Mesmo raciocínio já aplicado na cascata do backend.
  if (isSummation(finalStatement)) {
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

  // Checado logo depois de `isSummation` — mesma posição do Motor de
  // Matrizes na cascata do backend (`math_engine/dispatcher.py`: matrix
  // entra depois de summation, antes de calculus/functions/trigonometry/
  // logarithms/equations). O GATE usa `expression` inteira (não só a
  // instrução final): uma referência de variável na instrução final, ex.
  // "A" em "A=[[1,2],[3,4]]\nA", não tem "[[" nela mesma — só o programa
  // inteiro revela que é matriz. "Ver propriedades" (Sprint V2.2.1) vale
  // para literal puro, referência de variável ou operação cujo resultado
  // seja matriz — só NÃO aparece quando a instrução final já é uma
  // chamada pronta a det/inv/transpose/trace (canônico ou alias PT-BR):
  // compor "det(det(...))" não faz sentido.
  if (isMatrix(expression)) {
    const links: RelatedLink[] = [];
    if (!isMatrixPropertyCall(finalStatement)) {
      links.push({ icon: "🧮", label: "Ver propriedades", href: buildMatrixPropertiesLink(expression) });
    }
    links.push({
      icon: "📚",
      label: "Ver fórmulas relacionadas",
      href: formulasLink({ categoria: "algebra-linear" }),
    });
    links.push({ icon: "📝", label: "Exercícios semelhantes", href: exercisesLink("algebra-linear") });
    return links;
  }

  if (isQuadraticEquation(finalStatement)) {
    const links: RelatedLink[] = [];
    const lhs = quadraticLeftHandSide(finalStatement);
    if (lhs) links.push({ icon: "📈", label: "Ver gráfico", href: graphsLink(lhs) });
    links.push({ icon: "📚", label: "Ver fórmula relacionada", href: formulasLink({ categoria: "algebra", q: "bhaskara" }) });
    links.push({ icon: "📝", label: "Praticar exercícios semelhantes", href: exercisesLink("equacoes") });
    return links;
  }

  if (isDerivative(finalStatement)) {
    return [{ icon: "📚", label: "Ver fórmula relacionada", href: formulasLink({ categoria: "calculo" }) }];
  }

  if (isTrigonometric(finalStatement)) {
    return [{ icon: "📝", label: "Praticar exercícios semelhantes", href: exercisesLink("trigonometria") }];
  }

  return [];
}
