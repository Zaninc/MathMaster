import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ToolCard } from "./ToolCard";

describe("ToolCard", () => {
  it("renderiza uma ferramenta disponível como link", () => {
    render(<ToolCard tool={{ title: "Histórico", description: "desc", status: "live", href: "/calculadora" }} />);

    expect(screen.getByText("Disponível")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /histórico/i })).toHaveAttribute("href", "/calculadora");
  });

  it("renderiza uma ferramenta planejada sem link, com a versão prevista", () => {
    render(<ToolCard tool={{ title: "Simulados", description: "desc", status: "planned", version: "V1.1" }} />);

    expect(screen.getByText("Planejado — V1.1")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
