import type { ExerciseDraft } from "./types";

/**
 * Tópico "algebra-basica". Os 3 primeiros (position 1-3) vieram do seed
 * original (`supabase/migrations/0002_topics_exercises.sql`, já com a
 * correção de notação do commit `17e9271`) — nunca alterados depois.
 * Os 6 seguintes (position 4-9) foram adicionados na expansão do
 * catálogo (18 exercícios novos, 6 por tópico): simplificação,
 * distributiva, produto notável, fator comum, fração algébrica e
 * diferença de quadrados — slugs continuam a numeração das famílias já
 * existentes quando o conteúdo é o mesmo (ex.: `simplificacao-002`,
 * `fatoracao-002`), e ganham prefixo novo só quando a técnica é
 * realmente distinta (ex.: `distributiva`, `produto-notavel`,
 * `fator-comum`).
 */
export const ALGEBRA_BASICA_EXERCISES: ExerciseDraft[] = [
  {
    slug: "algebra-basica-simplificacao-001",
    topicSlug: "algebra-basica",
    difficulty: "facil",
    position: 1,
    statement: "Simplifique a expressão:",
    statementLatex: String.raw`3x + 2x - x`,
    choices: ["5x", "4x", "6x", "x"],
    correctIndex: 1,
    explanation: "3x + 2x - x = (3 + 2 - 1)x = 4x.",
  },
  {
    slug: "algebra-basica-fatoracao-001",
    topicSlug: "algebra-basica",
    difficulty: "medio",
    position: 2,
    statement: "Fatore completamente:",
    statementLatex: String.raw`x^2 - 9`,
    choices: ["(x−3)(x+3)", "(x−9)(x+1)", "(x−3)²", "x(x−9)"],
    correctIndex: 0,
    explanation: "Diferença de quadrados: x² − 9 = x² − 3² = (x−3)(x+3).",
  },
  {
    slug: "algebra-basica-expressao-racional-001",
    topicSlug: "algebra-basica",
    difficulty: "dificil",
    position: 3,
    statement: "Qual é o valor da expressão quando x = 2?",
    statementLatex: String.raw`\dfrac{x^3 - 8}{x - 2}`,
    choices: ["0", "12", "8", "indefinido"],
    correctIndex: 1,
    explanation: "x³ − 8 = (x−2)(x² + 2x + 4); cancelando (x−2), sobra x² + 2x + 4 = 4 + 4 + 4 = 12.",
  },
  {
    slug: "algebra-basica-simplificacao-002",
    topicSlug: "algebra-basica",
    difficulty: "facil",
    position: 4,
    statement: "Simplifique a expressão:",
    statementLatex: String.raw`8x - 3x + x`,
    choices: ["6x", "5x", "4x", "12x"],
    correctIndex: 0,
    explanation: "Agrupe os termos semelhantes (mesmo x): 8x − 3x + x = (8 − 3 + 1)x. Some os coeficientes: 8 − 3 + 1 = 6. Logo, 8x − 3x + x = 6x.",
  },
  {
    slug: "algebra-basica-distributiva-001",
    topicSlug: "algebra-basica",
    difficulty: "facil",
    position: 5,
    statement: "Aplique a propriedade distributiva e simplifique:",
    statementLatex: String.raw`2(x + 5)`,
    choices: ["2x + 10", "2x + 5", "x + 10", "2x + 7"],
    correctIndex: 0,
    explanation: "Propriedade distributiva: multiplique 2 por cada termo dentro dos parênteses. 2·x + 2·5 = 2x + 10.",
  },
  {
    slug: "algebra-basica-produto-notavel-001",
    topicSlug: "algebra-basica",
    difficulty: "medio",
    position: 6,
    statement: "Desenvolva o produto notável:",
    statementLatex: String.raw`(x + 4)^2`,
    choices: ["x² + 8x + 16", "x² + 16", "x² + 4x + 16", "x² + 8x + 8"],
    correctIndex: 0,
    explanation: "Quadrado da soma: (a+b)² = a² + 2ab + b², com a = x e b = 4. x² + 2·x·4 + 4² = x² + 8x + 16.",
  },
  {
    slug: "algebra-basica-fator-comum-001",
    topicSlug: "algebra-basica",
    difficulty: "medio",
    position: 7,
    statement: "Fatore, colocando o fator comum em evidência:",
    statementLatex: String.raw`6x^2 + 9x`,
    choices: ["3x(2x + 3)", "3(2x² + 3x)", "x(6x + 9)", "3x(2x + 9)"],
    correctIndex: 0,
    explanation: "O maior fator comum entre 6x² e 9x é 3x. Dividindo cada termo por 3x: 6x²/3x = 2x e 9x/3x = 3. Logo, 6x² + 9x = 3x(2x + 3).",
  },
  {
    slug: "algebra-basica-expressao-racional-002",
    topicSlug: "algebra-basica",
    difficulty: "dificil",
    position: 8,
    statement: "Simplifique a expressão, para x ≠ 2:",
    statementLatex: String.raw`\dfrac{x^2 - 4}{x - 2}`,
    choices: ["x + 2", "x - 2", "x² - 2", "2"],
    correctIndex: 0,
    explanation: "Fatore o numerador como diferença de quadrados: x² − 4 = (x−2)(x+2). Cancele o fator comum (x−2), válido pois x ≠ 2: (x−2)(x+2)/(x−2) = x + 2.",
  },
  {
    slug: "algebra-basica-fatoracao-002",
    topicSlug: "algebra-basica",
    difficulty: "dificil",
    position: 9,
    statement: "Fatore a expressão x² − 25 e use a fatoração para calcular seu valor quando x = 6:",
    statementLatex: String.raw`x^2 - 25`,
    choices: ["11", "1", "36", "61"],
    correctIndex: 0,
    explanation: "Fatore por diferença de quadrados: x² − 25 = x² − 5² = (x−5)(x+5). Substitua x = 6: (6−5)(6+5) = (1)(11) = 11.",
  },
];
