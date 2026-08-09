import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ConversoresPage from "./page";

/**
 * Sprint V2.20 — smoke test de composição da página real (não só do
 * `ConvertersWorkspace` isolado, coberto em detalhe no próprio
 * `components/converters/ConvertersWorkspace.test.tsx`).
 */
describe("ConversoresPage", () => {
  it("renderiza o título, a descrição e a categoria inicial (Comprimento)", () => {
    render(<ConversoresPage />);

    expect(screen.getByRole("heading", { name: "Conversores", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Converta unidades e veja como o cálculo é feito.")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Comprimento" })).toHaveAttribute("aria-selected", "true");
  });
});
