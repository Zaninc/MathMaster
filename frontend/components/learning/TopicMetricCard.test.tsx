import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TopicMetrics } from "@/lib/learning/metrics";

import { TopicMetricCard } from "./TopicMetricCard";

const STARTED: TopicMetrics = {
  topicId: "t-alg",
  topicTitle: "Álgebra básica",
  started: true,
  domain: 92,
  confidence: "alta",
  attemptsCount: 12,
  exercisesTried: 3,
  exercisesTotal: 3,
  standing: "forte",
};

const NOT_STARTED: TopicMetrics = {
  topicId: "t-fn",
  topicTitle: "Funções",
  started: false,
  domain: null,
  confidence: null,
  attemptsCount: 0,
  exercisesTried: 0,
  exercisesTotal: 3,
  standing: "nao-iniciado",
};

describe("TopicMetricCard", () => {
  it("tópico iniciado mostra domínio, badge e detalhes", () => {
    render(<TopicMetricCard metrics={STARTED} />);

    expect(screen.getByText("Álgebra básica")).toBeInTheDocument();
    expect(screen.getByText("Ponto forte")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText(/3 de 3 exercícios tentados · 12 tentativas · Confiança alta/)).toBeInTheDocument();
  });

  it("tópico não iniciado não mostra medidor nem badge de standing neutro", () => {
    render(<TopicMetricCard metrics={NOT_STARTED} />);

    expect(screen.getByText("Não iniciado")).toBeInTheDocument();
    expect(screen.queryByText("%", { exact: false })).not.toBeInTheDocument();
    expect(screen.getByText(/nenhuma tentativa ainda/i)).toBeInTheDocument();
  });
});
