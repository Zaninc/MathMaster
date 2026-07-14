import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DomainMeter } from "./DomainMeter";

describe("DomainMeter", () => {
  it("renderiza o assunto, a porcentagem e a mensagem", () => {
    render(<DomainMeter subject="Álgebra" percentage={92} message="Você demonstra domínio consistente." />);

    expect(screen.getByText("Álgebra")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("Você demonstra domínio consistente.")).toBeInTheDocument();
  });

  it("expõe um rótulo acessível com o resumo completo na barra", () => {
    render(<DomainMeter subject="Cálculo" percentage={24} message="Revise limites." />);
    expect(screen.getByRole("img", { name: "Cálculo: 24%. Revise limites." })).toBeInTheDocument();
  });

  it("limita a porcentagem exibida entre 0 e 100", () => {
    render(<DomainMeter subject="Teste" percentage={140} message="x" />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});
