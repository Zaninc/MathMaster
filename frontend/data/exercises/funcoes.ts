import type { ExerciseDraft } from "./types";

/**
 * Tópico "funcoes". Os 3 primeiros (position 1-3) vieram do seed
 * original (`supabase/migrations/0002_topics_exercises.sql`) — nunca
 * alterados depois. Os 6 seguintes (position 4-9) foram adicionados na
 * expansão do catálogo (18 exercícios novos, 6 por tópico): avaliação,
 * imagem, domínio de função racional, zero de função afim, composição e
 * interpretação de função quadrática — slugs continuam a numeração das
 * famílias já existentes quando o conteúdo é o mesmo (ex.:
 * `avaliacao-002`, `dominio-002`, `composicao-002`), e ganham prefixo
 * novo só quando o conceito é realmente distinto (ex.: `imagem`, `zero`,
 * `quadratica`).
 */
export const FUNCOES_EXERCISES: ExerciseDraft[] = [
  {
    slug: "funcoes-avaliacao-001",
    topicSlug: "funcoes",
    difficulty: "facil",
    position: 1,
    statement: "Se f(x) = 2x + 1, quanto vale f(3)?",
    choices: ["6", "5", "7", "9"],
    correctIndex: 2,
    explanation: "f(3) = 2·3 + 1 = 7.",
  },
  {
    slug: "funcoes-dominio-001",
    topicSlug: "funcoes",
    difficulty: "medio",
    position: 2,
    statement: "Qual é o domínio da função?",
    statementLatex: String.raw`f(x) = \dfrac{1}{x - 4}`,
    choices: ["x > 4", "Todos os reais", "Todos os reais exceto 0", "Todos os reais exceto 4"],
    correctIndex: 3,
    explanation: "O denominador não pode ser zero: x − 4 ≠ 0, logo x ≠ 4.",
  },
  {
    slug: "funcoes-composicao-001",
    topicSlug: "funcoes",
    difficulty: "dificil",
    position: 3,
    statement: "Se f(x) = x² e g(x) = x + 1, qual é f(g(2))?",
    choices: ["5", "6", "3", "9"],
    correctIndex: 3,
    explanation: "g(2) = 3 e f(3) = 3² = 9.",
  },
  {
    slug: "funcoes-avaliacao-002",
    topicSlug: "funcoes",
    difficulty: "facil",
    position: 4,
    statement: "Se f(x) = 3x - 2, quanto vale f(4)?",
    choices: ["10", "12", "14", "9"],
    correctIndex: 0,
    explanation: "f(4) = 3·4 − 2 = 12 − 2 = 10.",
  },
  {
    slug: "funcoes-imagem-001",
    topicSlug: "funcoes",
    difficulty: "facil",
    position: 5,
    statement: "Qual é a imagem de x = -2 pela função f(x) = x² + 1?",
    choices: ["5", "4", "-3", "3"],
    correctIndex: 0,
    explanation: "A imagem de x = −2 pela função f é f(−2). Calcule: f(−2) = (−2)² + 1 = 4 + 1 = 5.",
  },
  {
    slug: "funcoes-zero-001",
    topicSlug: "funcoes",
    difficulty: "medio",
    position: 6,
    statement: "Qual é o zero da função afim?",
    statementLatex: String.raw`f(x) = 3x - 12`,
    choices: ["x = 4", "x = -4", "x = 12", "x = 36"],
    correctIndex: 0,
    explanation: "O zero da função é o valor de x para o qual f(x) = 0. Resolva 3x − 12 = 0: 3x = 12, logo x = 4.",
  },
  {
    slug: "funcoes-composicao-002",
    topicSlug: "funcoes",
    difficulty: "medio",
    position: 7,
    statement: "Se f(x) = x + 3 e g(x) = 2x, qual é o valor de g(f(1))?",
    choices: ["8", "5", "4", "6"],
    correctIndex: 0,
    explanation: "Calcule de dentro para fora: primeiro f(1) = 1 + 3 = 4. Depois aplique g ao resultado: g(4) = 2·4 = 8.",
  },
  {
    slug: "funcoes-dominio-002",
    topicSlug: "funcoes",
    difficulty: "dificil",
    position: 8,
    statement: "Qual é o domínio da função?",
    statementLatex: String.raw`f(x) = \dfrac{1}{x^2 - 9}`,
    choices: ["Todos os reais exceto x = 3 e x = -3", "Todos os reais exceto x = 9", "Todos os reais exceto x = 3", "x > 3 ou x < -3"],
    correctIndex: 0,
    explanation: "O denominador não pode ser zero: x² − 9 ≠ 0. Resolvendo x² − 9 = 0 (diferença de quadrados): x² = 9, logo x = 3 ou x = −3. O domínio é todos os reais, exceto esses dois valores.",
  },
  {
    slug: "funcoes-quadratica-001",
    topicSlug: "funcoes",
    difficulty: "dificil",
    position: 9,
    statement: "Qual é o valor mínimo da função?",
    statementLatex: String.raw`f(x) = x^2 - 6x + 5`,
    choices: ["-4", "5", "3", "-9"],
    correctIndex: 0,
    explanation: "Como a = 1 > 0, a parábola tem concavidade para cima, então o vértice é o ponto de valor mínimo. A coordenada x do vértice é x = −b/2a = 6/2 = 3. O valor mínimo é f(3) = 3² − 6·3 + 5 = 9 − 18 + 5 = −4.",
  },
];
