import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const getProgressPreviewDataMock = vi.fn();
vi.mock("@/lib/home/getProgressPreviewData", () => ({
  getProgressPreviewData: () => getProgressPreviewDataMock(),
}));

import { ProgressPreview } from "./ProgressPreview";

/** Componente Server assíncrono: resolve o elemento antes de renderizar. */
async function renderPreview() {
  render(await ProgressPreview());
}

describe("ProgressPreview", () => {
  it("nunca mostra o selo 'Preview'", async () => {
    getProgressPreviewDataMock.mockResolvedValue({ status: "signed-out" });
    await renderPreview();
    expect(screen.queryByText("Preview")).not.toBeInTheDocument();
  });

  it("deslogado (ou Supabase não configurado): CTA pra criar conta/entrar, sem dados fictícios", async () => {
    getProgressPreviewDataMock.mockResolvedValue({ status: "signed-out" });
    await renderPreview();

    expect(screen.getByText(/crie uma conta gratuita/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/cadastro");
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
    expect(screen.queryByText("%", { exact: false })).not.toBeInTheDocument();
  });

  it("conta nova (logado, zero tentativas): CTA pra praticar, sem dados fictícios", async () => {
    getProgressPreviewDataMock.mockResolvedValue({ status: "new-account" });
    await renderPreview();

    expect(screen.getByText(/ainda não respondeu nenhum exercício/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Começar a praticar" })).toHaveAttribute("href", "/aprendizado");
    expect(screen.queryByText("%", { exact: false })).not.toBeInTheDocument();
  });

  it("erro: mensagem amigável, sem quebrar", async () => {
    getProgressPreviewDataMock.mockResolvedValue({ status: "error" });
    await renderPreview();

    expect(screen.getByText(/não foi possível carregar seu progresso/i)).toBeInTheDocument();
  });

  it("com dados reais: renderiza um DomainMeter por tópico, com domínio real (não fictício)", async () => {
    getProgressPreviewDataMock.mockResolvedValue({
      status: "ready",
      topics: [
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
      ],
    });
    await renderPreview();

    expect(screen.getByText("Álgebra básica")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("Equações")).toBeInTheDocument();
    expect(screen.getByText("34%")).toBeInTheDocument();
    // Mesma mensagem de lib/learning/labels.ts usada em /aprendizado — não reescrita aqui.
    expect(screen.getByText("Você domina este tópico.")).toBeInTheDocument();
  });
});
