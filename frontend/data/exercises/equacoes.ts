import type { ExerciseDraft } from "./types";

/**
 * Tópico "equacoes". Os 3 primeiros (position 1-3) vieram do seed
 * original (`supabase/migrations/0002_topics_exercises.sql`) — nunca
 * alterados depois. Os 6 seguintes (position 4-9) foram adicionados na
 * expansão do catálogo (18 exercícios novos, 6 por tópico): primeiro
 * grau simples/parênteses/frações, segundo grau completa/incompleta e
 * análise do discriminante — slugs continuam a numeração das famílias
 * já existentes quando o conteúdo é o mesmo (ex.: `primeiro-grau-002`,
 * `discriminante-002`), e ganham prefixo novo só quando a técnica é
 * realmente distinta (ex.: `primeiro-grau-parenteses`, `primeiro-grau-fracoes`,
 * `segundo-grau-incompleta`).
 *
 * Sprint "KaTeX em alternativas" — alternativas de valor único ("x = 3")
 * ganharam `{content, format: "math"}`. Alternativas que juntam DUAS
 * soluções com "e"/"ou" em português ("x = 2 e x = 3", "k = 3 ou
 * k = -3") ficaram como texto puro — são exatamente o caso "texto
 * misturado com matemática" que o ticket pediu para NÃO tentar
 * renderizar sem suporte a segmentos (ver `ExerciseChoiceContent.tsx`).
 */
export const EQUACOES_EXERCISES: ExerciseDraft[] = [
  {
    slug: "equacoes-primeiro-grau-001",
    topicSlug: "equacoes",
    difficulty: "facil",
    position: 1,
    statement: "Resolva a equação:",
    statementLatex: String.raw`2x + 6 = 0`,
    choices: [
      { content: "x = 3", format: "math" },
      { content: "x = -3", format: "math" },
      { content: "x = -6", format: "math" },
      { content: "x = 6", format: "math" },
    ],
    correctIndex: 1,
    explanation: "2x = −6, logo x = −3.",
  },
  {
    slug: "equacoes-segundo-grau-001",
    topicSlug: "equacoes",
    difficulty: "medio",
    position: 2,
    statement: "Quais são as raízes da equação?",
    statementLatex: String.raw`x^2 - 5x + 6 = 0`,
    choices: ["x = 1 e x = 6", "x = -2 e x = -3", "x = 2 e x = 3", "x = -1 e x = -6"],
    correctIndex: 2,
    explanation: "Soma 5 e produto 6: as raízes são 2 e 3.",
  },
  {
    slug: "equacoes-discriminante-001",
    topicSlug: "equacoes",
    difficulty: "dificil",
    position: 3,
    statement: "Para qual valor de k a equação tem exatamente uma raiz real?",
    statementLatex: String.raw`x^2 + kx + 9 = 0`,
    choices: [
      "k = 3 ou k = -3",
      { content: "k = 9", format: "math" },
      "k = 6 ou k = -6",
      { content: "k = 0", format: "math" },
    ],
    correctIndex: 2,
    explanation: "Uma raiz real exige Δ = 0: k² − 36 = 0, logo k = ±6.",
  },
  {
    slug: "equacoes-primeiro-grau-002",
    topicSlug: "equacoes",
    difficulty: "facil",
    position: 4,
    statement: "Resolva a equação:",
    statementLatex: String.raw`3x - 9 = 0`,
    choices: [
      { content: "x = 3", format: "math" },
      { content: "x = -3", format: "math" },
      { content: "x = 9", format: "math" },
      { content: "x = 6", format: "math" },
    ],
    correctIndex: 0,
    explanation: "3x = 9, logo x = 9/3 = 3.",
  },
  {
    slug: "equacoes-primeiro-grau-parenteses-001",
    topicSlug: "equacoes",
    difficulty: "facil",
    position: 5,
    statement: "Resolva a equação:",
    statementLatex: String.raw`2(x + 3) = 10`,
    choices: [
      { content: "x = 2", format: "math" },
      { content: "x = 4", format: "math" },
      { content: "x = -2", format: "math" },
      { content: "x = 5", format: "math" },
    ],
    correctIndex: 0,
    explanation: "Aplique a propriedade distributiva: 2(x+3) = 2x + 6. A equação fica 2x + 6 = 10. Isole x: 2x = 10 − 6 = 4, logo x = 4/2 = 2.",
  },
  {
    slug: "equacoes-primeiro-grau-fracoes-001",
    topicSlug: "equacoes",
    difficulty: "medio",
    position: 6,
    statement: "Resolva a equação:",
    statementLatex: String.raw`\dfrac{x}{2} + 3 = 7`,
    choices: [
      { content: "x = 8", format: "math" },
      { content: "x = 4", format: "math" },
      { content: "x = 14", format: "math" },
      { content: "x = 2", format: "math" },
    ],
    correctIndex: 0,
    explanation: "Isole o termo com x: x/2 = 7 − 3 = 4. Multiplique os dois lados por 2: x = 4 · 2 = 8.",
  },
  {
    slug: "equacoes-segundo-grau-incompleta-001",
    topicSlug: "equacoes",
    difficulty: "medio",
    position: 7,
    statement: "Resolva a equação:",
    statementLatex: String.raw`x^2 - 16 = 0`,
    choices: [
      "x = 4 ou x = -4",
      { content: "x = 16", format: "math" },
      "x = 8 ou x = -8",
      { content: "x = 4", format: "math" },
    ],
    correctIndex: 0,
    explanation: "Isole x²: x² = 16. Como não há termo em x (equação incompleta), extraia a raiz quadrada dos dois lados, considerando as duas soluções: x = ±√16 = ±4.",
  },
  {
    slug: "equacoes-segundo-grau-002",
    topicSlug: "equacoes",
    difficulty: "dificil",
    position: 8,
    statement: "Quais são as raízes da equação?",
    statementLatex: String.raw`2x^2 - 5x - 3 = 0`,
    choices: ["x = 3 e x = -1/2", "x = 3 e x = 1/2", "x = -3 e x = 1/2", "x = 6 e x = -1"],
    correctIndex: 0,
    explanation: "Use a fórmula de Bhaskara com a=2, b=−5, c=−3. Δ = (−5)² − 4·2·(−3) = 25 + 24 = 49. √Δ = 7. x = (5 ± 7)/(2·2) = (5 ± 7)/4. Logo x = 12/4 = 3 ou x = −2/4 = −1/2.",
  },
  {
    slug: "equacoes-discriminante-002",
    topicSlug: "equacoes",
    difficulty: "dificil",
    position: 9,
    statement: "Para quais valores de k a equação tem duas raízes reais e distintas?",
    statementLatex: String.raw`x^2 - 4x + k = 0`,
    choices: [
      { content: "k < 4", format: "math" },
      { content: "k > 4", format: "math" },
      { content: "k = 4", format: "math" },
      { content: "k ≤ 4", format: "math" },
    ],
    correctIndex: 0,
    explanation: "Duas raízes reais e distintas exigem Δ > 0. Δ = (−4)² − 4·1·k = 16 − 4k. A condição 16 − 4k > 0 dá k < 4.",
  },
];
