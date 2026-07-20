import { describe, expect, it } from "vitest";

import type { Recommendation, TopicMetrics } from "@/lib/learning/metrics";
import type { Topic } from "@/lib/supabase/types";

import {
  attachTopicSlugs,
  buildDashboardStats,
  computeAccuracyRate,
  countDistinctExercises,
  countTopicsStarted,
} from "./aggregate";

describe("computeAccuracyRate", () => {
  it("retorna null quando não há tentativas (protege contra divisão por zero)", () => {
    expect(computeAccuracyRate(0, 0)).toBeNull();
  });

  it("arredonda para inteiro", () => {
    expect(computeAccuracyRate(1, 3)).toBe(33);
  });

  it("100% quando todas as tentativas acertaram", () => {
    expect(computeAccuracyRate(5, 5)).toBe(100);
  });
});

describe("countDistinctExercises", () => {
  it("conta exercícios únicos, ignorando tentativas repetidas do mesmo exercício", () => {
    const attempts = [{ exercise_id: "ex-1" }, { exercise_id: "ex-1" }, { exercise_id: "ex-2" }];
    expect(countDistinctExercises(attempts)).toBe(2);
  });

  it("zero para lista vazia", () => {
    expect(countDistinctExercises([])).toBe(0);
  });
});

describe("countTopicsStarted", () => {
  const METRICS: TopicMetrics[] = [
    {
      topicId: "t-1",
      topicTitle: "A",
      started: true,
      domain: 80,
      confidence: "media",
      attemptsCount: 5,
      exercisesTried: 2,
      exercisesTotal: 3,
      standing: "neutro",
    },
    {
      topicId: "t-2",
      topicTitle: "B",
      started: false,
      domain: null,
      confidence: null,
      attemptsCount: 0,
      exercisesTried: 0,
      exercisesTotal: 3,
      standing: "nao-iniciado",
    },
  ];

  it("conta só os tópicos iniciados", () => {
    expect(countTopicsStarted(METRICS)).toBe(1);
  });

  it("zero quando nenhum tópico foi iniciado", () => {
    expect(countTopicsStarted(METRICS.map((m) => ({ ...m, started: false })))).toBe(0);
  });
});

describe("buildDashboardStats", () => {
  it("combina todas as métricas numa conta nova (tudo zerado, taxa de acerto null)", () => {
    const stats = buildDashboardStats({
      attemptsWindow: [],
      totalAttempts: 0,
      correctAttempts: 0,
      metrics: [],
      topicsTotal: 3,
    });

    expect(stats).toEqual({
      distinctExercisesAttempted: 0,
      totalAttempts: 0,
      accuracyRate: null,
      topicsStarted: 0,
      topicsTotal: 3,
    });
  });

  it("combina contagens reais de uma conta ativa", () => {
    const stats = buildDashboardStats({
      attemptsWindow: [{ exercise_id: "ex-1" }, { exercise_id: "ex-2" }, { exercise_id: "ex-1" }],
      totalAttempts: 12,
      correctAttempts: 9,
      metrics: [
        {
          topicId: "t-1",
          topicTitle: "A",
          started: true,
          domain: 75,
          confidence: "alta",
          attemptsCount: 12,
          exercisesTried: 2,
          exercisesTotal: 4,
          standing: "neutro",
        },
      ],
      topicsTotal: 4,
    });

    expect(stats).toEqual({
      distinctExercisesAttempted: 2,
      totalAttempts: 12,
      accuracyRate: 75,
      topicsStarted: 1,
      topicsTotal: 4,
    });
  });
});

describe("attachTopicSlugs", () => {
  const TOPICS: Topic[] = [
    { id: "t-1", slug: "algebra", title: "Álgebra", description: null, position: 1 },
    { id: "t-2", slug: "equacoes", title: "Equações", description: null, position: 2 },
  ];

  it("anexa o slug correto de cada tópico à recomendação", () => {
    const recommendations: Recommendation[] = [
      { topicId: "t-2", kind: "practice", message: "Continue praticando Equações" },
    ];

    expect(attachTopicSlugs(recommendations, TOPICS)).toEqual([
      { topicId: "t-2", kind: "practice", message: "Continue praticando Equações", topicSlug: "equacoes" },
    ]);
  });

  it("slug null quando o tópico da recomendação não é encontrado, sem quebrar", () => {
    const recommendations: Recommendation[] = [
      { topicId: "t-desconhecido", kind: "start", message: "Comece X" },
    ];

    expect(attachTopicSlugs(recommendations, TOPICS)[0].topicSlug).toBeNull();
  });
});
