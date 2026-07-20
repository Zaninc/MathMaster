import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routerMock = { push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => null,
}));

import { DashboardHeader } from "./DashboardHeader";

describe("DashboardHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saúda pelo nome do profile quando disponível", () => {
    render(
      <DashboardHeader
        profile={{ id: "u1", display_name: "Ana Silva", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }}
        email="ana@example.com"
      />
    );

    expect(screen.getByRole("heading", { name: "Olá, Ana Silva!" })).toBeInTheDocument();
    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  it("cai no e-mail quando o profile não tem nome (profile incompleto)", () => {
    render(
      <DashboardHeader
        profile={{ id: "u1", display_name: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }}
        email="ana@example.com"
      />
    );

    expect(screen.getByRole("heading", { name: "Olá, ana@example.com!" })).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("cai no e-mail quando não existe profile (linha do trigger ainda não criada)", () => {
    render(<DashboardHeader profile={null} email="theo@example.com" />);

    expect(screen.getByRole("heading", { name: "Olá, theo@example.com!" })).toBeInTheDocument();
  });

  it("iniciais de nome com um único termo usam só a primeira letra", () => {
    render(
      <DashboardHeader
        profile={{ id: "u1", display_name: "Ana", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }}
        email="ana@example.com"
      />
    );

    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renderiza o botão de logout já existente", () => {
    render(<DashboardHeader profile={null} email="theo@example.com" />);

    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });
});
