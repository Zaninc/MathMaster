import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardEmptyState } from "./DashboardEmptyState";

describe("DashboardEmptyState", () => {
  it("dá boas-vindas e explica que o progresso aparece após as primeiras atividades", () => {
    render(<DashboardEmptyState />);

    expect(screen.getByRole("heading", { name: /bem-vindo ao mathmaster/i })).toBeInTheDocument();
    expect(screen.getByText(/assim que você começar a praticar/i)).toBeInTheDocument();
  });

  it("tem uma chamada para começar a praticar apontando para /aprendizado", () => {
    render(<DashboardEmptyState />);
    expect(screen.getByRole("link", { name: /começar a praticar/i })).toHaveAttribute("href", "/aprendizado");
  });
});
