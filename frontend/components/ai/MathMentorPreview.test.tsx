import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MathMentorPreview } from "./MathMentorPreview";

describe("MathMentorPreview", () => {
  it("mostra o badge de desenvolvimento e as features conceituais", () => {
    render(<MathMentorPreview />);

    expect(screen.getByText("Em desenvolvimento")).toBeInTheDocument();
    expect(screen.getByText("Explicações inteligentes")).toBeInTheDocument();
    expect(screen.getByText("Memória de estudo")).toBeInTheDocument();
  });

  it("desabilita o input e o botão de envio, com explicação visível (não só placeholder)", () => {
    render(<MathMentorPreview />);

    expect(screen.getByLabelText("Converse com o Math Mentor")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    expect(
      screen.getByText("O Math Mentor está sendo construído — ainda não é possível conversar com ele.")
    ).toBeInTheDocument();
  });
});
