import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TopicMetrics } from "@/lib/learning/metrics";

import { TopicProgress } from "./TopicProgress";

const METRICS: TopicMetrics[] = [
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

describe("TopicProgress", () => {
  it("mostra mensagem honesta quando não há tópicos", () => {
    render(<TopicProgress metrics={[]} />);
    expect(screen.getByText(/nenhum tópico disponível ainda/i)).toBeInTheDocument();
  });

  it("ordena por domínio (mais forte primeiro), não iniciado por último", () => {
    render(<TopicProgress metrics={METRICS} />);

    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Álgebra básica", "Equações", "Funções"]);
  });

  it("renderiza todos os tópicos com seus badges de standing", () => {
    render(<TopicProgress metrics={METRICS} />);

    expect(screen.getByText("Ponto forte")).toBeInTheDocument();
    expect(screen.getByText("Precisa de atenção")).toBeInTheDocument();
    expect(screen.getByText("Não iniciado")).toBeInTheDocument();
  });
});
