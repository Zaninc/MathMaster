import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import FerramentasPage from "./page";

/**
 * Hotfix — Card "Banco de questões" funcional em Ferramentas: cobertura
 * de integração da página real (não só do dado em `data/tools.test.ts`)
 * — confirma o que o usuário efetivamente vê e clica.
 */
describe("FerramentasPage", () => {
  it("Banco de questões aparece como card disponível, sem o badge de planejado, com link para /aprendizado", () => {
    render(<FerramentasPage />);

    const heading = screen.getByRole("heading", { name: "Banco de questões" });
    const card = heading.closest("a");
    expect(card).not.toBeNull();
    expect(card).toHaveAttribute("href", "/aprendizado");

    // "Planejado — V1.1" ainda existe na página (Simulados/Caderno de
    // questões continuam planejados) — o que importa é que NÃO esteja
    // mais dentro DESTE card específico.
    expect(card).not.toHaveTextContent("Planejado");
    expect(card).toHaveTextContent("Disponível");
    expect(card).toHaveTextContent("Explore questões organizadas por tópico e dificuldade.");
  });

  it("preserva o mesmo padrão de link/hover dos cards Histórico e Fórmulas já disponíveis", () => {
    render(<FerramentasPage />);

    const historico = screen.getByRole("link", { name: /histórico/i });
    const formulas = screen.getByRole("link", { name: /fórmulas/i });
    const banco = screen.getByRole("link", { name: /banco de questões/i });

    expect(historico.className).toBe(formulas.className);
    expect(banco.className).toBe(historico.className);
  });

  it("cards ainda planejados continuam sem link (nenhuma navegação nova introduzida por engano)", () => {
    render(<FerramentasPage />);

    for (const title of ["Simulados", "Caderno de questões", "Revisão rápida", "Exportar resolução"]) {
      const heading = screen.getByRole("heading", { name: title });
      expect(heading.closest("a")).toBeNull();
    }
    expect(screen.getAllByText(/^Planejado/).length).toBeGreaterThan(0);
  });
});
