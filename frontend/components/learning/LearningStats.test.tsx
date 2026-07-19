import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Recommendation, TopicMetrics } from "@/lib/learning/metrics";

import { LearningStats } from "./LearningStats";

const METRICS: TopicMetrics[] = [
  {
    topicId: "t-alg",
    topicTitle: "Álgebra básica",
    started: true,
    domain: 92,
    confidence: "alta",
    attemptsCount: 12,
    exercisesTried: 3,
    exercisesTotal: 3,
    standing: "forte",
  },
  {
    topicId: "t-eq",
    topicTitle: "Equações",
    started: true,
    domain: 34,
    confidence: "media",
    attemptsCount: 5,
    exercisesTried: 2,
    exercisesTotal: 3,
    standing: "fraco",
  },
  {
    topicId: "t-fn",
    topicTitle: "Funções",
    started: false,
    domain: null,
    confidence: null,
    attemptsCount: 0,
    exercisesTried: 0,
    exercisesTotal: 3,
    standing: "nao-iniciado",
  },
];

const RECOMMENDATIONS: Recommendation[] = [
  { topicId: "t-eq", kind: "practice", message: "Continue praticando Equações" },
  { topicId: "t-fn", kind: "start", message: "Comece Funções" },
  { topicId: "t-alg", kind: "dominate", message: "Você domina Álgebra básica" },
];

describe("LearningStats", () => {
  it("mostra um cartão por tópico com os destaques forte/fraco/não iniciado", () => {
    render(<LearningStats metrics={METRICS} recommendations={RECOMMENDATIONS} />);

    expect(screen.getByText("Ponto forte")).toBeInTheDocument();
    expect(screen.getByText("Precisa de atenção")).toBeInTheDocument();
    expect(screen.getByText("Não iniciado")).toBeInTheDocument();
  });

  it("exibe domínio, progresso e confiança de tópico iniciado", () => {
    render(<LearningStats metrics={METRICS} recommendations={[]} />);

    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText(/3 de 3 exercícios tentados · 12 tentativas · Confiança alta/)).toBeInTheDocument();
  });

  it("tópico não iniciado não mostra medidor, mostra convite", () => {
    render(<LearningStats metrics={[METRICS[2]]} recommendations={[]} />);

    expect(screen.queryByText("%", { exact: false })).not.toBeInTheDocument();
    expect(screen.getByText(/nenhuma tentativa ainda/i)).toBeInTheDocument();
  });

  it("lista as sugestões de estudo", () => {
    render(<LearningStats metrics={METRICS} recommendations={RECOMMENDATIONS} />);

    expect(screen.getByText("Continue praticando Equações")).toBeInTheDocument();
    expect(screen.getByText("Comece Funções")).toBeInTheDocument();
    expect(screen.getByText("Você domina Álgebra básica")).toBeInTheDocument();
  });

  it("sem recomendações, a caixa de sugestões não aparece", () => {
    render(<LearningStats metrics={METRICS} recommendations={[]} />);

    expect(screen.queryByText("Sugestões de estudo")).not.toBeInTheDocument();
  });
});
