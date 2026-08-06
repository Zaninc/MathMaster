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
        { title: "Equação inicial", expression: "2*x + 4=10", explanation: null, title_segments: null },
        { title: "Subtraindo 4 dos dois lados", expression: "2*x=6", explanation: null, title_segments: null },
        { title: "Dividindo os dois lados por 2", expression: "x=3", explanation: null, title_segments: null },
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
      steps: [{ title: "Equação inicial", expression: "5*x - 15=0", explanation: null, title_segments: null }],
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
        steps: [{ title: "Equação inicial", expression, explanation: null, title_segments: null }],
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
        { title: "Equação inicial", expression: "2*x**2 + 3*x - 5=0", explanation: null, title_segments: null },
        {
          title: "Identificando os coeficientes (a=2, b=3, c=-5) e calculando o discriminante Δ=b²-4ac",
          title_segments: [
            { type: "text", content: "Identificando os coeficientes" },
            { type: "math", content: "a=2, b=3, c=-5" },
            { type: "text", content: "e calculando o discriminante" },
            { type: "math", content: "Delta=b**2-4*a*c" },
          ],
          expression: "Delta=9-4*2*(-5)",
          explanation: null,
        },
        { title: "Discriminante calculado", expression: "Delta=49", explanation: null, title_segments: null },
        { title: "Primeira raiz", expression: "x=1", explanation: null, title_segments: null },
        { title: "Segunda raiz", expression: "x=-5/2", explanation: null, title_segments: null },
      ],
    });

    const { container } = render(<MathSteps expression="2*x**2+3*x-5=0" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    // 5 expressões de passo + 2 segmentos "math" do título com Δ/discriminante
    // (Hotfix V2.9.1a) = 7 elementos `.katex`.
    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(7));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    // "Delta" (ASCII, nunca "Δ" bruto no backend) já é reconhecido pelo
    // serializer default do mathjs como o símbolo grego \Delta.
    expect(annotations.some((latex) => latex?.includes("\\Delta=9-4\\cdot2\\cdot"))).toBe(true);
    expect(annotations.some((latex) => latex === "\\Delta=49")).toBe(true);
    expect(annotations.some((latex) => latex === "x=1")).toBe(true);
    expect(annotations.some((latex) => latex?.includes("x=\\frac{-5}{2}"))).toBe(true);
    // Título misto (Hotfix V2.9.1a): texto continua texto, "a=2, b=3, c=-5"
    // e "Δ=b²-4ac" renderizam em KaTeX (b² como b^2, b em itálico normal).
    expect(screen.getByText("Identificando os coeficientes")).toBeInTheDocument();
    expect(screen.getByText("e calculando o discriminante")).toBeInTheDocument();
    expect(annotations.some((latex) => latex?.includes("a=2,\\;b=3,\\;c=-5"))).toBe(true);
    expect(annotations.some((latex) => latex === "\\Delta={b}^{2}-4\\cdota\\cdotc")).toBe(true);
  });

  it("renderiza raízes complexas (unidade imaginária minúscula) em KaTeX", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "x**2+1=0",
      result: "x₁ = -i, x₂ = i",
      steps: [
        { title: "Equação inicial", expression: "x**2 + 1=0", explanation: null, title_segments: null },
        { title: "Discriminante calculado", expression: "Delta=-4", explanation: null, title_segments: null },
        { title: "Δ negativo — a equação possui duas raízes complexas", expression: "x=i", explanation: null, title_segments: null },
        { title: "Segunda raiz complexa", expression: "x=-i", explanation: null, title_segments: null },
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

  it("Hotfix V2.9.1a: título da fórmula de Bhaskara vira fração real, com sinal +/- correto na primeira/segunda raiz", async () => {
    // Expressão própria deste teste (nunca reutilizada em outro `it` deste
    // describe): o cache de `MathSteps` é um `Map` de módulo compartilhado
    // entre testes do mesmo arquivo — reutilizar "2*x**2+3*x-5=0" bateria
    // no cache já populado por um teste anterior e mascararia esta asserção.
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "4*x**2+3*x-6=0",
      result: "x₁ = 1, x₂ = -5/2",
      steps: [
        {
          title: "Aplicando a fórmula de Bhaskara (x=(-b+√Δ)/(2a)) — primeira raiz",
          title_segments: [
            { type: "text", content: "Aplicando a fórmula de Bhaskara" },
            { type: "math", content: "x=(-b+sqrt(Delta))/(2*a)" },
            { type: "text", content: "— primeira raiz" },
          ],
          expression: "x=1",
          explanation: null,
        },
        {
          title: "Aplicando a fórmula de Bhaskara (x=(-b-√Δ)/(2a)) — segunda raiz",
          title_segments: [
            { type: "text", content: "Aplicando a fórmula de Bhaskara" },
            { type: "math", content: "x=(-b-sqrt(Delta))/(2*a)" },
            { type: "text", content: "— segunda raiz" },
          ],
          expression: "x=-5/2",
          explanation: null,
        },
      ],
    });

    const { container } = render(<MathSteps expression="4*x**2+3*x-6=0" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    // 2 expressões de passo + 2 fórmulas de título = 4 elementos `.katex`.
    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(4));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );

    expect(screen.getAllByText("Aplicando a fórmula de Bhaskara")).toHaveLength(2);
    expect(screen.getByText("— primeira raiz")).toBeInTheDocument();
    expect(screen.getByText("— segunda raiz")).toBeInTheDocument();
    expect(
      annotations.some((latex) =>
        latex?.includes("\\frac{\\left(-b+\\sqrt{\\Delta}\\right)}{\\left(2\\cdota\\right)}")
      )
    ).toBe(true);
    expect(
      annotations.some((latex) =>
        latex?.includes("\\frac{\\left(-b-\\sqrt{\\Delta}\\right)}{\\left(2\\cdota\\right)}")
      )
    ).toBe(true);
  });

  it("equação linear sem matemática embutida no título permanece como texto puro (title_segments=null, regressão)", async () => {
    // Expressão própria deste teste — "2*x+4=10" já é usada (e cacheada)
    // por outro `it` neste mesmo arquivo (cache de `MathSteps` é um `Map`
    // de módulo, compartilhado por TODOS os testes do arquivo).
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "6*x+12=30",
      result: "x = 3",
      steps: [
        { title: "Equação inicial", title_segments: null, expression: "6*x + 12=30", explanation: null },
        {
          title: "Subtraindo 12 dos dois lados",
          title_segments: null,
          expression: "6*x=18",
          explanation: null,
        },
      ],
    });

    render(<MathSteps expression="6*x+12=30" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(screen.getByText("Equação inicial")).toBeInTheDocument());
    expect(screen.getByText("Subtraindo 12 dos dois lados")).toBeInTheDocument();
  });

  it("passos numerados sequencialmente (1, 2, 3, ...) também para quadráticas", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "x**2-9=0",
      result: "x₁ = -3, x₂ = 3",
      steps: [
        { title: "Equação inicial", expression: "x**2 - 9=0", explanation: null, title_segments: null },
        { title: "Somando 9 dos dois lados", expression: "x**2=9", explanation: null, title_segments: null },
        { title: "Primeira raiz", expression: "x=3", explanation: null, title_segments: null },
        { title: "Segunda raiz", expression: "x=-3", explanation: null, title_segments: null },
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

/**
 * Sprint V2.10 (Passo a Passo — Derivadas) — ZERO componente novo
 * (`MathSteps`/`MathStepItem`/`MixedMathText` intocados): confirma que o
 * texto matemático puro que o backend agora envia para derivadas
 * (`derivada(expr, x)`, somas/diferenças de `derivada(...)`, títulos com
 * `title_segments`) já passa pelo MESMO pipeline `valueToLatex` usado
 * desde a V2.9, sem precisar de nenhuma alteração no frontend.
 */
describe("MathSteps — compatibilidade com passos de derivadas (Sprint V2.10)", () => {
  beforeEach(() => {
    vi.mocked(apiClient.solveSteps).mockReset();
  });

  it("renderiza a notação d/dx e a linearidade da soma em KaTeX", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "d/dx(x**2+3*x)",
      result: "Derivada: 2x + 3",
      steps: [
        {
          title: "Função original",
          title_segments: null,
          expression: "derivada(x**2 + 3*x, x)",
          explanation: null,
        },
        {
          title: "Aplicando a linearidade da derivada",
          title_segments: null,
          expression: "derivada(x**2, x)+derivada(3*x, x)",
          explanation: null,
        },
        {
          title: "Derivando x² pela regra da potência",
          title_segments: [
            { type: "text", content: "Derivando" },
            { type: "math", content: "x**2" },
            { type: "text", content: "pela regra da potência" },
          ],
          expression: "2*x",
          explanation: null,
        },
        {
          title: "Derivando 3x",
          title_segments: [
            { type: "text", content: "Derivando" },
            { type: "math", content: "3*x" },
          ],
          expression: "3",
          explanation: null,
        },
        { title: "Somando os resultados", title_segments: null, expression: "2*x + 3", explanation: null },
      ],
    });

    const { container } = render(<MathSteps expression="d/dx(x**2+3*x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    // 5 expressões de passo + 2 segmentos "math" de título = 7 elementos `.katex`.
    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(7));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.some((latex) => latex?.includes("\\frac{d}{dx}\\left({x}^{2}+3\\cdotx\\right)"))).toBe(
      true
    );
    expect(
      annotations.some((latex) => latex?.includes("\\frac{d}{dx}\\left({x}^{2}\\right)+\\frac{d}{dx}"))
    ).toBe(true);
    expect(screen.getAllByText("Derivando").length).toBeGreaterThan(0);
    expect(screen.getByText("pela regra da potência")).toBeInTheDocument();
    expect(annotations.some((latex) => latex === "2\\cdotx+3")).toBe(true);
  });

  it("renderiza o coeficiente negativo (parênteses corretos) e o passo de simplificação", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "d/dx(-4*x**3)",
      result: "Derivada: -12x²",
      steps: [
        {
          title: "Função original",
          title_segments: null,
          expression: "derivada(-4*x**3, x)",
          explanation: null,
        },
        {
          title: "Derivando -4x³ pela regra da potência",
          title_segments: [
            { type: "text", content: "Derivando" },
            { type: "math", content: "-4*x**3" },
            { type: "text", content: "pela regra da potência" },
          ],
          expression: "3*(-4)*x**2",
          explanation: null,
        },
        { title: "Simplificando", title_segments: null, expression: "-12*x**2", explanation: null },
      ],
    });

    const { container } = render(<MathSteps expression="d/dx(-4*x**3)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(4));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.some((latex) => latex === "3\\cdot\\left(-4\\right)\\cdot{x}^{2}")).toBe(true);
    expect(screen.getByText("Simplificando")).toBeInTheDocument();
    expect(annotations.some((latex) => latex === "-12\\cdot{x}^{2}")).toBe(true);
  });

  it("mostra erro amigável para derivada fora do escopo (ex. seno), sem quebrar a tela", async () => {
    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(apiClient.solveSteps).mockRejectedValue(
      new ApiError(
        "invalid_expression",
        "O passo a passo para este tipo de derivada ainda não foi implementado nesta versão."
      )
    );

    render(<MathSteps expression="d/dx(sin(x))" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() =>
      expect(
        screen.getByText("O passo a passo para este tipo de derivada ainda não foi implementado nesta versão.")
      ).toBeInTheDocument()
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

/**
 * Sprint V2.10.1 (Passo a Passo — Integrais) — ZERO componente novo
 * (`MathSteps`/`MathStepItem`/`MixedMathText` intocados): confirma que o
 * texto matemático puro que o backend agora envia para integrais
 * (`integral(expr, x)`, frações do tipo "x**3/3 + C") já passa pelo MESMO
 * pipeline `valueToLatex` usado desde a V2.9, sem precisar de nenhuma
 * alteração no frontend além da correção pontual do símbolo "C" em
 * `to-latex.ts` (mesmo padrão do "b" na V2.9.1a/V2.10 — ver
 * `to-latex.test.ts`).
 */
describe("MathSteps — compatibilidade com passos de integrais (Sprint V2.10.1)", () => {
  beforeEach(() => {
    vi.mocked(apiClient.solveSteps).mockReset();
  });

  it("renderiza a notação ∫dx, a linearidade da soma e a constante +C em KaTeX", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "integral(x**2+3*x, x)",
      result: "Integral: x³/3 + 3x²/2 + C",
      steps: [
        {
          title: "Integral original",
          title_segments: null,
          expression: "integral(x**2 + 3*x, x)",
          explanation: null,
        },
        {
          title: "Aplicando a linearidade da integral",
          title_segments: null,
          expression: "integral(x**2, x)+integral(3*x, x)",
          explanation: null,
        },
        {
          title: "Integrando x² pela regra da potência",
          title_segments: [
            { type: "text", content: "Integrando" },
            { type: "math", content: "x**2" },
            { type: "text", content: "pela regra da potência" },
          ],
          expression: "x**3/3",
          explanation: null,
        },
        {
          title: "Integrando 3x pela regra da potência",
          title_segments: [
            { type: "text", content: "Integrando" },
            { type: "math", content: "3*x" },
            { type: "text", content: "pela regra da potência" },
          ],
          expression: "3*x**2/2",
          explanation: null,
        },
        {
          title: "Somando os resultados",
          title_segments: null,
          expression: "x**3/3 + 3*x**2/2",
          explanation: null,
        },
        {
          title: "Adicionando a constante de integração",
          title_segments: null,
          expression: "x**3/3 + 3*x**2/2 + C",
          explanation: "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C.",
        },
      ],
    });

    const { container } = render(<MathSteps expression="integral(x**2+3*x, x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    // 6 expressões de passo + 2 segmentos "math" de título = 8 elementos `.katex`.
    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(8));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(
      annotations.some((latex) => latex?.includes("\\int{x}^{2}+3\\cdotx\\,dx"))
    ).toBe(true);
    expect(
      annotations.some((latex) => latex?.includes("\\int{x}^{2}\\,dx+\\int3\\cdotx\\,dx"))
    ).toBe(true);
    // "+ C" com "C" em itálico normal (nunca "\mathrm{C}" — hotfix desta sprint).
    expect(annotations.some((latex) => latex === "\\frac{{x}^{3}}{3}+\\frac{3\\cdot{x}^{2}}{2}+C")).toBe(
      true
    );
    expect(
      screen.getByText("Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C.")
    ).toBeInTheDocument();
  });

  it("renderiza a integral de uma constante (regra específica) em KaTeX", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "integral(5, x)",
      result: "Integral: 5x + C",
      steps: [
        { title: "Integral original", title_segments: null, expression: "integral(5, x)", explanation: null },
        {
          title: "A integral de uma constante é a constante multiplicada pela variável",
          title_segments: null,
          expression: "5*x",
          explanation: null,
        },
        {
          title: "Adicionando a constante de integração",
          title_segments: null,
          expression: "5*x + C",
          explanation: "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C.",
        },
      ],
    });

    render(<MathSteps expression="integral(5, x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() =>
      expect(
        screen.getByText("A integral de uma constante é a constante multiplicada pela variável")
      ).toBeInTheDocument()
    );
    expect(screen.getByText("Adicionando a constante de integração")).toBeInTheDocument();
  });

  it("mostra erro amigável para integral fora do escopo (ex. seno), sem quebrar a tela", async () => {
    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(apiClient.solveSteps).mockRejectedValue(
      new ApiError(
        "invalid_expression",
        "O passo a passo para este tipo de integral ainda não foi implementado nesta versão."
      )
    );

    render(<MathSteps expression="integral(sin(x), x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() =>
      expect(
        screen.getByText("O passo a passo para este tipo de integral ainda não foi implementado nesta versão.")
      ).toBeInTheDocument()
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

/**
 * Sprint V2.10.2 (Passo a Passo — Integrais Definidas) — ZERO componente
 * novo (`MathSteps`/`MathStepItem`/`MixedMathText` intocados): confirma
 * que o texto matemático puro do Teorema Fundamental do Cálculo
 * (`integral(expr, x, a, b)`, "F(b)-F(a)", limites entre parênteses) já
 * passa pelo MESMO pipeline `valueToLatex` usado desde a V2.9, sem
 * precisar de nenhuma alteração no frontend.
 */
describe("MathSteps — compatibilidade com passos de integrais definidas (Sprint V2.10.2)", () => {
  beforeEach(() => {
    vi.mocked(apiClient.solveSteps).mockReset();
  });

  it("renderiza o Teorema Fundamental do Cálculo em KaTeX, nunca com +C", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "integral(x**2, x, 0, 2)",
      result: "Integral definida: 8/3",
      steps: [
        {
          title: "Integral original",
          title_segments: null,
          expression: "integral(x**2, x, 0, 2)",
          explanation: null,
        },
        {
          title: "Integrando x² pela regra da potência",
          title_segments: [
            { type: "text", content: "Integrando" },
            { type: "math", content: "x**2" },
            { type: "text", content: "pela regra da potência" },
          ],
          expression: "x**3/3",
          explanation: null,
        },
        {
          title: "Aplicando o Teorema Fundamental do Cálculo",
          title_segments: null,
          expression: "F(2)-F(0)",
          explanation: "Encontramos uma primitiva F(x) e calculamos F(b) - F(a), o Teorema Fundamental do Cálculo.",
        },
        {
          title: "Substituindo os limites",
          title_segments: null,
          expression: "(2)**3/3-((0)**3/3)",
          explanation: null,
        },
        { title: "Calculando", title_segments: null, expression: "8/3", explanation: null },
      ],
    });

    const { container } = render(<MathSteps expression="integral(x**2, x, 0, 2)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    // 5 expressões de passo + 1 segmento "math" de título = 6 elementos `.katex`.
    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(6));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.some((latex) => latex?.includes("\\int_{0}^{2}{x}^{2}\\,dx"))).toBe(true);
    expect(annotations.some((latex) => latex === "\\mathrm{F}\\left(2\\right)-\\mathrm{F}\\left(0\\right)")).toBe(
      true
    );
    expect(annotations.some((latex) => latex === "\\frac{8}{3}")).toBe(true);
    // Nenhum passo mostra "+ C" (integral definida nunca leva constante).
    expect(container.textContent).not.toContain("+ C");
    expect(
      screen.getByText(
        "Encontramos uma primitiva F(x) e calculamos F(b) - F(a), o Teorema Fundamental do Cálculo."
      )
    ).toBeInTheDocument();
  });

  it("renderiza limites iguais (intervalo de comprimento nulo) com explicação, sem calcular primitiva", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "integral(x**2, x, 3, 3)",
      result: "Integral definida: 0",
      steps: [
        {
          title: "Integral original",
          title_segments: null,
          expression: "integral(x**2, x, 3, 3)",
          explanation: null,
        },
        {
          title: "O intervalo de integração tem comprimento nulo (os limites são iguais)",
          title_segments: null,
          expression: "0",
          explanation:
            "Quando o limite inferior é igual ao superior, o intervalo não tem largura nenhuma — a integral definida vale sempre zero.",
        },
      ],
    });

    render(<MathSteps expression="integral(x**2, x, 3, 3)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() =>
      expect(
        screen.getByText("O intervalo de integração tem comprimento nulo (os limites são iguais)")
      ).toBeInTheDocument()
    );
    expect(
      screen.getByText(
        "Quando o limite inferior é igual ao superior, o intervalo não tem largura nenhuma — a integral definida vale sempre zero."
      )
    ).toBeInTheDocument();
  });

  it("renderiza limites invertidos preservando o sinal (área orientada, nunca valor absoluto)", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "integral(x**2, x, 2, 0)",
      result: "Integral definida: -8/3",
      steps: [
        {
          title: "Integral original",
          title_segments: null,
          expression: "integral(x**2, x, 2, 0)",
          explanation: null,
        },
        {
          title: "Integrando x² pela regra da potência",
          title_segments: null,
          expression: "x**3/3",
          explanation: null,
        },
        {
          title: "Aplicando o Teorema Fundamental do Cálculo",
          title_segments: null,
          expression: "F(0)-F(2)",
          explanation: null,
        },
        {
          title: "Substituindo os limites",
          title_segments: null,
          expression: "(0)**3/3-((2)**3/3)",
          explanation: null,
        },
        { title: "Calculando", title_segments: null, expression: "-8/3", explanation: null },
      ],
    });

    const { container } = render(<MathSteps expression="integral(x**2, x, 2, 0)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(5));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    // Fração negativa preservada, nunca convertida para valor absoluto.
    expect(annotations.some((latex) => latex === "\\frac{-8}{3}")).toBe(true);
  });

  it("mostra erro amigável para integral definida fora do escopo (ex. seno), sem quebrar a tela", async () => {
    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(apiClient.solveSteps).mockRejectedValue(
      new ApiError(
        "invalid_expression",
        "O passo a passo para este tipo de integral ainda não foi implementado nesta versão."
      )
    );

    render(<MathSteps expression="integral(sin(x), x, 0, 1)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() =>
      expect(
        screen.getByText("O passo a passo para este tipo de integral ainda não foi implementado nesta versão.")
      ).toBeInTheDocument()
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

/**
 * Sprint V2.11 (Passo a Passo — Regra do Produto e Regra da Cadeia) — ZERO
 * componente novo (`MathSteps`/`MathStepItem`/`MixedMathText` intocados): o
 * texto matemático puro que o backend agora envia ("f=x**2, g=sin(x)",
 * "u=x**2 + 1, y=u**3") já passa pelo MESMO pipeline `valueToLatex` usado
 * desde a V2.9, sem precisar de nenhuma alteração no frontend além da
 * correção pontual do símbolo "g" em `to-latex.ts` (mesmo padrão do "b"/"C"
 * — ver `to-latex.test.ts`).
 */
describe("MathSteps — compatibilidade com passos de regra do produto e regra da cadeia (Sprint V2.11)", () => {
  beforeEach(() => {
    vi.mocked(apiClient.solveSteps).mockReset();
  });

  it("renderiza a regra do produto (f=x², g=sen(x)) em KaTeX", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "d/dx(x**2*sin(x))",
      result: "Derivada: x²*cos(x) + 2x*sin(x)",
      steps: [
        {
          title: "Função original",
          title_segments: null,
          expression: "derivada(x**2*sin(x), x)",
          explanation: null,
        },
        {
          title: "Identificando um produto",
          title_segments: null,
          expression: "f=x**2, g=sin(x)",
          explanation: null,
        },
        {
          title: "Aplicando a regra do produto",
          title_segments: null,
          expression: "derivada(f*g, x)=derivada(f, x)*g+f*derivada(g, x)",
          explanation: null,
        },
        { title: "Derivando f", title_segments: null, expression: "2*x", explanation: null },
        { title: "Derivando g", title_segments: null, expression: "cos(x)", explanation: null },
        {
          title: "Substituindo",
          title_segments: null,
          expression: "2*x*sin(x)+x**2*cos(x)",
          explanation: null,
        },
        {
          title: "Simplificando",
          title_segments: null,
          expression: "x**2*cos(x) + 2*x*sin(x)",
          explanation: null,
        },
      ],
    });

    const { container } = render(<MathSteps expression="d/dx(x**2*sin(x))" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(7));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.some((latex) => latex === "f={x}^{2},\\;g=\\sin\\left(x\\right)")).toBe(true);
    expect(screen.getByText("Derivando f")).toBeInTheDocument();
    expect(screen.getByText("Derivando g")).toBeInTheDocument();
    expect(
      annotations.some((latex) => latex === "2\\cdotx\\cdot\\sin\\left(x\\right)+{x}^{2}\\cdot\\cos\\left(x\\right)")
    ).toBe(true);
    // Resultado final vindo do motor real, nunca inventado.
    expect(
      annotations.some((latex) => latex === "{x}^{2}\\cdot\\cos\\left(x\\right)+2\\cdotx\\cdot\\sin\\left(x\\right)")
    ).toBe(true);
  });

  it("nunca esconde a regra do produto atrás da expansão polinomial ((x+1)(x²+3))", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "d/dx((x+1)*(x**2+3))",
      result: "Derivada: x² + 2x*(x + 1) + 3",
      steps: [
        {
          title: "Função original",
          title_segments: null,
          expression: "derivada((x + 1)*(x**2 + 3), x)",
          explanation: null,
        },
        {
          title: "Identificando um produto",
          title_segments: null,
          expression: "f=x + 1, g=x**2 + 3",
          explanation: null,
        },
        {
          title: "Aplicando a regra do produto",
          title_segments: null,
          expression: "derivada(f*g, x)=derivada(f, x)*g+f*derivada(g, x)",
          explanation: null,
        },
        { title: "Derivando f", title_segments: null, expression: "1", explanation: null },
        { title: "Derivando g", title_segments: null, expression: "2*x", explanation: null },
        {
          title: "Substituindo",
          title_segments: null,
          expression: "1*(x**2 + 3)+(x + 1)*2*x",
          explanation: null,
        },
        {
          title: "Simplificando",
          title_segments: null,
          expression: "x**2 + 2*x*(x + 1) + 3",
          explanation: null,
        },
      ],
    });

    render(<MathSteps expression="d/dx((x+1)*(x**2+3))" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(screen.getByText("Identificando um produto")).toBeInTheDocument());
    expect(screen.queryByText("Identificando função composta")).not.toBeInTheDocument();
  });

  it("renderiza a regra da cadeia ((x²+1)³) em KaTeX, com u/y como variáveis auxiliares", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "d/dx((x**2+1)**3)",
      result: "Derivada: 6x*(x² + 1)²",
      steps: [
        {
          title: "Função original",
          title_segments: null,
          expression: "derivada((x**2 + 1)**3, x)",
          explanation: null,
        },
        {
          title: "Identificando função composta",
          title_segments: null,
          expression: "u=x**2 + 1, y=u**3",
          explanation: null,
        },
        { title: "Derivando a externa", title_segments: null, expression: "3*u**2", explanation: null },
        { title: "Derivando a interna", title_segments: null, expression: "2*x", explanation: null },
        {
          title: "Aplicando a regra da cadeia",
          title_segments: null,
          expression: "3*(x**2 + 1)**2*2*x",
          explanation: null,
        },
        {
          title: "Simplificando",
          title_segments: null,
          expression: "6*x*(x**2 + 1)**2",
          explanation: null,
        },
      ],
    });

    const { container } = render(<MathSteps expression="d/dx((x**2+1)**3)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(6));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.some((latex) => latex === "u={x}^{2}+1,\\;y={u}^{3}")).toBe(true);
    expect(annotations.some((latex) => latex === "3\\cdot{u}^{2}")).toBe(true);
    expect(annotations.some((latex) => latex === "6\\cdotx\\cdot{\\left({x}^{2}+1\\right)}^{2}")).toBe(true);
  });

  it("combina produto e cadeia ((x²+1)³·sen(x)) sem colidir os passos", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "d/dx((x**2+1)**3*sin(x))",
      result: "Derivada: 6x*(x² + 1)²*sin(x) + (x² + 1)³*cos(x)",
      steps: [
        {
          title: "Função original",
          title_segments: null,
          expression: "derivada((x**2 + 1)**3*sin(x), x)",
          explanation: null,
        },
        {
          title: "Identificando um produto",
          title_segments: null,
          expression: "f=(x**2 + 1)**3, g=sin(x)",
          explanation: null,
        },
        {
          title: "Aplicando a regra do produto",
          title_segments: null,
          expression: "derivada(f*g, x)=derivada(f, x)*g+f*derivada(g, x)",
          explanation: null,
        },
        {
          title: "Identificando função composta",
          title_segments: null,
          expression: "u=x**2 + 1, y=u**3",
          explanation: null,
        },
        { title: "Derivando a externa", title_segments: null, expression: "3*u**2", explanation: null },
        { title: "Derivando a interna", title_segments: null, expression: "2*x", explanation: null },
        {
          title: "Aplicando a regra da cadeia",
          title_segments: null,
          expression: "3*(x**2 + 1)**2*2*x",
          explanation: null,
        },
        {
          title: "Simplificando",
          title_segments: null,
          expression: "6*x*(x**2 + 1)**2",
          explanation: null,
        },
        { title: "Derivando g", title_segments: null, expression: "cos(x)", explanation: null },
        {
          title: "Substituindo",
          title_segments: null,
          expression: "6*x*(x**2 + 1)**2*sin(x)+(x**2 + 1)**3*cos(x)",
          explanation: null,
        },
        {
          title: "Simplificando",
          title_segments: null,
          expression: "6*x*(x**2 + 1)**2*sin(x) + (x**2 + 1)**3*cos(x)",
          explanation: null,
        },
      ],
    });

    render(<MathSteps expression="d/dx((x**2+1)**3*sin(x))" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(screen.getAllByText("Identificando um produto").length).toBe(1));
    expect(screen.getAllByText("Identificando função composta").length).toBe(1);
    // "Simplificando" aparece 2× (cadeia do primeiro fator + resultado
    // final do produto) — cada ocorrência é um passo real e distinto.
    expect(screen.getAllByText("Simplificando").length).toBe(2);
  });

  it("mostra erro amigável para derivada de quociente (regra do quociente fora de escopo), sem quebrar a tela", async () => {
    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(apiClient.solveSteps).mockRejectedValue(
      new ApiError(
        "invalid_expression",
        "O passo a passo para este tipo de derivada ainda não foi implementado nesta versão."
      )
    );

    render(<MathSteps expression="d/dx(x/sin(x))" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() =>
      expect(
        screen.getByText("O passo a passo para este tipo de derivada ainda não foi implementado nesta versão.")
      ).toBeInTheDocument()
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

/**
 * Sprint V2.12 (Passo a Passo — Limites) — ZERO componente novo
 * (`MathSteps`/`MathStepItem`/`MixedMathText` intocados) e ZERO mudança em
 * `to-latex.ts`: `\lim_{x \to p}` já era suportado desde a Sprint 12
 * (wrapper `limite(...)` no `productHandler`), e o texto matemático puro
 * dos novos passos ("0/0", "(x - 2)*(x + 2)", frações de frações com
 * expoente negativo) já passa pelo MESMO pipeline `valueToLatex` usado
 * desde a V2.9 — confirmado por debug-render antes de escrever este
 * arquivo, sem precisar de nenhuma correção pontual de símbolo desta vez.
 */
describe("MathSteps — compatibilidade com passos de limites (Sprint V2.12)", () => {
  beforeEach(() => {
    vi.mocked(apiClient.solveSteps).mockReset();
  });

  it("renderiza a substituição direta (função contínua) em KaTeX", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "limite(x**2+1, x, 2)",
      result: "Limite: 5",
      steps: [
        {
          title: "Expressão original",
          title_segments: null,
          expression: "limite(x**2 + 1, x, 2)",
          explanation: null,
        },
        {
          title: "Como a função é contínua em x=2, podemos substituir diretamente.",
          title_segments: null,
          expression: "(2)**2 + 1",
          explanation: null,
        },
        { title: "Calculando", title_segments: null, expression: "5", explanation: null },
      ],
    });

    const { container } = render(<MathSteps expression="limite(x**2+1, x, 2)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(3));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.some((latex) => latex?.includes("\\lim_{x\\to2}"))).toBe(true);
    expect(
      screen.getByText("Como a função é contínua em x=2, podemos substituir diretamente.")
    ).toBeInTheDocument();
    expect(annotations.some((latex) => latex === "{\\left(2\\right)}^{2}+1")).toBe(true);
    expect(annotations.some((latex) => latex === "5")).toBe(true);
  });

  it("renderiza a indeterminação 0/0, fatoração e cancelamento em KaTeX", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "limite((x**2-4)/(x-2), x, 2)",
      result: "Limite: 4",
      steps: [
        {
          title: "Expressão original",
          title_segments: null,
          expression: "limite((x**2 - 4)/(x - 2), x, 2)",
          explanation: null,
        },
        { title: "Substituindo", title_segments: null, expression: "0/0", explanation: null },
        {
          title: "Reconhecemos uma indeterminação.",
          title_segments: null,
          expression: "0/0",
          explanation:
            "A substituição direta resulta em 0/0, uma forma indeterminada — precisamos simplificar a expressão antes de calcular o limite.",
        },
        {
          title: "Fatorando",
          title_segments: null,
          expression: "(x - 2)*(x + 2)",
          explanation: null,
        },
        {
          title: "Cancelando o fator comum",
          title_segments: null,
          expression: "x + 2",
          explanation: null,
        },
        { title: "Substituindo", title_segments: null, expression: "4", explanation: null },
      ],
    });

    const { container } = render(<MathSteps expression="limite((x**2-4)/(x-2), x, 2)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(6));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.filter((latex) => latex === "\\frac{0}{0}").length).toBe(2);
    expect(
      screen.getByText(
        "A substituição direta resulta em 0/0, uma forma indeterminada — precisamos simplificar a expressão antes de calcular o limite."
      )
    ).toBeInTheDocument();
    expect(annotations.some((latex) => latex === "\\left(x-2\\right)\\cdot\\left(x+2\\right)")).toBe(true);
    expect(annotations.some((latex) => latex === "x+2")).toBe(true);
    expect(annotations.some((latex) => latex === "4")).toBe(true);
  });

  it("renderiza o limite no infinito por comparação de graus em KaTeX", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "limite((3*x**2+2)/(x**2-1), x, oo)",
      result: "Limite: 3",
      steps: [
        {
          title: "Expressão original",
          title_segments: null,
          expression: "limite((3*x**2 + 2)/(x**2 - 1), x, oo)",
          explanation: null,
        },
        {
          title: "O maior grau do numerador é 2 e o maior grau do denominador é 2.",
          title_segments: null,
          expression: "(3*x**2 + 2)/(x**2 - 1)",
          explanation: null,
        },
        {
          title: "Dividindo o numerador e o denominador por x**2",
          title_segments: null,
          expression: "(3 + 2/x**2)/(1 - 1/x**2)",
          explanation: null,
        },
        {
          title: "Quando x→∞, os termos com x no denominador tendem a zero.",
          title_segments: null,
          expression: "3/1",
          explanation: null,
        },
        { title: "Simplificando", title_segments: null, expression: "3", explanation: null },
      ],
    });

    const { container } = render(<MathSteps expression="limite((3*x**2+2)/(x**2-1), x, oo)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(5));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.some((latex) => latex?.includes("\\lim_{x\\to\\infty}"))).toBe(true);
    expect(
      screen.getByText("O maior grau do numerador é 2 e o maior grau do denominador é 2.")
    ).toBeInTheDocument();
    expect(
      annotations.some(
        (latex) => latex === "\\frac{\\left(3+\\frac{2}{{x}^{2}}\\right)}{\\left(1-\\frac{1}{{x}^{2}}\\right)}"
      )
    ).toBe(true);
    expect(annotations.some((latex) => latex === "\\frac{3}{1}")).toBe(true);
    expect(annotations.some((latex) => latex === "3")).toBe(true);
  });

  it("mostra erro amigável para limite trigonométrico fora de escopo (ex. tan(x)/x), sem quebrar a tela", async () => {
    // sen(x)/x deixou de ser um exemplo de rejeição desde a Sprint
    // V2.12.1 (agora suportado — ver describe block dedicado abaixo);
    // tan(x)/x continua fora de escopo.
    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(apiClient.solveSteps).mockRejectedValue(
      new ApiError(
        "invalid_expression",
        "O passo a passo para este tipo de limite ainda não foi implementado nesta versão."
      )
    );

    render(<MathSteps expression="limite(tan(x)/x, x, 0)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() =>
      expect(
        screen.getByText("O passo a passo para este tipo de limite ainda não foi implementado nesta versão.")
      ).toBeInTheDocument()
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

/**
 * Sprint V2.12.1 (Passo a Passo — Limites Trigonométricos Fundamentais) —
 * ZERO componente novo (`MathSteps`/`MathStepItem`/`MixedMathText`
 * intocados) e ZERO mudança em `to-latex.ts`: o texto matemático puro dos
 * novos passos ("limite(sin(u)/u, u, 0)=1", "3*sin(3*x)/(3*x)", frações ao
 * quadrado como "(sen(x/2)/(x/2))²") já passa pelo MESMO pipeline
 * `valueToLatex` usado desde a V2.9 — confirmado por debug-render antes de
 * escrever este arquivo, sem precisar de nenhuma correção pontual de
 * símbolo (o placeholder "u" já era seguro desde a V2.11).
 */
describe("MathSteps — compatibilidade com passos de limites trigonométricos fundamentais (Sprint V2.12.1)", () => {
  beforeEach(() => {
    vi.mocked(apiClient.solveSteps).mockReset();
  });

  it("renderiza sen(x)/x reduzido diretamente ao limite fundamental", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "limite(sin(x)/x, x, 0)",
      result: "Limite: 1",
      steps: [
        {
          title: "Expressão original",
          title_segments: null,
          expression: "limite(sin(x)/x, x, 0)",
          explanation: null,
        },
        {
          title: "Reconhecendo o limite fundamental",
          title_segments: null,
          expression: "limite(sin(x)/x, x, 0)=1",
          explanation: "Este é o limite trigonométrico fundamental: quando u→0, sen(u)/u tende a 1.",
        },
        { title: "Calculando", title_segments: null, expression: "1", explanation: null },
      ],
    });

    const { container } = render(<MathSteps expression="limite(sin(x)/x, x, 0)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(3));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.some((latex) => latex === "\\lim_{x\\to0}\\frac{\\sin\\left(x\\right)}{x}=1")).toBe(
      true
    );
    expect(
      screen.getByText("Este é o limite trigonométrico fundamental: quando u→0, sen(u)/u tende a 1.")
    ).toBeInTheDocument();
    expect(annotations.some((latex) => latex === "1")).toBe(true);
  });

  it("renderiza sen(3x)/x reescrito para isolar o limite fundamental (coeficiente 3)", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "limite(sin(3*x)/x, x, 0)",
      result: "Limite: 3",
      steps: [
        {
          title: "Expressão original",
          title_segments: null,
          expression: "limite(sin(3*x)/x, x, 0)",
          explanation: null,
        },
        {
          title: "Reconhecendo o limite fundamental",
          title_segments: null,
          expression: "limite(sin(u)/u, u, 0)=1",
          explanation: null,
        },
        {
          title: "Reescrevendo para isolar o limite fundamental",
          title_segments: null,
          expression: "3*sin(3*x)/(3*x)",
          explanation: null,
        },
        {
          title: "Aplicando o limite fundamental",
          title_segments: null,
          expression: "3*1",
          explanation: null,
        },
        { title: "Calculando", title_segments: null, expression: "3", explanation: null },
      ],
    });

    const { container } = render(<MathSteps expression="limite(sin(3*x)/x, x, 0)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(5));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.some((latex) => latex === "\\lim_{u\\to0}\\frac{\\sin\\left(u\\right)}{u}=1")).toBe(
      true
    );
    expect(
      annotations.some((latex) => latex === "\\frac{3\\cdot\\sin\\left(3\\cdotx\\right)}{\\left(3\\cdotx\\right)}")
    ).toBe(true);
    expect(annotations.some((latex) => latex === "3\\cdot1")).toBe(true);
    expect(annotations.some((latex) => latex === "3")).toBe(true);
  });

  it("renderiza (1-cos(3x))/x² com a identidade trigonométrica e a fração ao quadrado", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "limite((1-cos(3*x))/x**2, x, 0)",
      result: "Limite: 9/2",
      steps: [
        {
          title: "Expressão original",
          title_segments: null,
          expression: "limite((1 - cos(3*x))/x**2, x, 0)",
          explanation: null,
        },
        {
          title: "Aplicando a identidade 1-cos(θ)=2sen²(θ/2)",
          title_segments: null,
          expression: "1-cos(3*x)=2*sin(3*x/2)**2",
          explanation: null,
        },
        {
          title: "Reorganizando a fração",
          title_segments: null,
          expression: "9/2*(sin(3*x/2)/(3*x/2))**2",
          explanation: null,
        },
        {
          title: "Reconhecendo o limite fundamental",
          title_segments: null,
          expression: "limite(sin(u)/u, u, 0)=1",
          explanation: null,
        },
        {
          title: "Aplicando o limite fundamental",
          title_segments: null,
          expression: "9/2*1**2",
          explanation: null,
        },
        { title: "Calculando", title_segments: null, expression: "9/2", explanation: null },
      ],
    });

    const { container } = render(<MathSteps expression="limite((1-cos(3*x))/x**2, x, 0)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(6));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(
      annotations.some(
        (latex) => latex === "1-\\cos\\left(3\\cdotx\\right)=2\\cdot{\\sin\\left(\\frac{3\\cdotx}{2}\\right)}^{2}"
      )
    ).toBe(true);
    expect(
      annotations.some(
        (latex) =>
          latex ===
          "\\frac{9}{2}\\cdot{\\left(\\frac{\\sin\\left(\\frac{3\\cdotx}{2}\\right)}{\\left(\\frac{3\\cdotx}{2}\\right)}\\right)}^{2}"
      )
    ).toBe(true);
    expect(annotations.some((latex) => latex === "\\frac{9}{2}")).toBe(true);
  });

  it("nunca esconde os limites racionais atrás do caminho trigonométrico (regressão)", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "limite((x**2-4)/(x-2), x, 2)",
      result: "Limite: 4",
      steps: [
        {
          title: "Expressão original",
          title_segments: null,
          expression: "limite((x**2 - 4)/(x - 2), x, 2)",
          explanation: null,
        },
        { title: "Substituindo", title_segments: null, expression: "0/0", explanation: null },
        {
          title: "Reconhecemos uma indeterminação.",
          title_segments: null,
          expression: "0/0",
          explanation: null,
        },
        { title: "Fatorando", title_segments: null, expression: "(x - 2)*(x + 2)", explanation: null },
        {
          title: "Cancelando o fator comum",
          title_segments: null,
          expression: "x + 2",
          explanation: null,
        },
        { title: "Substituindo", title_segments: null, expression: "4", explanation: null },
      ],
    });

    render(<MathSteps expression="limite((x**2-4)/(x-2), x, 2)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(screen.getByText("Fatorando")).toBeInTheDocument());
    expect(screen.queryByText("Reconhecendo o limite fundamental")).not.toBeInTheDocument();
  });

  it("mostra erro amigável para limite trigonométrico com expoente na variável (ex. sen(x²)/x), sem quebrar a tela", async () => {
    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(apiClient.solveSteps).mockRejectedValue(
      new ApiError(
        "invalid_expression",
        "O passo a passo para este tipo de limite ainda não foi implementado nesta versão."
      )
    );

    render(<MathSteps expression="limite(sin(x**2)/x, x, 0)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() =>
      expect(
        screen.getByText("O passo a passo para este tipo de limite ainda não foi implementado nesta versão.")
      ).toBeInTheDocument()
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
