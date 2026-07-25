import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const searchParamsMock = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock(),
}));

import { FORMULAS } from "@/data/formulas";

import { FormulasReference } from "./FormulasReference";

describe("FormulasReference", () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it("cerca de 25 fórmulas no catálogo (Etapa 3)", () => {
    expect(FORMULAS.length).toBeGreaterThanOrEqual(25);
  });

  it("renderiza todas as categorias, na ordem da Etapa 1/2, com 'Todas' ativo por padrão", () => {
    render(<FormulasReference />);

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Álgebra", "Geometria", "Trigonometria", "Cálculo", "Somatórios", "Álgebra Linear"]);

    const filterGroup = screen.getByRole("group", { name: "Filtro de categoria" });
    expect(within(filterGroup).getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "true");
  });

  it("renderiza um card (h3) por fórmula do catálogo, todas presentes", () => {
    render(<FormulasReference />);

    for (const formula of FORMULAS) {
      expect(screen.getByRole("heading", { level: 3, name: formula.title })).toBeInTheDocument();
    }
  });

  it("renderiza as fórmulas com KaTeX, uma por card", () => {
    const { container } = render(<FormulasReference />);
    expect(container.querySelectorAll(".katex").length).toBe(FORMULAS.length);
  });

  it("filtra para uma única categoria ao clicar nela", () => {
    render(<FormulasReference />);

    const filterGroup = screen.getByRole("group", { name: "Filtro de categoria" });
    fireEvent.click(within(filterGroup).getByRole("button", { name: "Trigonometria" }));

    expect(screen.getByRole("heading", { level: 2, name: "Trigonometria" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Álgebra" })).not.toBeInTheDocument();
    expect(within(filterGroup).getByRole("button", { name: "Trigonometria" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(within(filterGroup).getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "false");
  });

  it("volta a mostrar tudo ao clicar em 'Todas' de novo", () => {
    render(<FormulasReference />);

    const filterGroup = screen.getByRole("group", { name: "Filtro de categoria" });
    fireEvent.click(within(filterGroup).getByRole("button", { name: "Cálculo" }));
    expect(screen.queryByRole("heading", { level: 2, name: "Álgebra" })).not.toBeInTheDocument();

    fireEvent.click(within(filterGroup).getByRole("button", { name: "Todas" }));
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Álgebra", "Geometria", "Trigonometria", "Cálculo", "Somatórios", "Álgebra Linear"]);
  });

  it("a busca filtra em tempo real por nome, categoria e símbolo", () => {
    render(<FormulasReference />);
    const searchBox = screen.getByRole("searchbox", { name: "Pesquisar fórmula" });

    fireEvent.change(searchBox, { target: { value: "delta" } });
    expect(screen.getByRole("heading", { level: 3, name: "Delta (discriminante)" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "Fórmula de Bhaskara" })).not.toBeInTheDocument();

    fireEvent.change(searchBox, { target: { value: "pitagoras" } });
    expect(screen.getByRole("heading", { level: 3, name: "Teorema de Pitágoras" })).toBeInTheDocument();
  });

  it("mostra estado vazio quando a busca não encontra nada", () => {
    render(<FormulasReference />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Pesquisar fórmula" }), {
      target: { value: "xablauzzz123" },
    });

    expect(screen.getByText("Nenhuma fórmula encontrada.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("favoritar um card atualiza o contador de 'Favoritas' e persiste no localStorage", async () => {
    render(<FormulasReference />);
    const filterGroup = screen.getByRole("group", { name: "Filtro de categoria" });
    expect(within(filterGroup).getByRole("button", { name: "⭐ Favoritas (0)" })).toBeInTheDocument();

    const bhaskaraCard = screen.getByRole("heading", { name: "Fórmula de Bhaskara" }).closest("article")!;
    fireEvent.click(within(bhaskaraCard).getByRole("button", { name: "Adicionar aos favoritos" }));

    await waitFor(() =>
      expect(within(filterGroup).getByRole("button", { name: "⭐ Favoritas (1)" })).toBeInTheDocument()
    );
    expect(JSON.parse(window.localStorage.getItem("mathmaster.formulas.favorites") ?? "[]")).toEqual(["bhaskara"]);
  });

  it("o filtro 'Favoritas' mostra só as fórmulas favoritadas", async () => {
    window.localStorage.setItem("mathmaster.formulas.favorites", JSON.stringify(["bhaskara"]));
    render(<FormulasReference />);

    const filterGroup = screen.getByRole("group", { name: "Filtro de categoria" });
    await waitFor(() =>
      expect(within(filterGroup).getByRole("button", { name: "⭐ Favoritas (1)" })).toBeInTheDocument()
    );

    fireEvent.click(within(filterGroup).getByRole("button", { name: "⭐ Favoritas (1)" }));

    expect(screen.getByRole("heading", { level: 3, name: "Fórmula de Bhaskara" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "Delta (discriminante)" })).not.toBeInTheDocument();
  });

  describe("deep-link via ?categoria=/?q= (sistema de conexões internas)", () => {
    it("pré-seleciona a categoria quando ?categoria= é válida", () => {
      searchParamsMock.mockReturnValue(new URLSearchParams("categoria=calculo"));
      render(<FormulasReference />);

      const filterGroup = screen.getByRole("group", { name: "Filtro de categoria" });
      expect(within(filterGroup).getByRole("button", { name: "Cálculo" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByRole("heading", { level: 2, name: "Álgebra" })).not.toBeInTheDocument();
    });

    it("?categoria= inválida ou desconhecida cai em 'Todas' — nunca quebra, nunca fica vazia", () => {
      searchParamsMock.mockReturnValue(new URLSearchParams("categoria=nao-existe"));
      render(<FormulasReference />);

      const filterGroup = screen.getByRole("group", { name: "Filtro de categoria" });
      expect(within(filterGroup).getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "true");
      const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
      expect(headings).toEqual(["Álgebra", "Geometria", "Trigonometria", "Cálculo", "Somatórios", "Álgebra Linear"]);
    });

    it("pré-preenche a busca a partir de ?q=", () => {
      searchParamsMock.mockReturnValue(new URLSearchParams("q=pitagoras"));
      render(<FormulasReference />);

      expect(screen.getByRole("searchbox", { name: "Pesquisar fórmula" })).toHaveValue("pitagoras");
      expect(screen.getByRole("heading", { level: 3, name: "Teorema de Pitágoras" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { level: 3, name: "Fórmula de Bhaskara" })).not.toBeInTheDocument();
    });

    it("sem parâmetros de URL, comportamento padrão é preservado", () => {
      render(<FormulasReference />);
      expect(screen.getByRole("searchbox", { name: "Pesquisar fórmula" })).toHaveValue("");
      const filterGroup = screen.getByRole("group", { name: "Filtro de categoria" });
      expect(within(filterGroup).getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "true");
    });
  });
});
