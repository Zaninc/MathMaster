import type { ExerciseDraft } from "./types";

/**
 * Tópico "exponenciais-logaritmos" (Sprint "Exponenciais e Logaritmos") —
 * requer a migração `supabase/migrations/0005_topic_exponenciais_
 * logaritmos.sql` já aplicada (cria o tópico) antes do sync deste
 * arquivo. Progressão pedagógica pedida pelo ticket: reconhecer uma
 * exponencial, bases iguais, expoente desconhecido, a constante e, log
 * natural, log de outra base, conversão entre forma exponencial/
 * logarítmica, domínio, equação exponencial que exige logaritmo e
 * equação exponencial por substituição.
 *
 * Sprint "KaTeX em alternativas" — alternativas matemáticas ganharam
 * `{content, format: "math"}`, verificado empiricamente contra o
 * conversor real (`previewLatex`) antes de marcar cada uma. Duas
 * exceções documentadas:
 * - `exponenciais-logaritmos-conversao-forma-001`: as 4 alternativas
 *   usam dígito subscrito Unicode logo após "log" (ex. "log₂(8) = 3") —
 *   `to-latex.ts` não reconhece esse padrão como o operador `\log` (rende
 *   como texto "log" comum + "_{2}" solto, quebrado); o exercício inteiro
 *   ficou como texto.
 * - `exponenciais-logaritmos-substituicao-001`: as duas primeiras
 *   alternativas juntam duas soluções com "ou" em português ("x = ln(2)
 *   ou x = ln(3)") — texto misturado com matemática, mesmo caso do
 *   tópico "equacoes"; só as duas últimas (uma solução só) viraram math.
 */
export const EXPONENCIAIS_LOGARITMOS_EXERCISES: ExerciseDraft[] = [
  {
    slug: "exponenciais-logaritmos-reconhecimento-001",
    topicSlug: "exponenciais-logaritmos",
    difficulty: "facil",
    position: 1,
    statement: "Qual das alternativas é uma função exponencial?",
    choices: [
      { content: "f(x) = 2^x", format: "math" },
      { content: "f(x) = x²", format: "math" },
      { content: "f(x) = 1/x", format: "math" },
      { content: "f(x) = x", format: "math" },
    ],
    correctIndex: 0,
    explanation:
      "Numa função exponencial a incógnita fica no expoente, com base constante positiva diferente de 1 — como em f(x) = 2^x. As demais são polinomial, racional e linear.",
  },
  {
    slug: "exponenciais-logaritmos-bases-iguais-001",
    topicSlug: "exponenciais-logaritmos",
    difficulty: "facil",
    position: 2,
    statement: "Resolva a equação:",
    statementLatex: String.raw`2^x = 8`,
    choices: [
      { content: "x = 3", format: "math" },
      { content: "x = 4", format: "math" },
      { content: "x = 2", format: "math" },
      { content: "x = 6", format: "math" },
    ],
    correctIndex: 0,
    explanation: "Reescrevendo 8 como potência de base 2: 8 = 2³. Como as bases já são iguais, os expoentes devem ser iguais: x = 3.",
  },
  {
    slug: "exponenciais-logaritmos-expoente-desconhecido-001",
    topicSlug: "exponenciais-logaritmos",
    difficulty: "medio",
    position: 3,
    statement: "Resolva a equação:",
    statementLatex: String.raw`3^{x+1} = 27`,
    choices: [
      { content: "x = 2", format: "math" },
      { content: "x = 3", format: "math" },
      { content: "x = 8", format: "math" },
      { content: "x = 9", format: "math" },
    ],
    correctIndex: 0,
    explanation: "27 = 3³, e como as bases são iguais, os expoentes devem ser iguais: x + 1 = 3, logo x = 2.",
  },
  {
    slug: "exponenciais-logaritmos-constante-e-001",
    topicSlug: "exponenciais-logaritmos",
    difficulty: "facil",
    position: 4,
    statement: "Simplifique a expressão:",
    statementLatex: String.raw`\ln(e)`,
    choices: [
      { content: "1", format: "math" },
      { content: "0", format: "math" },
      { content: "e", format: "math" },
      { content: "e²", format: "math" },
    ],
    correctIndex: 0,
    explanation: "ln e exp são funções inversas, então ln(e¹) = 1 — o próprio expoente que a base e precisa ter para resultar em e.",
  },
  {
    slug: "exponenciais-logaritmos-log-natural-001",
    topicSlug: "exponenciais-logaritmos",
    difficulty: "medio",
    position: 5,
    statement: "Resolva a equação:",
    statementLatex: String.raw`\ln(x) = 2`,
    choices: [
      { content: "x = e²", format: "math" },
      { content: "x = 2e", format: "math" },
      { content: "x = e/2", format: "math" },
      { content: "x = 2", format: "math" },
    ],
    correctIndex: 0,
    explanation: "ln e a função exponencial são inversas: ln(x) = 2 equivale a x = e². Não há forma mais simples de escrever esse valor.",
  },
  {
    slug: "exponenciais-logaritmos-log-outra-base-001",
    topicSlug: "exponenciais-logaritmos",
    difficulty: "medio",
    position: 6,
    statement: "Resolva a equação:",
    statementLatex: String.raw`\log_2(x) = 3`,
    choices: [
      { content: "x = 8", format: "math" },
      { content: "x = 6", format: "math" },
      { content: "x = 9", format: "math" },
      { content: "x = 16", format: "math" },
    ],
    correctIndex: 0,
    explanation: "log₂ e a potência de base 2 são inversas: log₂(x) = 3 equivale a x = 2³ = 8.",
  },
  {
    slug: "exponenciais-logaritmos-conversao-forma-001",
    topicSlug: "exponenciais-logaritmos",
    difficulty: "medio",
    position: 7,
    statement: "Qual é a forma logarítmica equivalente a 2³ = 8?",
    choices: ["log₂(8) = 3", "log₃(8) = 2", "log₈(2) = 3", "log₈(3) = 2"],
    correctIndex: 0,
    explanation: "A relação a^b = c equivale a log_a(c) = b. Com a=2, b=3, c=8: 2³ = 8 equivale a log₂(8) = 3.",
  },
  {
    slug: "exponenciais-logaritmos-dominio-001",
    topicSlug: "exponenciais-logaritmos",
    difficulty: "dificil",
    position: 8,
    statement: "Qual é o domínio da função?",
    statementLatex: String.raw`f(x) = \ln(x - 3)`,
    choices: [
      { content: "x > 3", format: "math" },
      { content: "x ≥ 3", format: "math" },
      { content: "x < 3", format: "math" },
      "Todos os reais",
    ],
    correctIndex: 0,
    explanation: "O argumento de um logaritmo precisa ser sempre positivo: x − 3 > 0, logo x > 3.",
  },
  {
    slug: "exponenciais-logaritmos-equacao-com-log-001",
    topicSlug: "exponenciais-logaritmos",
    difficulty: "dificil",
    position: 9,
    statement: "Resolva a equação:",
    statementLatex: String.raw`e^x = 5`,
    choices: [
      { content: "x = ln(5)", format: "math" },
      { content: "x = 5", format: "math" },
      { content: "x = e⁵", format: "math" },
      { content: "x = 1/5", format: "math" },
    ],
    correctIndex: 0,
    explanation:
      "5 não é uma potência exata de e, então bases iguais não se aplica. Aplique ln nos dois lados: ln(eˣ) = ln(5). Como ln(eˣ) = x, a solução é x = ln(5).",
  },
  {
    slug: "exponenciais-logaritmos-substituicao-001",
    topicSlug: "exponenciais-logaritmos",
    difficulty: "dificil",
    position: 10,
    statement: "Resolva a equação:",
    statementLatex: String.raw`e^{2x} - 5e^x + 6 = 0`,
    choices: [
      "x = ln(2) ou x = ln(3)",
      "x = 2 ou x = 3",
      { content: "x = ln(5)", format: "math" },
      { content: "x = ln(6)", format: "math" },
    ],
    correctIndex: 0,
    explanation:
      "Substituindo u = eˣ, a equação vira u² − 5u + 6 = 0, que fatora em (u−2)(u−3) = 0, dando u = 2 ou u = 3 (ambos positivos, válidos para u = eˣ). Voltando à substituição: eˣ = 2 → x = ln(2), ou eˣ = 3 → x = ln(3).",
  },
];
