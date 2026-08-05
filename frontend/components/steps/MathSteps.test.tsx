import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  apiClient: { solveSteps: vi.fn() },
}));

import { apiClient } from "@/lib/api/client";

import { MathSteps } from "./MathSteps";

describe("MathSteps", () => {
  beforeEach(() => {
    vi.mocked(apiClient.solveSteps).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("começa fechado e não faz a requisição antes do clique", () => {
    render(<MathSteps expression="2*x+4=10" />);
    expect(screen.getByRole("button", { name: "Ver passo a passo" })).toBeInTheDocument();
    expect(apiClient.solveSteps).not.toHaveBeenCalled();
  });

  it("ao clicar, mostra carregando e depois os passos", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "2*x+4=10",
      result: "x = 3",
      steps: [
        { title: "Equação inicial", expression: "2*x + 4=10", explanation: null },
        { title: "Subtraindo 4 dos dois lados", expression: "2*x=6", explanation: null },
        { title: "Dividindo os dois lados por 2", expression: "x=3", explanation: null },
      ],
    });

    render(<MathSteps expression="2*x+4=10" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    expect(screen.getByText("Carregando passo a passo...")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Equação inicial")).toBeInTheDocument());
    expect(screen.getByText("Subtraindo 4 dos dois lados")).toBeInTheDocument();
    expect(screen.getByText("Dividindo os dois lados por 2")).toBeInTheDocument();
    expect(apiClient.solveSteps).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Ocultar passo a passo" })).toBeInTheDocument();
  });

  it("mostra uma mensagem de erro amigável quando a API falha", async () => {
    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(apiClient.solveSteps).mockRejectedValue(
      new ApiError("invalid_expression", "Passo a passo disponível apenas para equações lineares.")
    );

    render(<MathSteps expression="x**2+2=6" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() =>
      expect(screen.getByText("Passo a passo disponível apenas para equações lineares.")).toBeInTheDocument()
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("fecha e reabre sem refazer a requisição para a mesma expressão", async () => {
    // Expressão própria deste teste (nunca reutilizada em outro `it`):
    // o cache de `MathSteps` é um `Map` de módulo, compartilhado entre
    // testes do mesmo arquivo — uma expressão repetida bateria no cache
    // de um teste anterior e mascararia a asserção de "0 chamadas extras".
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "5*x-15=0",
      result: "x = 3",
      steps: [{ title: "Equação inicial", expression: "5*x - 15=0", explanation: null }],
    });

    render(<MathSteps expression="5*x-15=0" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));
    await waitFor(() => expect(screen.getByText("Equação inicial")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Ocultar passo a passo" }));
    expect(screen.queryByText("Equação inicial")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));
    expect(screen.getByText("Equação inicial")).toBeInTheDocument();
    expect(apiClient.solveSteps).toHaveBeenCalledTimes(1);
  });

  it("uma expressão NOVA (cache miss) faz uma nova requisição própria", async () => {
    vi.mocked(apiClient.solveSteps).mockImplementation((expression: string) =>
      Promise.resolve({
        expression,
        result: "x = 3",
        steps: [{ title: "Equação inicial", expression, explanation: null }],
      })
    );

    const { rerender } = render(<MathSteps expression="7*x-14=0" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));
    await waitFor(() => expect(apiClient.solveSteps).toHaveBeenCalledTimes(1));

    rerender(<MathSteps expression="9*x-18=0" />);
    // Expressão nova reseta para fechado (novo resultado principal).
    expect(screen.getByRole("button", { name: "Ver passo a passo" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));
    await waitFor(() => expect(apiClient.solveSteps).toHaveBeenCalledTimes(2));
  });

  it("painel expansível tem aria-expanded e aria-controls corretos", () => {
    render(<MathSteps expression="4*x+8=20" />);
    const button = screen.getByRole("button", { name: "Ver passo a passo" });
    expect(button).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Ocultar passo a passo" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByRole("region", { name: "Passo a passo" })).toBeInTheDocument();
  });
});

/**
 * Sprint V2.9.1 (Passo a Passo — Quadráticas) — ZERO componente novo
 * (`MathSteps`/`MathStepItem` intocados): estes casos só confirmam que o
 * texto matemático puro que o backend agora envia para quadráticas
 * (`Delta=...`, raízes fracionárias/complexas) continua passando pelo
 * MESMO pipeline `valueToLatex` (não mockado aqui, só `apiClient`) sem
 * precisar de nenhuma alteração no frontend.
 */
describe("MathSteps — compatibilidade com passos de equações quadráticas (Sprint V2.9.1)", () => {
  beforeEach(() => {
    vi.mocked(apiClient.solveSteps).mockReset();
  });

  it("renderiza fatoração, Δ e raízes fracionária/negativa em KaTeX", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "2*x**2+3*x-5=0",
      result: "x₁ = 1, x₂ = -5/2",
      steps: [
        { title: "Equação inicial", expression: "2*x**2 + 3*x - 5=0", explanation: null },
        {
          title: "Identificando os coeficientes (a=2, b=3, c=-5) e calculando o discriminante Δ=b²-4ac",
          expression: "Delta=9-4*2*(-5)",
          explanation: null,
        },
        { title: "Discriminante calculado", expression: "Delta=49", explanation: null },
        { title: "Primeira raiz", expression: "x=1", explanation: null },
        { title: "Segunda raiz", expression: "x=-5/2", explanation: null },
      ],
    });

    const { container } = render(<MathSteps expression="2*x**2+3*x-5=0" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(5));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    // "Delta" (ASCII, nunca "Δ" bruto no backend) já é reconhecido pelo
    // serializer default do mathjs como o símbolo grego \Delta.
    expect(annotations.some((latex) => latex?.includes("\\Delta=9-4\\cdot2\\cdot"))).toBe(true);
    expect(annotations.some((latex) => latex === "\\Delta=49")).toBe(true);
    expect(annotations.some((latex) => latex === "x=1")).toBe(true);
    expect(annotations.some((latex) => latex?.includes("x=\\frac{-5}{2}"))).toBe(true);
  });

  it("renderiza raízes complexas (unidade imaginária minúscula) em KaTeX", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "x**2+1=0",
      result: "x₁ = -i, x₂ = i",
      steps: [
        { title: "Equação inicial", expression: "x**2 + 1=0", explanation: null },
        { title: "Discriminante calculado", expression: "Delta=-4", explanation: null },
        { title: "Δ negativo — a equação possui duas raízes complexas", expression: "x=i", explanation: null },
        { title: "Segunda raiz complexa", expression: "x=-i", explanation: null },
      ],
    });

    const { container } = render(<MathSteps expression="x**2+1=0" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(4));
    const annotations = Array.from(container.querySelectorAll("annotation")).map(
      (node) => node.textContent
    );
    expect(annotations.some((latex) => latex?.replace(/\s/g, "") === "x=i")).toBe(true);
    expect(annotations.some((latex) => latex?.replace(/\s/g, "") === "x=-i")).toBe(true);
  });

  it("passos numerados sequencialmente (1, 2, 3, ...) também para quadráticas", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "x**2-9=0",
      result: "x₁ = -3, x₂ = 3",
      steps: [
        { title: "Equação inicial", expression: "x**2 - 9=0", explanation: null },
        { title: "Somando 9 dos dois lados", expression: "x**2=9", explanation: null },
        { title: "Primeira raiz", expression: "x=3", explanation: null },
        { title: "Segunda raiz", expression: "x=-3", explanation: null },
      ],
    });

    const { container } = render(<MathSteps expression="x**2-9=0" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(screen.getByText("Equação inicial")).toBeInTheDocument());
    // Os números do KaTeX renderizado (ex. "x**2", "9") também casam com
    // um seletor de texto solto "1-4" — usa o badge `aria-hidden` dedicado
    // do número do passo (`MathStepItem.tsx`), nunca o conteúdo matemático.
    const badges = Array.from(container.querySelectorAll('li > div > span[aria-hidden="true"]')).map(
      (node) => node.textContent
    );
    expect(badges).toEqual(["1", "2", "3", "4"]);
  });
});
