import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

import { NAV_ITEMS } from "@/data/nav";

import { NavBar } from "./NavBar";

describe("NavBar", () => {
  it("renderiza todos os itens de navegação", () => {
    usePathnameMock.mockReturnValue("/");
    render(<NavBar />);

    for (const item of NAV_ITEMS) {
      expect(screen.getAllByText(item.label).length).toBeGreaterThan(0);
    }
  });

  it("marca o item ativo correto de acordo com a rota atual", () => {
    usePathnameMock.mockReturnValue("/calculadora");
    render(<NavBar />);

    const links = screen.getAllByRole("link", { name: /calculadora/i });
    expect(links[0]).toHaveAttribute("aria-current", "page");

    const homeLinks = screen.getAllByRole("link", { name: "MathMaster" });
    expect(homeLinks[0]).not.toHaveAttribute("aria-current");
  });

  it("mostra o badge 'Em desenvolvimento' no item da IA", () => {
    usePathnameMock.mockReturnValue("/");
    render(<NavBar />);

    expect(screen.getAllByText("Em desenvolvimento").length).toBeGreaterThan(0);
  });
});
