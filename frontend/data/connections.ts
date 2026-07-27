import type { GeometryShape } from "@/components/geometry/types";

import type { FormulaCategoryId } from "./formulas";

export interface RelatedLink {
  icon: string;
  label: string;
  href: string;
  /**
   * Investigação "auto-resolve só funciona na primeira vez" (pós-Sprint
   * V2.3): quando `true`, `ContextActionPill` acrescenta um identificador
   * de solicitação NOVO (`&request=<uuid>`) a cada clique — nunca
   * reaproveita a mesma URL entre cliques, mesmo pra expressão idêntica.
   * Necessário só para "Ver propriedades" (`href` de `calculatorLink`
   * com `{ autoSolve: true }`): sem isso, uma segunda ação idêntica
   * produzia a MESMA URL já processada por `CalculatorWorkspace`, que
   * corretamente (mas erradamente, neste caso) tratava como "nada
   * mudou" e não resolvia de novo. Todo outro `RelatedLink` (Fórmulas,
   * Geometria, exercícios) omite este campo — comportamento de sempre,
   * navegação estática direta via `next/link`.
   */
  requiresFreshRequest?: boolean;
}

/**
 * `options.autoSolve` (investigação "Ver propriedades", pós-Sprint V2.3):
 * quando `true`, adiciona `&autoSolve=1` — `CalculatorWorkspace` resolve a
 * expressão sozinho ao detectar esse marcador, em vez do comportamento
 * padrão de só pré-preencher o campo (todo outro uso de `calculatorLink`,
 * sem a opção, continua idêntico a antes — `undefined`/omitido nunca
 * adiciona o parâmetro). Reservado para o link de "Ver propriedades"
 * (`buildMatrixPropertiesLink`): sem isso, o usuário chegava com
 * `det(...)` só escrito no campo, precisando clicar "Resolver" de novo —
 * reforçava a sensação de "não levou a lugar nenhum" descrita na
 * investigação. String literal `${encodeURIComponent(expression)}`
 * preservada (não migrada para `URLSearchParams`, que codifica espaço
 * como "+" em vez de "%20" — mudaria o contrato já testado de todo
 * chamador existente).
 */
export function calculatorLink(expression: string, options?: { autoSolve?: boolean }): string {
  const base = `/calculadora?expression=${encodeURIComponent(expression)}`;
  return options?.autoSolve ? `${base}&autoSolve=1` : base;
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
  // Sprint V2.4 — Sistemas Lineares. Só "sistema-linear-2x2" ganha a ação
  // "Abrir na calculadora": é a única das quatro fórmulas novas com um
  // exemplo numérico concreto e resolvível ("AX=B"/a condição do
  // determinante/Cramer são conceituais, sem um único exemplo natural —
  // regra "nunca mostrar ação sem destino funcional").
  "sistema-linear-2x2": [
    { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("x+y=5\nx-y=1") },
    { icon: "📝", label: "Exercícios relacionados", href: exercisesLink("algebra-linear") },
  ],
  // Sprint V2.3 — Motor de Números Complexos.
  "definicao-numero-complexo": [
    { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("3+4i") },
    { icon: "📝", label: "Exercícios relacionados", href: exercisesLink("numeros-complexos") },
  ],
  "conjugado-complexo": [
    { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("conjugado(3+4i)") },
  ],
  "modulo-complexo": [
    { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("modulo(3+4i)") },
  ],
  "argumento-complexo": [
    { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("argumento(1+i)") },
  ],
  "forma-polar-complexo": [
    { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("polar(1+i)") },
  ],
  "formula-euler": [
    { icon: "🧮", label: "Ver forma polar relacionada", href: calculatorLink("polar(1+i)") },
  ],
  // Sprint V2.5 — Motor de Sistemas Polinomiais Não Lineares.
  "sistema-nao-linear-exemplo": [
    { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("x**2+y=5\nx-y=1") },
    { icon: "📝", label: "Exercícios relacionados", href: exercisesLink("algebra-basica") },
  ],
  // Sprint V2.6 — Motor de Polinômios Avançados.
  "grau-polinomio": [
    { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("grau(x⁵+2x²+1)") },
    { icon: "📝", label: "Exercícios relacionados", href: exercisesLink("algebra-basica") },
  ],
  "fatoracao-raizes": [
    { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("raízes(x³-6x²+11x-6)") },
  ],
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

// Sprint V2.4 (Sistemas Lineares) — mesmo critério de `to-latex.ts`
// (`EQUATION_SPLIT`): um "=" de igualdade real, não "<="/">="/"=="/"!=".
const SYSTEM_EQUATION_SPLIT_PATTERN = /(?<![<>!=])=(?!=)/;

/** Uma "instrução" (já dividida por `splitMatrixStatements`) parece uma única equação: exatamente um "=" com os dois lados não vazios. */
function isSingleEquationStatement(statement: string): boolean {
  const parts = statement.split(SYSTEM_EQUATION_SPLIT_PATTERN);
  return parts.length === 2 && parts[0].trim() !== "" && parts[1].trim() !== "";
}

/**
 * Sprint V2.5 (Motor de Sistemas Polinomiais Não Lineares) — mesmo
 * espírito de `to-latex.ts:TRANSCENDENTAL_SYSTEM_MARKER_PATTERN`
 * (duplicado aqui de propósito, módulos de camadas diferentes; o
 * marcador de POTÊNCIA/PRODUTO abaixo é exclusivo deste arquivo — a
 * conversão LaTeX não distingue grau, só a classificação do Explorar
 * precisa). O backend agora resolve sistemas POLINOMIAIS de qualquer
 * grau (`equations/nonlinear.py`, via `sympy.nonlinsolve`) — potência
 * ("**"/"^"/sobrescrito Unicode) ou produto entre duas incógnitas
 * ("x*y", nunca confundido com "2*x", coeficiente vezes variável) já NÃO
 * são mais motivo de exclusão, só decidem se o sistema é classificado
 * como linear ou não linear. Também casa produto de dois grupos entre
 * parênteses ("(x+1)*(y-2)" — forma fatorada de uma equação de grau 2),
 * que "identificador*identificador" sozinho não cobre. Função
 * transcendental (seno/cosseno/tangente/log/ln/exp/módulo) continua fora
 * de escopo dos dois motores — mesma exclusão em ambos os detectores
 * abaixo (`TRANSCENDENTAL_MARKER_PATTERN`).
 */
const NONLINEAR_MARKER_PATTERN =
  /\*\*|\^|[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ]|\)\s*\*\s*\(|[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ0-9_]*\s*\*\s*[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ0-9_]*/;

const TRANSCENDENTAL_MARKER_PATTERN =
  /\b(sen|sin|cos|tg|tan|asin|acos|atan|log|ln|exp|Abs|modulo)\s*\(/i;

/**
 * Divide a expressão em "instruções" (bracket-aware, reutiliza
 * `splitMatrixStatements` ACIMA) e confirma a forma comum aos dois
 * detectores de sistema: 2+ instruções, cada uma "lado = lado", nenhuma
 * função transcendental — mesma exclusão de `isMatrix` (matriz tem
 * prioridade na cascata real do backend, `math_engine/dispatcher.py`).
 * `null` = não é um sistema de forma nenhuma (nem linear, nem não
 * linear); os dois detectores públicos abaixo só decidem o GRAU a partir
 * daqui.
 */
function systemStatementsOrNull(expression: string): string[] | null {
  if (isMatrix(expression)) return null;
  const statements = splitMatrixStatements(expression);
  if (statements.length < 2 || !statements.every(isSingleEquationStatement)) return null;
  if (statements.some((statement) => TRANSCENDENTAL_MARKER_PATTERN.test(statement))) return null;
  return statements;
}

/**
 * Sprint V2.4 (Sistemas Lineares) — mesmo critério do backend
 * (`equations/nonlinear_validation.py:is_linear_system`, grau total <= 1
 * em todos os símbolos via árvore SymPy): aqui, sem SymPy disponível, a
 * aproximação é a AUSÊNCIA de qualquer marcador de potência/produto
 * (`NONLINEAR_MARKER_PATTERN`) — sempre `false` para uma única equação
 * (nada a distinguir de uma equação comum) ou instruções separadas por
 * ";" que não sejam equações (ex. "2+2; 3+3").
 */
export function isLinearSystem(expression: string): boolean {
  const statements = systemStatementsOrNull(expression);
  if (statements === null) return false;
  return !statements.some((statement) => NONLINEAR_MARKER_PATTERN.test(statement));
}

/**
 * Sprint V2.5 (Motor de Sistemas Polinomiais Não Lineares) — mesma forma
 * de sistema que `isLinearSystem`, mas exige que PELO MENOS uma equação
 * tenha um marcador claro de potência/produto entre incógnitas (senão é
 * um sistema linear, tratado por `isLinearSystem`/`solve_linear_system` —
 * os dois detectores são mutuamente exclusivos por construção).
 */
export function isNonlinearSystem(expression: string): boolean {
  const statements = systemStatementsOrNull(expression);
  if (statements === null) return false;
  return statements.some((statement) => NONLINEAR_MARKER_PATTERN.test(statement));
}

/**
 * Sprint V2.3 (Motor de Números Complexos) — mesmo critério do backend
 * (`complex/dispatcher.py:is_complex_domain_expression`): uma chamada
 * conhecida (canônica ou alias PT-BR/EN) em qualquer posição, OU a
 * unidade imaginária como token isolado — nunca quando a expressão
 * contém "=" (preserva o comportamento de equações/definições de função
 * já existente, mesmo raciocínio do backend).
 */
const COMPLEX_FUNCTION_PATTERN = /\b(conjugado|conj|modulo|abs|argumento|arg|polar)\s*\(/i;

// "i"/"I" isolado de QUALQUER letra/underscore dos dois lados — mas
// dígito colado do lado esquerdo é permitido de propósito, para casar
// "4i"/"-4i"/"3-4i" (implicit multiplication). NÃO usar `\bi\b`: dígito
// também é caractere de palavra para `\b`, então não haveria fronteira
// entre "4" e "i" — mesmo bug (e mesma correção) do backend, ver
// `complex/dispatcher.py`.
const IMAGINARY_UNIT_TOKEN_PATTERN = /(?<![A-Za-z_])[iI](?![A-Za-z_])/;

export function isComplex(expression: string): boolean {
  if (expression.includes("=")) return false;
  if (COMPLEX_FUNCTION_PATTERN.test(expression)) return true;
  return IMAGINARY_UNIT_TOKEN_PATTERN.test(expression);
}

/**
 * Sprint V2.6 (Motor de Polinômios Avançados) — mesmo critério do backend
 * (`polynomials/dispatcher.py:is_polynomial_domain_expression`, via
 * `parsing.match_polynomial_call`): uma chamada às sete operações
 * (canônica ASCII ou acentuada) em qualquer posição do texto. Aceita as
 * duas grafias (`raizes`/`raízes`, `divisao`/`divisão`) só para
 * DETECÇÃO — o teclado sempre insere a forma ASCII (ver `data/keyboard.ts`).
 */
const POLYNOMIAL_FUNCTION_PATTERN =
  /\b(fatorar|expandir|simplificar|grau|coeficientes|ra[ií]zes|divis[aã]o)\s*\(/i;

export function isPolynomialOperation(expression: string): boolean {
  return POLYNOMIAL_FUNCTION_PATTERN.test(expression);
}

/**
 * Sprint V2.7 (Motor de Combinatória) — mesmo critério do backend
 * (`combinatorics/dispatcher.py:is_combinatorics_domain_expression`, via
 * `parsing.match_combinatorics_call`): chamada a uma das cinco operações
 * (canônica ASCII ou acentuada), detectada em qualquer posição do texto —
 * exceto os aliases de livro didático C(...)/A(...)/P(...), que só contam
 * ANCORADOS na expressão inteira e em MAIÚSCULA (espelho exato do regex
 * ancorado e case-sensitive do backend — "a(8,3)" é álgebra livre, e um
 * "P(…)" no meio de um texto qualquer não pode sequestrar a detecção).
 * Sem flag `i` no padrão de nomes completos por causa disso; as grafias
 * PT-BR já estão listadas explicitamente.
 */
const COMBINATORICS_FUNCTION_PATTERN =
  /\b(fatorial|fat|permuta[cç][aã]o(?:_repeti[cç][aã]o)?|arranjo|combina[cç][aã]o)\s*\(/;

const COMBINATORICS_TEXTBOOK_CALL_PATTERN = /^\s*[CAP]\s*\(.*\)\s*$/;

export function isCombinatoricsOperation(expression: string): boolean {
  return (
    COMBINATORICS_FUNCTION_PATTERN.test(expression) ||
    COMBINATORICS_TEXTBOOK_CALL_PATTERN.test(expression)
  );
}

/**
 * Sprint V2.2.1 (Variáveis Locais para Matrizes) — a expressão INTEIRA já
 * É uma chamada pronta a det/trace (canônico ou alias PT-BR), ex.
 * "det(A)". Usado para decidir quando OMITIR "Ver propriedades": compor
 * "det(det(A))" não faz sentido — a propriedade já é o resultado pedido
 * (um escalar).
 *
 * Correção (investigação "Ver propriedades", pós-Sprint V2.3): SÓ
 * det/trace entram aqui — inv/transpose foram removidos deliberadamente.
 * A versão anterior tratava os quatro igual, escondendo "Ver
 * propriedades" também para "inv(A)"/"transpose(A)", mesmo o RESULTADO
 * deles sendo uma matriz (não um escalar): "det(inv(A))"/"det(transpose(A))"
 * são cálculos diferentes e úteis, não uma composição redundante como
 * "det(det(A))" — ver `isMatrixPropertyCall` sendo chamado só para decidir
 * OMISSÃO, nunca para decidir se `isMatrix` reconhece a expressão.
 */
const SCALAR_MATRIX_PROPERTY_CALL_PATTERN = /^(det|trace|determinante|traço)\s*\(.*\)$/i;

function isMatrixPropertyCall(statement: string): boolean {
  return SCALAR_MATRIX_PROPERTY_CALL_PATTERN.test(statement.trim());
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
 *
 * `{ autoSolve: true }` (investigação pós-Sprint V2.3): sem isso, o link
 * só pré-preenche o campo — o usuário chegava em `/calculadora` com
 * `det(...)` escrito, mas nada calculado, precisando clicar "Resolver"
 * de novo. Ver `CalculatorWorkspace.tsx` para onde o marcador é
 * consumido.
 */
function buildMatrixPropertiesLink(expression: string): string {
  const statements = splitMatrixStatements(expression);
  if (statements.length === 0) {
    return calculatorLink(`det(${expression.trim()})`, { autoSolve: true });
  }
  const finalStatement = statements[statements.length - 1];
  const program = [...statements.slice(0, -1), `det(${finalStatement})`].join("\n");
  return calculatorLink(program, { autoSolve: true });
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
      links.push({
        icon: "🧮",
        label: "Ver propriedades",
        href: buildMatrixPropertiesLink(expression),
        requiresFreshRequest: true,
      });
    }
    links.push({
      icon: "📚",
      label: "Ver fórmulas relacionadas",
      href: formulasLink({ categoria: "algebra-linear" }),
    });
    links.push({ icon: "📝", label: "Exercícios semelhantes", href: exercisesLink("algebra-linear") });
    return links;
  }

  // Checado logo depois de `isMatrix` — mesma posição do Motor de Números
  // Complexos na cascata do backend (`math_engine/dispatcher.py`: complex
  // entra depois de matrix, antes de calculus/functions/trigonometry/
  // logarithms/equations).
  if (isComplex(finalStatement)) {
    return [
      {
        icon: "📚",
        label: "Ver fórmulas relacionadas",
        href: formulasLink({ categoria: "numeros-complexos" }),
      },
      { icon: "📝", label: "Exercícios semelhantes", href: exercisesLink("numeros-complexos") },
    ];
  }

  // Checado logo depois de `isComplex` — mesma posição do Motor de
  // Polinômios Avançados na cascata do backend (`math_engine/dispatcher.py`:
  // polynomials entra depois de complex, antes de calculus/functions/
  // trigonometry/logarithms/equations).
  if (isPolynomialOperation(finalStatement)) {
    return [
      {
        icon: "📚",
        label: "Ver fórmulas relacionadas",
        href: formulasLink({ categoria: "algebra", q: "polinomio" }),
      },
      { icon: "📝", label: "Exercícios semelhantes", href: exercisesLink("algebra-basica") },
    ];
  }

  // Sprint V2.7 (Motor de Combinatória) — checado logo depois de
  // `isPolynomialOperation`, mesma posição da cascata do backend
  // (`math_engine/dispatcher.py`: combinatorics entra depois de
  // polynomials, antes de calculus/functions/trigonometry/logarithms/
  // equations). Destinos válidos garantidos: a categoria "combinatoria"
  // existe em `data/formulas.ts` (V2.7) e "algebra-basica" é um dos
  // tópicos seedados de /aprendizado (mesma escolha da V2.6 — não há
  // tópico de combinatória seedado ainda).
  if (isCombinatoricsOperation(finalStatement)) {
    return [
      {
        icon: "📚",
        label: "Ver fórmulas relacionadas",
        href: formulasLink({ categoria: "combinatoria" }),
      },
      { icon: "📝", label: "Exercícios semelhantes", href: exercisesLink("algebra-basica") },
    ];
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

  // Checado por último — mesma posição de "equations" na cascata do
  // backend (`math_engine/dispatcher.py`: depois de summation/matrix/
  // complex/calculus/functions/trigonometry/logarithms, logo antes do
  // fallback de álgebra pura). Usa `expression` inteira (não
  // `finalStatement`): um sistema É o conjunto de equações — a última
  // linha sozinha ("x-y=1") não basta para reconhecer o sistema.
  if (isLinearSystem(expression)) {
    return [
      { icon: "📚", label: "Ver fórmula relacionada", href: formulasLink({ categoria: "algebra-linear" }) },
      { icon: "📝", label: "Exercícios semelhantes", href: exercisesLink("algebra-linear") },
    ];
  }

  // Sprint V2.5 (Motor de Sistemas Polinomiais Não Lineares) — checado
  // logo depois de `isLinearSystem` (mutuamente exclusivos por
  // construção: um sistema nunca é as duas coisas ao mesmo tempo). Usa
  // `expression` inteira pelo mesmo motivo do bloco linear acima.
  if (isNonlinearSystem(expression)) {
    return [
      { icon: "📚", label: "Ver fórmula relacionada", href: formulasLink({ categoria: "algebra", q: "sistema" }) },
      { icon: "📝", label: "Exercícios semelhantes", href: exercisesLink("algebra-basica") },
    ];
  }

  return [];
}
