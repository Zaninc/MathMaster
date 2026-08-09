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
      annotations.some((latex) => latex === "2\\cdotx\\sin\\left(x\\right)+{x}^{2}\\cos\\left(x\\right)")
    ).toBe(true);
    // Resultado final vindo do motor real, nunca inventado.
    expect(
      annotations.some((latex) => latex === "{x}^{2}\\cos\\left(x\\right)+2\\cdotx\\sin\\left(x\\right)")
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

  it("mostra erro amigável para expoente fracionário (fora de escopo), sem quebrar a tela", async () => {
    // d/dx(x/sin(x)) deixou de ser um exemplo de rejeição desde a Sprint
    // V2.13 (regra do quociente, ver describe block dedicado abaixo);
    // expoente fracionário continua fora de escopo.
    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(apiClient.solveSteps).mockRejectedValue(
      new ApiError(
        "invalid_expression",
        "O passo a passo para este tipo de derivada ainda não foi implementado nesta versão."
      )
    );

    render(<MathSteps expression="d/dx(x**(1/2))" />);
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

  it("mostra erro amigável para limite fora de escopo (ex. x*ln(x), indeterminação 0·∞), sem quebrar a tela", async () => {
    // sen(x)/x deixou de ser um exemplo de rejeição desde a Sprint V2.12.1
    // (agora suportado — ver describe block dedicado abaixo); tan(x)/x
    // deixou de ser um exemplo válido desde a V2.12.2 (0/0 genuíno, agora
    // resolvido pela Regra de L'Hôpital). x*ln(x) é uma indeterminação
    // 0·∞ — nunca um quociente 0/0 ou ∞/∞ — continua fora de escopo.
    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(apiClient.solveSteps).mockRejectedValue(
      new ApiError(
        "invalid_expression",
        "O passo a passo para este tipo de limite ainda não foi implementado nesta versão."
      )
    );

    render(<MathSteps expression="limite(x*ln(x), x, 0)" />);
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
      annotations.some((latex) => latex === "\\frac{3\\sin\\left(3\\cdotx\\right)}{\\left(3\\cdotx\\right)}")
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

  it("mostra erro amigável para limite trigonométrico que nunca forma 0/0 ou ∞/∞ de verdade (ex. cos(x²)), sem quebrar a tela", async () => {
    // sen(x²)/x deixou de ser um exemplo de rejeição desde a Sprint
    // V2.12.2 (0/0 genuíno, agora resolvido pela Regra de L'Hôpital — ver
    // describe block dedicado abaixo). cos(x²) tem denominador sempre 1
    // (nunca se anula) — nunca indeterminado, continua fora de escopo.
    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(apiClient.solveSteps).mockRejectedValue(
      new ApiError(
        "invalid_expression",
        "O passo a passo para este tipo de limite ainda não foi implementado nesta versão."
      )
    );

    render(<MathSteps expression="limite(cos(x**2), x, 0)" />);
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
 * Sprint V2.12.2 (Passo a Passo — Regra de L'Hôpital) — ZERO componente
 * novo (`MathSteps`/`MathStepItem`/`MixedMathText` intocados) e ZERO
 * mudança em `to-latex.ts`: o texto matemático puro dos novos passos
 * ("0/0", "oo/oo", "exp(x)", "limite(exp(x)/1, x, 0)") já passa pelo MESMO
 * pipeline `valueToLatex` usado desde a V2.9 — confirmado por debug-render
 * antes de escrever este arquivo, incluindo que "oo" já renderiza como
 * `\infty` sem nenhuma correção pontual de símbolo.
 */
describe("MathSteps — compatibilidade com passos da Regra de L'Hôpital (Sprint V2.12.2)", () => {
  beforeEach(() => {
    vi.mocked(apiClient.solveSteps).mockReset();
  });

  it("renderiza a indeterminação 0/0 resolvida por L'Hôpital em KaTeX", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "limite((exp(x)-1)/x, x, 0)",
      result: "Limite: 1",
      steps: [
        {
          title: "Expressão original",
          title_segments: null,
          expression: "limite(exp(x) - 1, x, 0)",
          explanation: null,
        },
        { title: "Substituindo o limite", title_segments: null, expression: "0/0", explanation: null },
        {
          title: "Reconhecemos uma forma indeterminada.",
          title_segments: null,
          expression: "0/0",
          explanation:
            "A Regra de L'Hôpital diz que, se lim f(x)/g(x) resulta em 0/0 ou ∞/∞ e f e g são deriváveis, então lim f(x)/g(x) = lim f'(x)/g'(x), desde que esse novo limite exista.",
        },
        { title: "Derivando o numerador", title_segments: null, expression: "exp(x)", explanation: null },
        { title: "Derivando o denominador", title_segments: null, expression: "1", explanation: null },
        {
          title: "Aplicando a Regra de L'Hôpital (novo limite)",
          title_segments: null,
          expression: "limite(exp(x)/1, x, 0)",
          explanation: null,
        },
        { title: "Substituindo", title_segments: null, expression: "exp((0))", explanation: null },
        { title: "Calculando", title_segments: null, expression: "1", explanation: null },
      ],
    });

    const { container } = render(<MathSteps expression="limite((exp(x)-1)/x, x, 0)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(8));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.filter((latex) => latex === "\\frac{0}{0}").length).toBe(2);
    expect(
      screen.getByText(
        "A Regra de L'Hôpital diz que, se lim f(x)/g(x) resulta em 0/0 ou ∞/∞ e f e g são deriváveis, então lim f(x)/g(x) = lim f'(x)/g'(x), desde que esse novo limite exista."
      )
    ).toBeInTheDocument();
    expect(annotations.some((latex) => latex === "e^{x}")).toBe(true);
    expect(annotations.some((latex) => latex === "e^{\\left(0\\right)}")).toBe(true);
    expect(annotations.some((latex) => latex === "1")).toBe(true);
  });

  it("renderiza a indeterminação ∞/∞ resolvida por L'Hôpital, com o símbolo de infinito correto", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "limite(ln(x)/x, x, oo)",
      result: "Limite: 0",
      steps: [
        {
          title: "Expressão original",
          title_segments: null,
          expression: "limite(log(x)/x, x, oo)",
          explanation: null,
        },
        { title: "Substituindo o limite", title_segments: null, expression: "oo/oo", explanation: null },
        {
          title: "Reconhecemos uma forma indeterminada.",
          title_segments: null,
          expression: "oo/oo",
          explanation: null,
        },
        { title: "Derivando o numerador", title_segments: null, expression: "1/x", explanation: null },
        { title: "Derivando o denominador", title_segments: null, expression: "1", explanation: null },
        {
          title: "Aplicando a Regra de L'Hôpital (novo limite)",
          title_segments: null,
          expression: "limite(1/x/1, x, oo)",
          explanation: null,
        },
        { title: "Calculando", title_segments: null, expression: "0", explanation: null },
      ],
    });

    const { container } = render(<MathSteps expression="limite(ln(x)/x, x, oo)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(7));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.filter((latex) => latex === "\\frac{\\infty}{\\infty}").length).toBe(2);
    expect(annotations.some((latex) => latex === "0")).toBe(true);
  });

  it("nunca esconde os limites racionais/trigonométricos atrás de L'Hôpital (regressão)", async () => {
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
          explanation: null,
        },
        { title: "Calculando", title_segments: null, expression: "1", explanation: null },
      ],
    });

    render(<MathSteps expression="limite(sin(x)/x, x, 0)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(screen.getByText("Reconhecendo o limite fundamental")).toBeInTheDocument());
    expect(screen.queryByText("Reconhecemos uma forma indeterminada.")).not.toBeInTheDocument();
  });

  it("mostra erro amigável quando o limite exige aplicações sucessivas de L'Hôpital, sem quebrar a tela", async () => {
    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(apiClient.solveSteps).mockRejectedValue(
      new ApiError(
        "invalid_expression",
        "Este limite requer aplicações sucessivas da Regra de L'Hôpital, que ainda não fazem parte desta versão."
      )
    );

    render(<MathSteps expression="limite(x**2/exp(x), x, oo)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Este limite requer aplicações sucessivas da Regra de L'Hôpital, que ainda não fazem parte desta versão."
        )
      ).toBeInTheDocument()
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

/**
 * Sprint V2.13 (Passo a Passo — Regra do Quociente) — ZERO componente novo
 * (`MathSteps`/`MathStepItem`/`MixedMathText` intocados) e ZERO mudança em
 * `to-latex.ts`: a fórmula `derivada(f/g, x)=(derivada(f, x)*g-f*derivada(g,
 * x))/g**2` (reaproveitando a notação de derivada e o placeholder "g" já
 * seguro desde a V2.11) e frações com denominador ao quadrado já passam
 * pelo MESMO pipeline `valueToLatex` usado desde a V2.9 — confirmado por
 * debug-render antes de escrever este arquivo.
 */
describe("MathSteps — compatibilidade com passos de regra do quociente (Sprint V2.13)", () => {
  beforeEach(() => {
    vi.mocked(apiClient.solveSteps).mockReset();
  });

  it("renderiza x/sen(x) com a Regra do Quociente em KaTeX", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "d/dx(x/sin(x))",
      result: "Derivada: -x*cos(x)/sin(x)² + 1/sin(x)",
      steps: [
        {
          title: "Função original",
          title_segments: null,
          expression: "derivada(x/sin(x), x)",
          explanation: null,
        },
        {
          title: "Identificando um quociente",
          title_segments: null,
          expression: "f=x, g=sin(x)",
          explanation: null,
        },
        {
          title: "Aplicando a Regra do Quociente",
          title_segments: null,
          expression: "derivada(f/g, x)=(derivada(f, x)*g-f*derivada(g, x))/g**2",
          explanation: null,
        },
        { title: "Calculando f'", title_segments: null, expression: "1", explanation: null },
        { title: "Calculando g'", title_segments: null, expression: "cos(x)", explanation: null },
        {
          title: "Substituindo",
          title_segments: null,
          expression: "(sin(x)-x*cos(x))/(sin(x)**2)",
          explanation: null,
        },
        {
          title: "Simplificando",
          title_segments: null,
          expression: "-x*cos(x)/sin(x)**2 + 1/sin(x)",
          explanation: null,
        },
      ],
    });

    const { container } = render(<MathSteps expression="d/dx(x/sin(x))" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(7));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.some((latex) => latex === "f=x,\\;g=\\sin\\left(x\\right)")).toBe(true);
    expect(screen.getByText("Calculando f'")).toBeInTheDocument();
    expect(screen.getByText("Calculando g'")).toBeInTheDocument();
    expect(
      annotations.some(
        (latex) =>
          latex ===
          "\\frac{d}{dx}\\left(\\frac{f}{g}\\right)=\\frac{\\left(\\frac{d}{dx}\\left(f\\right)\\cdotg-f\\cdot\\frac{d}{dx}\\left(g\\right)\\right)}{{g}^{2}}"
      )
    ).toBe(true);
    expect(
      annotations.some(
        (latex) => latex === "\\frac{\\left(\\sin\\left(x\\right)-x\\cos\\left(x\\right)\\right)}{\\left({\\sin\\left(x\\right)}^{2}\\right)}"
      )
    ).toBe(true);
  });

  it("renderiza ln(x)/x nunca mostrando log(x) (convenção log=base10/ln=natural)", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "d/dx(ln(x)/x)",
      result: "Derivada: -ln(x)/x² + x⁻²",
      steps: [
        {
          title: "Função original",
          title_segments: null,
          expression: "derivada(ln(x)/x, x)",
          explanation: null,
        },
        {
          title: "Identificando um quociente",
          title_segments: null,
          expression: "f=ln(x), g=x",
          explanation: null,
        },
        {
          title: "Aplicando a Regra do Quociente",
          title_segments: null,
          expression: "derivada(f/g, x)=(derivada(f, x)*g-f*derivada(g, x))/g**2",
          explanation: null,
        },
        { title: "Calculando f'", title_segments: null, expression: "1/x", explanation: null },
        { title: "Calculando g'", title_segments: null, expression: "1", explanation: null },
        {
          title: "Substituindo",
          title_segments: null,
          expression: "(1/x*x-ln(x))/(x**2)",
          explanation: null,
        },
        {
          title: "Simplificando",
          title_segments: null,
          expression: "-ln(x)/x**2 + x**(-2)",
          explanation: null,
        },
      ],
    });

    const { container } = render(<MathSteps expression="d/dx(ln(x)/x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(7));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.some((latex) => latex?.includes("\\ln"))).toBe(true);
    expect(annotations.some((latex) => latex?.includes("\\log"))).toBe(false);
  });

  it("combina quociente e cadeia ((x²+1)³/(x+2)) sem colidir os passos", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "d/dx((x**2+1)**3/(x+2))",
      result: "Derivada: 6x*(x² + 1)²/(x + 2) - (x² + 1)³/(x + 2)²",
      steps: [
        {
          title: "Função original",
          title_segments: null,
          expression: "derivada((x**2 + 1)**3/(x + 2), x)",
          explanation: null,
        },
        {
          title: "Identificando um quociente",
          title_segments: null,
          expression: "f=(x**2 + 1)**3, g=x + 2",
          explanation: null,
        },
        {
          title: "Aplicando a Regra do Quociente",
          title_segments: null,
          expression: "derivada(f/g, x)=(derivada(f, x)*g-f*derivada(g, x))/g**2",
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
        { title: "Calculando g'", title_segments: null, expression: "1", explanation: null },
        {
          title: "Substituindo",
          title_segments: null,
          expression: "(6*x*(x**2 + 1)**2*(x + 2)-(x**2 + 1)**3)/((x + 2)**2)",
          explanation: null,
        },
        {
          title: "Simplificando",
          title_segments: null,
          expression: "6*x*(x**2 + 1)**2/(x + 2) - (x**2 + 1)**3/(x + 2)**2",
          explanation: null,
        },
      ],
    });

    render(<MathSteps expression="d/dx((x**2+1)**3/(x+2))" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(screen.getAllByText("Identificando um quociente").length).toBe(1));
    expect(screen.getAllByText("Identificando função composta").length).toBe(1);
  });

  it("nunca esconde o denominador constante atrás da regra do quociente (regressão)", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "d/dx(x**2/5)",
      result: "Derivada: 2x/5",
      steps: [
        {
          title: "Função original",
          title_segments: null,
          expression: "derivada(x**2/5, x)",
          explanation: null,
        },
        {
          title: "Derivando 1/5x² pela regra da potência",
          title_segments: [
            { type: "text", content: "Derivando" },
            { type: "math", content: "x**2/5" },
            { type: "text", content: "pela regra da potência" },
          ],
          expression: "2*1/5*x",
          explanation: null,
        },
        { title: "Simplificando", title_segments: null, expression: "2*x/5", explanation: null },
      ],
    });

    render(<MathSteps expression="d/dx(x**2/5)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(screen.getByText("Simplificando")).toBeInTheDocument());
    expect(screen.queryByText("Identificando um quociente")).not.toBeInTheDocument();
  });
});

/**
 * Sprint V2.14 (Passo a Passo — Integração por Substituição) — ZERO
 * componente novo (`MathSteps`/`MathStepItem`/`MixedMathText` intocados) e
 * ZERO mudança em `to-latex.ts`: "u=...", "du=...*dx" e
 * "coeficiente*integral(u**n, u)" já passam pelo MESMO pipeline
 * `valueToLatex` usado desde a V2.9 — confirmado por debug-render antes de
 * escrever este arquivo (inclusive que "du"/"dx" são lidos como
 * identificadores próprios pelo mathjs, sem multiplicação implícita
 * indevida "d*u"/"d*x").
 */
describe("MathSteps — compatibilidade com passos de substituição / u-substitution (Sprint V2.14)", () => {
  beforeEach(() => {
    vi.mocked(apiClient.solveSteps).mockReset();
  });

  it("renderiza ∫2x(x²+1)³dx com substituição em KaTeX", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "integral(2*x*(x**2+1)**3, x)",
      result: "Integral: x⁸/4 + x⁶ + 3x⁴/2 + x² + C",
      steps: [
        {
          title: "Integral original",
          title_segments: null,
          expression: "integral(2*x*(x**2 + 1)**3, x)",
          explanation: null,
        },
        {
          title: "Identificando uma substituição",
          title_segments: null,
          expression: "u=x**2 + 1",
          explanation: null,
        },
        { title: "Derivando u", title_segments: null, expression: "du=2*x*dx", explanation: null },
        { title: "Substituindo", title_segments: null, expression: "integral(u**3, u)", explanation: null },
        { title: "Integrando", title_segments: null, expression: "u**4/4", explanation: null },
        {
          title: "Voltando para x",
          title_segments: null,
          expression: "(x**2 + 1)**4/4",
          explanation: null,
        },
        {
          title: "Adicionando a constante de integração",
          title_segments: null,
          expression: "x**8/4 + x**6 + 3*x**4/2 + x**2 + C",
          explanation:
            "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C.",
        },
      ],
    });

    const { container } = render(<MathSteps expression="integral(2*x*(x**2+1)**3, x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(7));
    expect(screen.getByText("Identificando uma substituição")).toBeInTheDocument();
    expect(screen.getByText("Derivando u")).toBeInTheDocument();
    expect(screen.getByText("Voltando para x")).toBeInTheDocument();

    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.some((latex) => latex === "u={x}^{2}+1")).toBe(true);
    expect(annotations.some((latex) => latex === "du=2\\cdotx\\cdotdx")).toBe(true);
    expect(annotations.some((latex) => latex === "\\int{u}^{3}\\,du")).toBe(true);
  });

  it("fatora o coeficiente corretamente em ∫6x(x²+1)⁵dx (caso combinado)", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "integral(6*x*(x**2+1)**5, x)",
      result: "Integral: x¹²/2 + 3x¹⁰ + 15x⁸/2 + 10x⁶ + 15x⁴/2 + 3x² + C",
      steps: [
        {
          title: "Integral original",
          title_segments: null,
          expression: "integral(6*x*(x**2 + 1)**5, x)",
          explanation: null,
        },
        {
          title: "Identificando uma substituição",
          title_segments: null,
          expression: "u=x**2 + 1",
          explanation: null,
        },
        { title: "Derivando u", title_segments: null, expression: "du=2*x*dx", explanation: null },
        {
          title: "Substituindo",
          title_segments: null,
          expression: "3*integral(u**5, u)",
          explanation: null,
        },
        { title: "Integrando", title_segments: null, expression: "u**6/2", explanation: null },
        {
          title: "Voltando para x",
          title_segments: null,
          expression: "(x**2 + 1)**6/2",
          explanation: null,
        },
        {
          title: "Adicionando a constante de integração",
          title_segments: null,
          expression: "x**12/2 + 3*x**10 + 15*x**8/2 + 10*x**6 + 15*x**4/2 + 3*x**2 + C",
          explanation:
            "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C.",
        },
      ],
    });

    const { container } = render(<MathSteps expression="integral(6*x*(x**2+1)**5, x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(7));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.some((latex) => latex === "3\\cdot\\int{u}^{5}\\,du")).toBe(true);
  });

  it("renderiza ∫1/(2x+1)·2dx com ln (nunca log) para a substituição racional", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "integral(1/(2*x+1)*2, x)",
      result: "Integral: ln(2x + 1) + C",
      steps: [
        {
          title: "Integral original",
          title_segments: null,
          expression: "integral(2/(2*x + 1), x)",
          explanation: null,
        },
        {
          title: "Identificando uma substituição",
          title_segments: null,
          expression: "u=2*x + 1",
          explanation: null,
        },
        { title: "Derivando u", title_segments: null, expression: "du=2*dx", explanation: null },
        { title: "Substituindo", title_segments: null, expression: "integral(1/u, u)", explanation: null },
        { title: "Integrando", title_segments: null, expression: "ln(u)", explanation: null },
        {
          title: "Voltando para x",
          title_segments: null,
          expression: "ln((2*x + 1))",
          explanation: null,
        },
        {
          title: "Adicionando a constante de integração",
          title_segments: null,
          expression: "ln(2*x + 1) + C",
          explanation:
            "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C.",
        },
      ],
    });

    const { container } = render(<MathSteps expression="integral(1/(2*x+1)*2, x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(7));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.some((latex) => latex?.includes("\\ln"))).toBe(true);
    expect(annotations.some((latex) => latex?.includes("\\log"))).toBe(false);
  });
});

/**
 * Sprint V2.15 (Passo a Passo — Integração por Partes) — ZERO componente
 * novo (`MathSteps`/`MathStepItem`/`MixedMathText` intocados) e ZERO
 * mudança em `to-latex.ts`: "u=..., dv=...*dx", a fórmula abstrata
 * "integral(u, v)=u*v-integral(v, u)" e "(x - 1)*exp(x) + C" já passam
 * pelo MESMO pipeline `valueToLatex` usado desde a V2.9 — confirmado por
 * debug-render antes de escrever este arquivo, incluindo que o símbolo
 * "v" (novo nesta sprint) NÃO colide com nenhuma unidade embutida do
 * mathjs (diferente de "b"/"C"/"g" em sprints anteriores).
 */
describe("MathSteps — compatibilidade com passos de integração por partes (Sprint V2.15)", () => {
  beforeEach(() => {
    vi.mocked(apiClient.solveSteps).mockReset();
  });

  it("renderiza ∫x·eˣdx com integração por partes em KaTeX", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "integral(x*exp(x), x)",
      result: "Integral: (x - 1)*exp(x) + C",
      steps: [
        {
          title: "Integral original",
          title_segments: null,
          expression: "integral(x*exp(x), x)",
          explanation: null,
        },
        {
          title: "Identificando integração por partes",
          title_segments: null,
          expression: "u=x, dv=exp(x)*dx",
          explanation: null,
        },
        { title: "Derivando u", title_segments: null, expression: "du=dx", explanation: null },
        { title: "Integrando dv", title_segments: null, expression: "v=exp(x)", explanation: null },
        {
          title: "Aplicando a fórmula",
          title_segments: null,
          expression: "integral(u, v)=u*v-integral(v, u)",
          explanation: null,
        },
        {
          title: "Substituindo",
          title_segments: null,
          expression: "integral(x*exp(x), x)=x*exp(x)-integral(exp(x), x)",
          explanation: null,
        },
        {
          title: "Calculando a integral restante",
          title_segments: null,
          expression: "x*exp(x) - exp(x)",
          explanation: null,
        },
        {
          title: "Adicionando a constante de integração",
          title_segments: null,
          expression: "(x - 1)*exp(x) + C",
          explanation:
            "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C.",
        },
      ],
    });

    const { container } = render(<MathSteps expression="integral(x*exp(x), x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(8));
    expect(screen.getByText("Identificando integração por partes")).toBeInTheDocument();
    expect(screen.getByText("Aplicando a fórmula")).toBeInTheDocument();
    expect(screen.getByText("Calculando a integral restante")).toBeInTheDocument();

    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.some((latex) => latex === "u=x,\\;dv=e^{x}\\cdotdx")).toBe(true);
    expect(annotations.some((latex) => latex === "\\intu\\,dv=u\\cdotv-\\intv\\,du")).toBe(true);
    expect(annotations.some((latex) => latex === "\\left(x-1\\right)e^{x}+C")).toBe(true);
  });

  it("renderiza ∫ln(x)dx (implicitamente 1·ln(x)) mostrando \\ln, nunca \\log", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "integral(ln(x), x)",
      result: "Integral: x*ln(x) - x + C",
      steps: [
        {
          title: "Integral original",
          title_segments: null,
          expression: "integral(ln(x), x)",
          explanation: null,
        },
        {
          title: "Identificando integração por partes",
          title_segments: null,
          expression: "u=ln(x), dv=dx",
          explanation: null,
        },
        { title: "Derivando u", title_segments: null, expression: "du=1/x*dx", explanation: null },
        { title: "Integrando dv", title_segments: null, expression: "v=x", explanation: null },
        {
          title: "Aplicando a fórmula",
          title_segments: null,
          expression: "integral(u, v)=u*v-integral(v, u)",
          explanation: null,
        },
        {
          title: "Substituindo",
          title_segments: null,
          expression: "integral(ln(x), x)=ln(x)*x-integral(1, x)",
          explanation: null,
        },
        {
          title: "Calculando a integral restante",
          title_segments: null,
          expression: "x*ln(x) - x",
          explanation: null,
        },
        {
          title: "Adicionando a constante de integração",
          title_segments: null,
          expression: "x*ln(x) - x + C",
          explanation:
            "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C.",
        },
      ],
    });

    const { container } = render(<MathSteps expression="integral(ln(x), x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(8));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.some((latex) => latex?.includes("\\ln"))).toBe(true);
    expect(annotations.some((latex) => latex?.includes("\\log"))).toBe(false);
  });

  it("renderiza ∫x·ln(x)dx (polinômio × logaritmo) em KaTeX", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "integral(x*ln(x), x)",
      result: "Integral: x**2*ln(x)/2 - x**2/4 + C",
      steps: [
        {
          title: "Integral original",
          title_segments: null,
          expression: "integral(x*ln(x), x)",
          explanation: null,
        },
        {
          title: "Identificando integração por partes",
          title_segments: null,
          expression: "u=ln(x), dv=x*dx",
          explanation: null,
        },
        { title: "Derivando u", title_segments: null, expression: "du=1/x*dx", explanation: null },
        {
          title: "Integrando dv",
          title_segments: null,
          expression: "v=x**2/2",
          explanation: null,
        },
        {
          title: "Aplicando a fórmula",
          title_segments: null,
          expression: "integral(u, v)=u*v-integral(v, u)",
          explanation: null,
        },
        {
          title: "Substituindo",
          title_segments: null,
          expression: "integral(x*ln(x), x)=ln(x)*x**2/2-integral(x/2, x)",
          explanation: null,
        },
        {
          title: "Calculando a integral restante",
          title_segments: null,
          expression: "x**2*ln(x)/2 - x**2/4",
          explanation: null,
        },
        {
          title: "Adicionando a constante de integração",
          title_segments: null,
          expression: "x**2*ln(x)/2 - x**2/4 + C",
          explanation:
            "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C.",
        },
      ],
    });

    const { container } = render(<MathSteps expression="integral(x*ln(x), x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(8));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(
      annotations.some((latex) => latex === "\\frac{{x}^{2}\\ln\\left(x\\right)}{2}-\\frac{{x}^{2}}{4}+C")
    ).toBe(true);
  });

  it("mostra erro amigável dedicado quando a integral exige aplicações sucessivas, sem quebrar a tela", async () => {
    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(apiClient.solveSteps).mockRejectedValue(
      new ApiError(
        "invalid_expression",
        "Esta integral requer aplicações sucessivas de integração por partes, que ainda não fazem parte desta versão."
      )
    );

    render(<MathSteps expression="integral(x**2*exp(x), x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Esta integral requer aplicações sucessivas de integração por partes, que ainda não fazem parte desta versão."
        )
      ).toBeInTheDocument()
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

/**
 * Sprint V2.16 (Passo a Passo — Frações Parciais) — ZERO componente novo
 * (`MathSteps`/`MathStepItem`/`MixedMathText` intocados). UMA mudança
 * pontual em `to-latex.ts` (não um componente): "A"/"B" soltos colidem
 * com as unidades embutidas ampere/bel do mathjs (mesmo problema já
 * documentado para "b"/"C"/"g" desde a V2.9.1a/V2.10.1/V2.11), corrigida
 * com a MESMA técnica — devolver o nome cru (com o espaço inicial que o
 * serializer default do mathjs sempre inclui antes de um símbolo comum,
 * necessário pra "A*B" do Motor de Matrizes continuar parseando como
 * LaTeX válido, não "\cdotB"). Confirmado por debug-render ANTES de
 * escrever este arquivo.
 */
describe("MathSteps — compatibilidade com passos de frações parciais (Sprint V2.16)", () => {
  beforeEach(() => {
    vi.mocked(apiClient.solveSteps).mockReset();
  });

  it("renderiza ∫1/((x+1)(x+2))dx com frações parciais em KaTeX (fatores lineares distintos)", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "integral(1/((x+1)*(x+2)), x)",
      result: "Integral: ln(x + 1) - ln(x + 2) + C",
      steps: [
        {
          title: "Integral original",
          title_segments: null,
          expression: "integral(1/((x + 1)*(x + 2)), x)",
          explanation: null,
        },
        {
          title: "Identificando uma função racional",
          title_segments: null,
          expression: "1/((x + 1)*(x + 2))",
          explanation: null,
        },
        {
          title: "Fatorando o denominador",
          title_segments: null,
          expression: "(x + 1)*(x + 2)",
          explanation: null,
        },
        {
          title: "Montando as frações parciais",
          title_segments: null,
          expression: "1/((x + 1)*(x + 2))=A/(x + 1) + B/(x + 2)",
          explanation: null,
        },
        {
          title: "Eliminando os denominadores",
          title_segments: null,
          expression: "1=A*(x + 2)+B*(x + 1)",
          explanation: null,
        },
        {
          title: "Determinando os coeficientes",
          title_segments: null,
          expression: "A=1, B=-1",
          explanation: null,
        },
        {
          title: "Substituindo",
          title_segments: null,
          expression: "1/((x + 1)*(x + 2))=1/(x + 1)-1/(x + 2)",
          explanation: null,
        },
        {
          title: "Separando a integral",
          title_segments: null,
          expression: "integral(1/(x + 1), x)-integral(1/(x + 2), x)",
          explanation: null,
        },
        { title: "Integrando", title_segments: null, expression: "ln(x + 1)-ln(x + 2)", explanation: null },
        {
          title: "Adicionando a constante de integração",
          title_segments: null,
          expression: "ln(x + 1) - ln(x + 2) + C",
          explanation:
            "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C.",
        },
      ],
    });

    const { container } = render(<MathSteps expression="integral(1/((x+1)*(x+2)), x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(10));
    expect(screen.getByText("Identificando uma função racional")).toBeInTheDocument();
    expect(screen.getByText("Montando as frações parciais")).toBeInTheDocument();
    expect(screen.getByText("Determinando os coeficientes")).toBeInTheDocument();

    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(
      annotations.some(
        (latex) =>
          latex ===
          "\\frac{1}{\\left(\\left(x+1\\right)\\cdot\\left(x+2\\right)\\right)}=\\frac{A}{\\left(x+1\\right)}+\\frac{B}{\\left(x+2\\right)}"
      )
    ).toBe(true);
    expect(annotations.some((latex) => latex === "A=1,\\;B=-1")).toBe(true);
    expect(annotations.some((latex) => latex === "\\ln\\left(x+1\\right)-\\ln\\left(x+2\\right)+C")).toBe(
      true
    );
    expect(annotations.some((latex) => latex?.includes("\\mathrm{A}"))).toBe(false);
    expect(annotations.some((latex) => latex?.includes("\\mathrm{B}"))).toBe(false);
  });

  it("renderiza fatores lineares repetidos com TODOS os graus (A/x + B/(x+1) + C/(x+1)²)", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "integral(1/(x*(x+1)**2), x)",
      result: "Integral: ln(x) - ln(x + 1) + 1/(x + 1) + C",
      steps: [
        {
          title: "Integral original",
          title_segments: null,
          expression: "integral(1/(x*(x + 1)**2), x)",
          explanation: null,
        },
        {
          title: "Identificando uma função racional",
          title_segments: null,
          expression: "1/(x*(x + 1)**2)",
          explanation: null,
        },
        {
          title: "Fatorando o denominador",
          title_segments: null,
          expression: "x*(x + 1)**2",
          explanation: null,
        },
        {
          title: "Montando as frações parciais",
          title_segments: null,
          expression: "1/(x*(x + 1)**2)=A/x + B/(x + 1) + C/(x + 1)**2",
          explanation: null,
        },
        {
          title: "Eliminando os denominadores",
          title_segments: null,
          expression: "1=A*(x**2 + 2*x + 1)+B*(x**2 + x)+C*(x)",
          explanation: null,
        },
        {
          title: "Determinando os coeficientes",
          title_segments: null,
          expression: "A=1, B=-1, C=-1",
          explanation: null,
        },
        {
          title: "Substituindo",
          title_segments: null,
          expression: "1/(x*(x + 1)**2)=1/x-1/(x + 1)-1/(x + 1)**2",
          explanation: null,
        },
        {
          title: "Separando a integral",
          title_segments: null,
          expression: "integral(1/x, x)-integral(1/(x + 1), x)-integral(1/(x + 1)**2, x)",
          explanation: null,
        },
        {
          title: "Integrando",
          title_segments: null,
          expression: "ln(x)-ln(x + 1)+1/(x + 1)",
          explanation: null,
        },
        {
          title: "Adicionando a constante de integração",
          title_segments: null,
          expression: "ln(x) - ln(x + 1) + 1/(x + 1) + C",
          explanation:
            "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C.",
        },
      ],
    });

    const { container } = render(<MathSteps expression="integral(1/(x*(x+1)**2), x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(10));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(
      annotations.some(
        (latex) =>
          latex ===
          "\\frac{1}{\\left(x\\cdot{\\left(x+1\\right)}^{2}\\right)}=\\frac{A}{x}+\\frac{B}{\\left(x+1\\right)}+\\frac{C}{{\\left(x+1\\right)}^{2}}"
      )
    ).toBe(true);
    expect(annotations.some((latex) => latex === "A=1,\\;B=-1,\\;C=-1")).toBe(true);
  });

  it("mostra erro amigável genérico para fator irredutível grau >= 3 (fora de escopo), sem quebrar a tela", async () => {
    // Fração imprópria E fator quadrático irredutível ganharam passo a
    // passo próprio na V2.18 (ver `describe` dedicado abaixo) — esta
    // rejeição genérica continua valendo para o que ainda está fora de
    // escopo (fator grau >= 3, múltiplos quadráticos).
    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(apiClient.solveSteps).mockRejectedValue(
      new ApiError(
        "invalid_expression",
        "O passo a passo para este tipo de integral ainda não foi implementado nesta versão."
      )
    );

    render(<MathSteps expression="integral((x**4+1)/((x+1)*(x**3+2)), x)" />);
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
 * Sprint V2.18 (Passo a Passo — Divisão Polinomial + Frações Parciais
 * Avançadas) — ZERO componente novo e ZERO mudança em `to-latex.ts`:
 * confirmado por debug-render antes de escrever este arquivo que
 * "x**2 + 1=(x + 1)*(x - 1)+2" (identidade de divisão) e "A/(x + 1) +
 * (B*x + C)/(x**2 + 1)" (ansatz quadrático) já passam pelo MESMO
 * pipeline `valueToLatex` usado desde a V2.9. "atan(x) + C" renderizava
 * como `\tan^{-1}\left(x\right)` (padrão default do mathjs) até o
 * Hotfix V2.19, que passou a converter `asin`/`acos`/`atan` pra
 * `\operatorname{arcsin}`/`\operatorname{arccos}`/`\operatorname{arctan}`
 * (evita a ambiguidade visual com `1/sin(x)`) — asserções abaixo já
 * atualizadas pra essa notação.
 */
describe("MathSteps — compatibilidade com passos de divisão polinomial e frações parciais avançadas (Sprint V2.18)", () => {
  beforeEach(() => {
    vi.mocked(apiClient.solveSteps).mockReset();
  });

  it("renderiza ∫(x²+1)/(x+1)dx com divisão polinomial em KaTeX (Exemplo 1)", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "integral((x**2+1)/(x+1), x)",
      result: "Integral: x**2/2 - x + 2*ln(x + 1) + C",
      steps: [
        { title: "Integral original", title_segments: null, expression: "integral((x**2 + 1)/(x + 1), x)", explanation: null },
        {
          title: "Identificando uma fração imprópria",
          title_segments: null,
          expression: "(x**2 + 1)/(x + 1)",
          explanation:
            "O grau do numerador (2) é maior ou igual ao grau do denominador (1), então é preciso dividir os polinômios antes de integrar.",
        },
        {
          title: "Dividindo os polinômios",
          title_segments: null,
          expression: "Q=x - 1, R=2",
          explanation: "Q é o quociente e R é o resto da divisão.",
        },
        { title: "Verificando a divisão", title_segments: null, expression: "x**2 + 1=(x + 1)*(x - 1)+2", explanation: null },
        { title: "Reescrevendo a integral", title_segments: null, expression: "(x**2 + 1)/(x + 1)=x - 1+2/(x + 1)", explanation: null },
        { title: "Separando a integral", title_segments: null, expression: "integral(x - 1, x)+integral(2/(x + 1), x)", explanation: null },
        { title: "Integrando", title_segments: null, expression: "x**2/2 - x+2*ln(x + 1)", explanation: null },
        {
          title: "Adicionando a constante de integração",
          title_segments: null,
          expression: "x**2/2 - x + 2*ln(x + 1) + C",
          explanation: "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C.",
        },
      ],
    });

    const { container } = render(<MathSteps expression="integral((x**2+1)/(x+1), x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(8));
    expect(screen.getByText("Identificando uma fração imprópria")).toBeInTheDocument();
    expect(screen.getByText("Verificando a divisão")).toBeInTheDocument();

    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(
      annotations.some((latex) => latex === "{x}^{2}+1=\\left(x+1\\right)\\cdot\\left(x-1\\right)+2")
    ).toBe(true);
    expect(
      annotations.some((latex) => latex === "\\frac{{x}^{2}}{2}-x+2\\ln\\left(x+1\\right)+C")
    ).toBe(true);
  });

  it("renderiza ∫1/((x+1)(x²+1))dx com fator quadrático irredutível em KaTeX (golden example, 11 passos)", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "integral(1/((x+1)*(x**2+1)), x)",
      result: "Integral: ln(x + 1)/2 - ln(x**2 + 1)/4 + atan(x)/2 + C",
      steps: [
        { title: "Integral original", title_segments: null, expression: "integral(1/((x + 1)*(x**2 + 1)), x)", explanation: null },
        { title: "Identificando uma função racional", title_segments: null, expression: "1/((x + 1)*(x**2 + 1))", explanation: null },
        { title: "Fatorando o denominador", title_segments: null, expression: "(x + 1)*(x**2 + 1)", explanation: null },
        {
          title: "Reconhecendo fator quadrático irredutível",
          title_segments: null,
          expression: "x**2 + 1",
          explanation:
            "Este fator não se divide em fatores lineares reais, então seu numerador na decomposição precisa ser da forma B*x+C, nunca só uma constante.",
        },
        {
          title: "Montando as frações parciais",
          title_segments: null,
          expression: "1/((x + 1)*(x**2 + 1))=A/(x + 1) + (B*x + C)/(x**2 + 1)",
          explanation: null,
        },
        { title: "Eliminando os denominadores", title_segments: null, expression: "1=A*(x**2 + 1)+(B*x + C)*(x + 1)", explanation: null },
        { title: "Determinando os coeficientes", title_segments: null, expression: "A=1/2, B=-1/2, C=1/2", explanation: null },
        {
          title: "Substituindo",
          title_segments: null,
          expression: "1/((x + 1)*(x**2 + 1))=(1/2)/(x + 1)+(-x/2+1/2)/(x**2 + 1)",
          explanation: null,
        },
        {
          title: "Separando a integral",
          title_segments: null,
          expression: "integral((1/2)/(x + 1), x)-integral((1/2)*x/(x**2 + 1), x)+integral((1/2)/(x**2 + 1), x)",
          explanation: null,
        },
        { title: "Integrando", title_segments: null, expression: "ln(x + 1)/2-ln(x**2 + 1)/4+atan(x)/2", explanation: null },
        {
          title: "Adicionando a constante de integração",
          title_segments: null,
          expression: "ln(x + 1)/2 - ln(x**2 + 1)/4 + atan(x)/2 + C",
          explanation: "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C.",
        },
      ],
    });

    const { container } = render(<MathSteps expression="integral(1/((x+1)*(x**2+1)), x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(11));
    expect(screen.getByText("Reconhecendo fator quadrático irredutível")).toBeInTheDocument();

    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(
      annotations.some(
        (latex) =>
          latex ===
          "\\frac{1}{\\left(\\left(x+1\\right)\\cdot\\left({x}^{2}+1\\right)\\right)}=\\frac{A}{\\left(x+1\\right)}+\\frac{\\left(B\\cdotx+C\\right)}{\\left({x}^{2}+1\\right)}"
      )
    ).toBe(true);
    expect(
      annotations.some((latex) => latex === "A=\\frac{1}{2},\\;B=\\frac{-1}{2},\\;C=\\frac{1}{2}")
    ).toBe(true);
    expect(
      annotations.some(
        (latex) =>
          latex ===
          "\\frac{\\ln\\left(x+1\\right)}{2}-\\frac{\\ln\\left({x}^{2}+1\\right)}{4}+\\frac{\\operatorname{arctan}\\left(x\\right)}{2}+C"
      )
    ).toBe(true);
    expect(annotations.some((latex) => latex?.includes("\\mathrm{A}"))).toBe(false);
    expect(annotations.some((latex) => latex?.includes("\\mathrm{B}"))).toBe(false);
    expect(annotations.some((latex) => latex?.includes("\\mathrm{C}"))).toBe(false);
  });

  it("mostra erro amigável para forma fora de escopo (fator irredutível grau >= 3), sem quebrar a tela", async () => {
    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(apiClient.solveSteps).mockRejectedValue(
      new ApiError(
        "invalid_expression",
        "O passo a passo para este tipo de integral ainda não foi implementado nesta versão."
      )
    );

    render(<MathSteps expression="integral((x**4+1)/((x+1)*(x**3+2)), x)" />);
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
 * Sprint V2.17 (Passo a Passo — Integrais Trigonométricas) — ZERO
 * componente novo (`MathSteps`/`MathStepItem`/`MixedMathText` intocados)
 * e ZERO mudança em `to-latex.ts`: "sin(x)**3=sin(x)*sin(x)**2",
 * "u=cos(x), du=-sin(x)*dx" e "sec(x)**2-1" já passam pelo MESMO pipeline
 * `valueToLatex` usado desde a V2.9 — confirmado por debug-render antes
 * de escrever este arquivo, incluindo que `sec` (que nem está na
 * whitelist de ENTRADA do parser do backend) já renderiza corretamente
 * como saída via o comando `\sec` nativo do KaTeX, sem nenhuma exceção
 * pontual de símbolo necessária (diferente de "A"/"B"/"b"/"C"/"g" em
 * sprints anteriores).
 */
describe("MathSteps — compatibilidade com passos de integrais trigonométricas (Sprint V2.17)", () => {
  beforeEach(() => {
    vi.mocked(apiClient.solveSteps).mockReset();
  });

  it("renderiza ∫sen²(x)dx com a identidade de redução de potência em KaTeX", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "integral(sin(x)**2, x)",
      result: "Integral: x/2 - sin(x)*cos(x)/2 + C",
      steps: [
        {
          title: "Integral original",
          title_segments: null,
          expression: "integral(sin(x)**2, x)",
          explanation: null,
        },
        {
          title: "Identificando uma potência trigonométrica",
          title_segments: null,
          expression: "sin(x)**2",
          explanation: null,
        },
        {
          title: "Aplicando a identidade de redução de potência",
          title_segments: null,
          expression: "sin(x)**2=(1-cos(2*x))/2",
          explanation: null,
        },
        {
          title: "Substituindo na integral",
          title_segments: null,
          expression: "integral((1-cos(2*x))/2, x)",
          explanation: null,
        },
        {
          title: "Fatorando a constante",
          title_segments: null,
          expression: "1/2*integral(1-cos(2*x), x)",
          explanation: null,
        },
        { title: "Integrando", title_segments: null, expression: "x/2 - sin(2*x)/4", explanation: null },
        {
          title: "Adicionando a constante de integração",
          title_segments: null,
          expression: "x/2 - sin(x)*cos(x)/2 + C",
          explanation:
            "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C.",
        },
      ],
    });

    const { container } = render(<MathSteps expression="integral(sin(x)**2, x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(7));
    expect(screen.getByText("Identificando uma potência trigonométrica")).toBeInTheDocument();
    expect(screen.getByText("Aplicando a identidade de redução de potência")).toBeInTheDocument();

    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(
      annotations.some(
        (latex) => latex === "{\\sin\\left(x\\right)}^{2}=\\frac{\\left(1-\\cos\\left(2\\cdotx\\right)\\right)}{2}"
      )
    ).toBe(true);
    expect(
      annotations.some((latex) => latex === "\\frac{x}{2}-\\frac{\\sin\\left(x\\right)\\cos\\left(x\\right)}{2}+C")
    ).toBe(true);
  });

  it("renderiza ∫sen³(x)dx separando um fator e reutilizando a técnica de substituição", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "integral(sin(x)**3, x)",
      result: "Integral: cos(x)**3/3 - cos(x) + C",
      steps: [
        {
          title: "Integral original",
          title_segments: null,
          expression: "integral(sin(x)**3, x)",
          explanation: null,
        },
        {
          title: "Identificando uma potência ímpar de sin",
          title_segments: null,
          expression: "sin(x)**3",
          explanation: null,
        },
        {
          title: "Separando um fator sin(x)",
          title_segments: null,
          expression: "sin(x)**3=sin(x)*sin(x)**2",
          explanation: null,
        },
        {
          title: "Aplicando sin²(x)=1-cos²(x)",
          title_segments: null,
          expression: "sin(x)**2=1-cos(x)**2",
          explanation: null,
        },
        {
          title: "Reescrevendo a integral",
          title_segments: null,
          expression: "integral((1 - cos(x)**2)*sin(x), x)",
          explanation: null,
        },
        {
          title: "Aplicando a substituição",
          title_segments: null,
          expression: "u=cos(x), du=-sin(x)*dx",
          explanation: null,
        },
        { title: "Integrando", title_segments: null, expression: "u**3/3 - u", explanation: null },
        {
          title: "Voltando para x",
          title_segments: null,
          expression: "(cos(x))**3/3 - (cos(x))",
          explanation: null,
        },
        {
          title: "Adicionando a constante de integração",
          title_segments: null,
          expression: "cos(x)**3/3 - cos(x) + C",
          explanation:
            "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C.",
        },
      ],
    });

    const { container } = render(<MathSteps expression="integral(sin(x)**3, x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(9));
    expect(screen.getByText("Separando um fator sin(x)")).toBeInTheDocument();
    expect(screen.getByText("Aplicando a substituição")).toBeInTheDocument();
    expect(screen.getByText("Voltando para x")).toBeInTheDocument();

    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(
      annotations.some((latex) => latex === "u=\\cos\\left(x\\right),\\;du=-\\sin\\left(x\\right)\\cdotdx")
    ).toBe(true);
    expect(
      annotations.some(
        (latex) => latex === "\\frac{{\\cos\\left(x\\right)}^{3}}{3}-\\cos\\left(x\\right)+C"
      )
    ).toBe(true);
  });

  it("renderiza ∫sen²(x)cos²(x)dx (teste ouro: ângulo duplo + redução de potência)", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "integral(sin(x)**2*cos(x)**2, x)",
      result: "Integral: x/8 - sin(2*x)*cos(2*x)/16 + C",
      steps: [
        {
          title: "Integral original",
          title_segments: null,
          expression: "integral(sin(x)**2*cos(x)**2, x)",
          explanation: null,
        },
        {
          title: "Identificando potências pares de seno e cosseno",
          title_segments: null,
          expression: "sin(x)**2*cos(x)**2",
          explanation: null,
        },
        {
          title: "Utilizando a identidade de ângulo duplo",
          title_segments: null,
          expression: "sin(x)*cos(x)=sin(2*x)/2",
          explanation: null,
        },
        {
          title: "Elevando ao quadrado",
          title_segments: null,
          expression: "sin(x)**2*cos(x)**2=sin(2*x)**2/4",
          explanation: null,
        },
        {
          title: "Aplicando redução de potência",
          title_segments: null,
          expression: "sin(2*x)**2=(1-cos(4*x))/2",
          explanation: null,
        },
        {
          title: "Reescrevendo",
          title_segments: null,
          expression: "sin(x)**2*cos(x)**2=(1-cos(4*x))/8",
          explanation: null,
        },
        {
          title: "Substituindo na integral",
          title_segments: null,
          expression: "integral((1-cos(4*x))/8, x)",
          explanation: null,
        },
        {
          title: "Integrando",
          title_segments: null,
          expression: "x/8 - sin(4*x)/32",
          explanation: null,
        },
        {
          title: "Adicionando a constante de integração",
          title_segments: null,
          expression: "x/8 - sin(2*x)*cos(2*x)/16 + C",
          explanation:
            "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C.",
        },
      ],
    });

    const { container } = render(<MathSteps expression="integral(sin(x)**2*cos(x)**2, x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(9));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(
      annotations.some((latex) => latex === "\\sin\\left(x\\right)\\cos\\left(x\\right)=\\frac{\\sin\\left(2\\cdotx\\right)}{2}")
    ).toBe(true);
    expect(
      annotations.some(
        (latex) => latex === "\\frac{x}{8}-\\frac{\\sin\\left(2\\cdotx\\right)\\cos\\left(2\\cdotx\\right)}{16}+C"
      )
    ).toBe(true);
  });

  it("renderiza ∫tan²(x)dx com a identidade tan²(x)=sec²(x)-1, sec renderizando corretamente", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "integral(tan(x)**2, x)",
      result: "Integral: -x + sin(x)/cos(x) + C",
      steps: [
        {
          title: "Integral original",
          title_segments: null,
          expression: "integral(tan(x)**2, x)",
          explanation: null,
        },
        {
          title: "Identificando uma potência de tangente",
          title_segments: null,
          expression: "tan(x)**2",
          explanation: null,
        },
        {
          title: "Aplicando tan²(x)=sec²(x)-1",
          title_segments: null,
          expression: "tan(x)**2=sec(x)**2-1",
          explanation: null,
        },
        {
          title: "Substituindo na integral",
          title_segments: null,
          expression: "integral(sec(x)**2-1, x)",
          explanation: null,
        },
        {
          title: "Separando a integral",
          title_segments: null,
          expression: "integral(sec(x)**2, x)-integral(1, x)",
          explanation: null,
        },
        {
          title: "Integrando",
          title_segments: null,
          expression: "-x + sin(x)/cos(x)",
          explanation: null,
        },
        {
          title: "Adicionando a constante de integração",
          title_segments: null,
          expression: "-x + sin(x)/cos(x) + C",
          explanation:
            "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C.",
        },
      ],
    });

    const { container } = render(<MathSteps expression="integral(tan(x)**2, x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(7));
    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(
      annotations.some((latex) => latex === "{\\tan\\left(x\\right)}^{2}={\\sec\\left(x\\right)}^{2}-1")
    ).toBe(true);
    expect(annotations.some((latex) => latex?.includes("\\sec"))).toBe(true);
  });

  it("mostra erro amigável para formas fora do escopo (ex. tan³(x)), sem quebrar a tela", async () => {
    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(apiClient.solveSteps).mockRejectedValue(
      new ApiError(
        "invalid_expression",
        "O passo a passo para este tipo de integral ainda não foi implementado nesta versão."
      )
    );

    render(<MathSteps expression="integral(tan(x)**3, x)" />);
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
 * Sprint V2.19 (Passo a Passo — Substituição Trigonométrica) — ZERO
 * componente novo (`MathSteps`/`MathStepItem`/`MixedMathText` intocados).
 * "theta" (usado como LADO INTEIRO de uma equação no passo "Voltando
 * para x", ex. "theta=asin(x/3)") precisou da MESMA exceção pontual ao
 * guard `BARE_WORD` que "Delta" já tinha desde a V2.9.1
 * (`NAMED_SYMBOL_LATEX` em `to-latex.ts`) — confirmado por debug-render
 * ANTES do código que, sem essa entrada, "theta" sozinho (ou como lado
 * esquerdo de uma equação) devolvia `null` e quebrava a renderização do
 * passo inteiro. Todas as outras strings novas (θ embutido em
 * sen/cos/tan/sec, identidades) já passavam pelo pipeline `valueToLatex`
 * existente, confirmado por debug-render.
 *
 * Hotfix V2.19 (dθ + arco-seno) corrigiu duas apresentações NESTE mesmo
 * fluxo (asserções abaixo já atualizadas): "dtheta" (o passo "Calculando
 * dx") virou "d\theta" em vez de texto romano cru; `asin`/`acos`/`atan`
 * (resultado real do motor) viram `\operatorname{arcsin}`/
 * `\operatorname{arccos}`/`\operatorname{arctan}` em vez de
 * `\sin^{-1}`/`\cos^{-1}`/`\tan^{-1}` (ambíguo com `1/sen(x)`).
 *
 * Hotfix V2.19.1 corrigiu um `\cdot` cru aparecendo em vermelho no passo
 * "Calculando dx": a primeira versão de "d\theta" (Hotfix V2.19) não
 * tinha o espaço inicial que o mathjs sempre prepende a um símbolo comum
 * — concatenado logo depois de "\cdot" (sem passar por
 * `omitsMultiplicationDot`), virava "\cdotd\theta", um control WORD que o
 * LaTeX lê como UM comando desconhecido. A prova de verdade abaixo é a
 * ausência de `.katex-error` no container (a mesma classe CSS que
 * aparecia vermelha no navegador) — comparação de STRING com whitespace
 * removido não distingue a versão com/sem o espaço, é exatamente como o
 * bug escapou da primeira rodada de testes.
 */
describe("MathSteps — compatibilidade com passos de substituição trigonométrica (Sprint V2.19)", () => {
  beforeEach(() => {
    vi.mocked(apiClient.solveSteps).mockReset();
  });

  it("renderiza ∫√(9-x²)dx com substituição x=3sen(θ) em KaTeX (forma direta, reaproveita a identidade da V2.17)", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "integral(sqrt(9-x**2), x)",
      result: "Integral: x*sqrt(9 - x**2)/2 + 9*asin(x/3)/2 + C",
      steps: [
        { title: "Integral original", title_segments: null, expression: "integral(sqrt(9 - x**2), x)", explanation: null },
        { title: "Identificando o padrão", title_segments: null, expression: "9 - x**2", explanation: "O radical tem a forma √(a²-x²)." },
        { title: "Encontrando a", title_segments: null, expression: "a**2=9, a=3", explanation: null },
        { title: "Escolhendo a substituição", title_segments: null, expression: "x=3*sin(theta)", explanation: null },
        { title: "Calculando dx", title_segments: null, expression: "dx=3*cos(theta)*dtheta", explanation: null },
        { title: "Substituindo no radical", title_segments: null, expression: "sqrt(9 - x**2)=sqrt(9 - 9*sin(theta)**2)", explanation: null },
        { title: "Fatorando", title_segments: null, expression: "sqrt(9 - 9*sin(theta)**2)=3*sqrt(1 - sin(theta)**2)", explanation: null },
        { title: "Usando a identidade pitagórica", title_segments: null, expression: "1-sin(theta)**2=cos(theta)**2", explanation: null },
        {
          title: "Considerando o intervalo escolhido",
          title_segments: null,
          expression: "sqrt(cos(theta)**2)=cos(theta)",
          explanation: "Escolhemos theta em [-π/2, π/2], onde cos(theta) ≥ 0.",
        },
        { title: "Concluindo a substituição do radical", title_segments: null, expression: "sqrt(9 - x**2)=3*cos(theta)", explanation: null },
        { title: "Substituindo na integral", title_segments: null, expression: "integral(sqrt(9 - x**2), x)=9*integral(cos(theta)**2, theta)", explanation: null },
        { title: "Aplicando a identidade de redução de potência", title_segments: null, expression: "cos(theta)**2=(1+cos(2*theta))/2", explanation: null },
        { title: "Integrando em θ", title_segments: null, expression: "9*theta/2 + 9*sin(theta)*cos(theta)/2", explanation: null },
        { title: "Voltando para x", title_segments: null, expression: "x*sqrt(9 - x**2)/2 + 9*asin(x/3)/2", explanation: null },
        {
          title: "Adicionando a constante de integração",
          title_segments: null,
          expression: "x*sqrt(9 - x**2)/2 + 9*asin(x/3)/2 + C",
          explanation: "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C.",
        },
      ],
    });

    const { container } = render(<MathSteps expression="integral(sqrt(9-x**2), x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(15));
    expect(screen.getByText("Identificando o padrão")).toBeInTheDocument();
    expect(screen.getByText("Considerando o intervalo escolhido")).toBeInTheDocument();

    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.some((latex) => latex === "x=3\\sin\\left(\\theta\\right)")).toBe(true);
    expect(annotations.some((latex) => latex === "\\sqrt{{\\cos\\left(\\theta\\right)}^{2}}=\\cos\\left(\\theta\\right)")).toBe(
      true
    );
    expect(
      annotations.some(
        (latex) =>
          latex ===
          "\\frac{x\\cdot\\sqrt{9-{x}^{2}}}{2}+\\frac{9\\operatorname{arcsin}\\left(\\frac{x}{3}\\right)}{2}+C"
      )
    ).toBe(true);
    expect(annotations.some((latex) => latex === "dx=3\\cos\\left(\\theta\\right)\\cdotd\\theta")).toBe(true);
    expect(annotations.some((latex) => latex?.includes("dtheta"))).toBe(false);
    expect(annotations.some((latex) => latex?.includes("\\mathrm"))).toBe(false);
    expect(annotations.some((latex) => latex?.includes("^{-1}"))).toBe(false);
    // Hotfix V2.19.1 — o "\cdotd\theta" acima é a string com o
    // WHITESPACE já removido pelo próprio helper de comparação
    // (`.replace(/\s/g, "")`) — não distingue a versão COM o espaço
    // (correta) da versão SEM (o bug real, "\cdot" mesclando com "d" num
    // comando desconhecido). A prova de verdade é `throwOnError:false`
    // do KaTeX nunca produzir um span de erro visível — checado
    // diretamente aqui, é exatamente essa classe CSS que aparecia em
    // vermelho no navegador antes da correção.
    expect(container.querySelector(".katex-error")).toBeNull();
  });

  it("renderiza ∫1/√(9-x²)dx simplificando até θ+C (teste ouro, sem precisar da identidade de redução de potência)", async () => {
    vi.mocked(apiClient.solveSteps).mockResolvedValue({
      expression: "integral(1/sqrt(9-x**2), x)",
      result: "Integral: asin(x/3) + C",
      steps: [
        { title: "Integral original", title_segments: null, expression: "integral(1/sqrt(9 - x**2), x)", explanation: null },
        { title: "Identificando o padrão", title_segments: null, expression: "9 - x**2", explanation: null },
        { title: "Encontrando a", title_segments: null, expression: "a**2=9, a=3", explanation: null },
        { title: "Escolhendo a substituição", title_segments: null, expression: "x=3*sin(theta)", explanation: null },
        { title: "Calculando dx", title_segments: null, expression: "dx=3*cos(theta)*dtheta", explanation: null },
        { title: "Substituindo no radical", title_segments: null, expression: "sqrt(9 - x**2)=sqrt(9 - 9*sin(theta)**2)", explanation: null },
        { title: "Fatorando", title_segments: null, expression: "sqrt(9 - 9*sin(theta)**2)=3*sqrt(1 - sin(theta)**2)", explanation: null },
        { title: "Usando a identidade pitagórica", title_segments: null, expression: "1-sin(theta)**2=cos(theta)**2", explanation: null },
        { title: "Considerando o intervalo escolhido", title_segments: null, expression: "sqrt(cos(theta)**2)=cos(theta)", explanation: null },
        { title: "Concluindo a substituição do radical", title_segments: null, expression: "sqrt(9 - x**2)=3*cos(theta)", explanation: null },
        { title: "Substituindo na integral", title_segments: null, expression: "integral(1/sqrt(9 - x**2), x)=integral(1, theta)", explanation: null },
        { title: "Integrando em θ", title_segments: null, expression: "theta", explanation: null },
        { title: "Voltando para x", title_segments: null, expression: "asin(x/3)", explanation: null },
        {
          title: "Adicionando a constante de integração",
          title_segments: null,
          expression: "asin(x/3) + C",
          explanation: "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C.",
        },
      ],
    });

    const { container } = render(<MathSteps expression="integral(1/sqrt(9-x**2), x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(14));
    const titles = Array.from(container.querySelectorAll("h3, [class*='title']")).map((n) => n.textContent);
    expect(titles.join(" ")).not.toContain("Aplicando a identidade de redução de potência");

    const annotations = Array.from(container.querySelectorAll("annotation")).map((node) =>
      node.textContent?.replace(/\s/g, "")
    );
    expect(annotations.some((latex) => latex === "\\theta")).toBe(true);
    expect(
      annotations.some((latex) => latex === "\\operatorname{arcsin}\\left(\\frac{x}{3}\\right)+C")
    ).toBe(true);
    expect(annotations.some((latex) => latex?.includes("dtheta"))).toBe(false);
    expect(annotations.some((latex) => latex === "dx=3\\cos\\left(\\theta\\right)\\cdotd\\theta")).toBe(true);
    // Hotfix V2.19.1 — ver comentário equivalente no teste do caso direto
    // acima: a prova real é a ausência de um span de erro do KaTeX.
    expect(container.querySelector(".katex-error")).toBeNull();
  });

  it("mostra erro amigável genérico para forma fora de escopo (√(x²+4) sem o 1/, levaria a sec³(θ)), sem quebrar a tela", async () => {
    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(apiClient.solveSteps).mockRejectedValue(
      new ApiError(
        "invalid_expression",
        "O passo a passo para este tipo de integral ainda não foi implementado nesta versão."
      )
    );

    render(<MathSteps expression="integral(sqrt(x**2+4), x)" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));

    await waitFor(() =>
      expect(
        screen.getByText("O passo a passo para este tipo de integral ainda não foi implementado nesta versão.")
      ).toBeInTheDocument()
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
