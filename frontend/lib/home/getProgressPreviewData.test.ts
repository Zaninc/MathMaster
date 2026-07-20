import { describe, expect, it } from "vitest";

import type { TopicMetrics } from "@/lib/learning/metrics";

import { selectPreviewTopics } from "./getProgressPreviewData";

function topic(overrides: Partial<TopicMetrics>): TopicMetrics {
  return {
    topicId: "t-1",
    topicTitle: "Tópico",
    started: true,
    domain: 50,
    confidence: "media",
    attemptsCount: 5,
    exercisesTried: 2,
    exercisesTotal: 3,
    standing: "neutro",
    ...overrides,
  };
}

describe("selectPreviewTopics", () => {
  it("exclui tópicos não iniciados — nunca preenche com domínio inexistente", () => {
    const metrics = [
      topic({ topicId: "t-1", started: true, domain: 80 }),
      topic({ topicId: "t-2", started: false, domain: null, standing: "nao-iniciado" }),
    ];
    const preview = selectPreviewTopics(metrics);

    expect(preview).toHaveLength(1);
    expect(preview[0].topicId).toBe("t-1");
  });

  it("ordena por domínio, do maior para o menor", () => {
    const metrics = [
      topic({ topicId: "t-baixo", domain: 30 }),
      topic({ topicId: "t-alto", domain: 90 }),
      topic({ topicId: "t-medio", domain: 60 }),
    ];
    const preview = selectPreviewTopics(metrics);

    expect(preview.map((t) => t.topicId)).toEqual(["t-alto", "t-medio", "t-baixo"]);
  });

  it("limita a 3 tópicos mesmo com mais iniciados", () => {
    const metrics = [1, 2, 3, 4, 5].map((n) => topic({ topicId: `t-${n}`, domain: n * 10 }));
    expect(selectPreviewTopics(metrics)).toHaveLength(3);
  });

  it("lista vazia quando nenhum tópico foi iniciado", () => {
    const metrics = [topic({ started: false, domain: null, standing: "nao-iniciado" })];
    expect(selectPreviewTopics(metrics)).toEqual([]);
  });
});
