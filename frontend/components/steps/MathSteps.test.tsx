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
