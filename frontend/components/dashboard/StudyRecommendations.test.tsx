import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RecommendationView } from "@/lib/dashboard/aggregate";

import { StudyRecommendations } from "./StudyRecommendations";

describe("StudyRecommendations", () => {
  it("renderiza a mensagem e um CTA linkando direto ao tópico", () => {
    const recommendations: RecommendationView[] = [
      { topicId: "t-eq", kind: "practice", message: "Continue praticando Equações", topicSlug: "equacoes" },
    ];
    render(<StudyRecommendations recommendations={recommendations} hasAnyTopics />);

    expect(screen.getByText("Continue praticando Equações")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Praticar" });
    expect(link).toHaveAttribute("href", "/aprendizado?topico=equacoes");
  });

  it("usa o rótulo certo de CTA por tipo de recomendação", () => {
    const recommendations: RecommendationView[] = [
      { topicId: "t-fn", kind: "start", message: "Comece Funções", topicSlug: "funcoes" },
      { topicId: "t-alg", kind: "dominate", message: "Você domina Álgebra", topicSlug: "algebra" },
    ];
    render(<StudyRecommendations recommendations={recommendations} hasAnyTopics />);

    expect(screen.getByRole("link", { name: "Começar" })).toHaveAttribute("href", "/aprendizado?topico=funcoes");
    expect(screen.getByRole("link", { name: "Revisar" })).toHaveAttribute("href", "/aprendizado?topico=algebra");
  });

  it("sem slug conhecido, mostra a mensagem sem quebrar e sem CTA", () => {
    const recommendations: RecommendationView[] = [
      { topicId: "t-x", kind: "practice", message: "Continue praticando X", topicSlug: null },
    ];
    render(<StudyRecommendations recommendations={recommendations} hasAnyTopics />);

    expect(screen.getByText("Continue praticando X")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("sem recomendações mas com tópicos existentes, orienta a continuar praticando", () => {
    render(<StudyRecommendations recommendations={[]} hasAnyTopics />);
    expect(screen.getByText(/continue respondendo exercícios/i)).toBeInTheDocument();
  });

  it("sem recomendações e sem tópicos no sistema, mostra mensagem diferente", () => {
    render(<StudyRecommendations recommendations={[]} hasAnyTopics={false} />);
    expect(screen.getByText(/nenhum tópico disponível ainda/i)).toBeInTheDocument();
  });
});
