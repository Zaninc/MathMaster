import { describe, expect, it } from "vitest";

import type { Topic } from "@/lib/supabase/types";

import {
  buildRecommendations,
  computeTopicMetrics,
  MAX_RECOMMENDATIONS,
  type AttemptInput,
} from "./metrics";

const TOPICS: Topic[] = [
  { id: "t-alg", slug: "algebra", title: "Álgebra básica", description: null, position: 1 },
  { id: "t-eq", slug: "equacoes", title: "Equações", description: null, position: 2 },
  { id: "t-fn", slug: "funcoes", title: "Funções", description: null, position: 3 },
];

const EXERCISES = [
  { id: "ex-a1", topic_id: "t-alg" },
  { id: "ex-a2", topic_id: "t-alg" },
  { id: "ex-a3", topic_id: "t-alg" },
  { id: "ex-e1", topic_id: "t-eq" },
  { id: "ex-e2", topic_id: "t-eq" },
  { id: "ex-f1", topic_id: "t-fn" },
];

/** created_at crescente com o índice — i maior = mais recente. */
function attempt(exerciseId: string, isCorrect: boolean, i: number): AttemptInput {
  return {
    exercise_id: exerciseId,
    is_correct: isCorrect,
    created_at: `2026-07-19T10:${String(i).padStart(2, "0")}:00.000Z`,
  };
}

function metricsFor(attempts: AttemptInput[]) {
  return computeTopicMetrics(TOPICS, EXERCISES, attempts);
}

describe("computeTopicMetrics", () => {
  it("tópico sem tentativas fica como não iniciado, com domínio null (não 0%)", () => {
    const [alg, eq, fn] = metricsFor([attempt("ex-a1", true, 1)]);

    expect(alg.started).toBe(true);
    expect(eq.standing).toBe("nao-iniciado");
    expect(eq.domain).toBeNull();
    expect(eq.confidence).toBeNull();
    expect(fn.standing).toBe("nao-iniciado");
  });

  it("100% de acertos dá domínio 100, tudo errado dá 0", () => {
    const [alg] = metricsFor([attempt("ex-a1", true, 1), attempt("ex-a2", true, 2)]);
    expect(alg.domain).toBe(100);

    const [alg2] = metricsFor([attempt("ex-a1", false, 1), attempt("ex-a2", false, 2)]);
    expect(alg2.domain).toBe(0);
  });

  it("tentativas recentes pesam mais: erro novo derruba mais que erro velho", () => {
    // mesmos 1 erro + 3 acertos, mudando só ONDE está o erro
    const errorOldest = [
      attempt("ex-a1", false, 1),
      attempt("ex-a2", true, 2),
      attempt("ex-a3", true, 3),
      attempt("ex-a1", true, 4),
    ];
    const errorNewest = [
      attempt("ex-a1", true, 1),
      attempt("ex-a2", true, 2),
      attempt("ex-a3", true, 3),
      attempt("ex-a1", false, 4),
    ];

    const domainErrorOld = metricsFor(errorOldest)[0].domain!;
    const domainErrorNew = metricsFor(errorNewest)[0].domain!;

    expect(domainErrorNew).toBeLessThan(domainErrorOld);
    // média simples seria 75 nos dois casos — a ponderação separa os cenários
    expect(domainErrorOld).toBeGreaterThan(75);
    expect(domainErrorNew).toBeLessThan(75);
  });

  it("confiança cresce com o volume: baixa <4, média 4-9, alta >=10", () => {
    const three = Array.from({ length: 3 }, (_, i) => attempt("ex-a1", true, i));
    expect(metricsFor(three)[0].confidence).toBe("baixa");

    const four = Array.from({ length: 4 }, (_, i) => attempt("ex-a1", true, i));
    expect(metricsFor(four)[0].confidence).toBe("media");

    const ten = Array.from({ length: 10 }, (_, i) => attempt("ex-a1", true, i));
    expect(metricsFor(ten)[0].confidence).toBe("alta");
  });

  it("progresso conta exercícios distintos tentados, não tentativas", () => {
    const [alg] = metricsFor([
      attempt("ex-a1", true, 1),
      attempt("ex-a1", false, 2),
      attempt("ex-a1", true, 3),
      attempt("ex-a2", true, 4),
    ]);

    expect(alg.attemptsCount).toBe(4);
    expect(alg.exercisesTried).toBe(2);
    expect(alg.exercisesTotal).toBe(3);
  });

  it("forte exige domínio alto E confiança pelo menos média", () => {
    // 2 acertos: domínio 100 mas confiança baixa → neutro, não forte
    const [algLowConfidence] = metricsFor([attempt("ex-a1", true, 1), attempt("ex-a2", true, 2)]);
    expect(algLowConfidence.standing).toBe("neutro");

    const [algStrong] = metricsFor(Array.from({ length: 5 }, (_, i) => attempt("ex-a1", true, i)));
    expect(algStrong.standing).toBe("forte");
  });

  it("domínio abaixo de 50 marca o tópico como fraco", () => {
    const [alg] = metricsFor([
      attempt("ex-a1", false, 1),
      attempt("ex-a2", false, 2),
      attempt("ex-a3", true, 3),
      attempt("ex-a1", false, 4),
    ]);
    expect(alg.standing).toBe("fraco");
  });

  it("tentativas de exercícios desconhecidos são ignoradas sem quebrar", () => {
    const [alg] = metricsFor([attempt("ex-fantasma", true, 1), attempt("ex-a1", true, 2)]);
    expect(alg.attemptsCount).toBe(1);
  });

  it("a ordem de chegada das tentativas não importa (ordena por created_at)", () => {
    const chronological = [
      attempt("ex-a1", true, 1),
      attempt("ex-a2", true, 2),
      attempt("ex-a3", false, 3),
    ];
    const shuffled = [chronological[2], chronological[0], chronological[1]];

    expect(metricsFor(chronological)[0].domain).toBe(metricsFor(shuffled)[0].domain);
  });
});

describe("buildRecommendations", () => {
  it("gera as três frases da especificação, priorizando fracos", () => {
    const attempts = [
      // Álgebra forte: 5 acertos
      ...Array.from({ length: 5 }, (_, i) => attempt("ex-a1", true, i)),
      // Equações fraca: 4 erros
      ...Array.from({ length: 4 }, (_, i) => attempt("ex-e1", false, 10 + i)),
      // Funções: não iniciada
    ];
    const recommendations = buildRecommendations(metricsFor(attempts));

    expect(recommendations.map((r) => r.message)).toEqual([
      "Continue praticando Equações",
      "Comece Funções",
      "Você domina Álgebra básica",
    ]);
  });

  it("nunca devolve mais que o máximo configurado", () => {
    const attempts = [
      ...Array.from({ length: 4 }, (_, i) => attempt("ex-a1", false, i)),
      ...Array.from({ length: 4 }, (_, i) => attempt("ex-e1", false, 10 + i)),
    ];
    const recommendations = buildRecommendations(metricsFor(attempts));

    expect(recommendations.length).toBeLessThanOrEqual(MAX_RECOMMENDATIONS);
    expect(recommendations[0].kind).toBe("practice");
  });

  it("sem nenhuma tentativa, recomenda começar os tópicos", () => {
    const recommendations = buildRecommendations(metricsFor([]));

    expect(recommendations).toHaveLength(3);
    expect(recommendations.every((r) => r.kind === "start")).toBe(true);
    expect(recommendations[0].message).toBe("Comece Álgebra básica");
  });
});
