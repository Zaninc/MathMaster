import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  apiClient: { solve: vi.fn() },
}));

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { inputToLatex, resultToLatex } from "@/lib/math/to-latex";

import { QuickCalculator } from "./QuickCalculator";

function solve(expression: string) {
  fireEvent.change(screen.getByLabelText("Expressão matemática"), { target: { value: expression } });
  fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));
}

describe("QuickCalculator", () => {
  beforeAll(async () => {
    // Aquece o dynamic import do mathjs para o waitFor de KaTeX abaixo ser confiável.
    await inputToLatex("x");
  });

  afterEach(() => {
    vi.mocked(apiClient.solve).mockReset();
  });

  it("resolve uma expressão com sucesso e mostra o resultado", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({ expression: "2+2", result: "4", approx: null });
    render(<QuickCalculator />);

    fireEvent.change(screen.getByLabelText("Expressão matemática"), { target: { value: "2+2" } });
    fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

    expect(await screen.findByText("4")).toBeInTheDocument();
  });

  it("mostra a mensagem amigável de erro quando o backend rejeita a expressão", async () => {
    vi.mocked(apiClient.solve).mockRejectedValue(
      new ApiError("invalid_expression", "Não foi possível interpretar a expressão: @@@")
    );
    render(<QuickCalculator />);

    fireEvent.change(screen.getByLabelText("Expressão matemática"), { target: { value: "@@@" } });
    fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

    expect(await screen.findByText("Não foi possível interpretar a expressão: @@@")).toBeInTheDocument();
  });

  it("preenche o campo ao clicar em um exemplo, sem enviar automaticamente", () => {
    render(<QuickCalculator />);

    fireEvent.click(screen.getByRole("button", { name: /preencher exemplo: x² - 4 = 0/i }));

    expect(screen.getByLabelText("Expressão matemática")).toHaveValue("x² - 4 = 0");
    expect(apiClient.solve).not.toHaveBeenCalled();
  });

  it("preenche o campo ao clicar em um atalho de categoria", () => {
    render(<QuickCalculator />);

    fireEvent.click(screen.getByRole("button", { name: /preencher exemplo de derivada/i }));

    expect(screen.getByLabelText("Expressão matemática")).toHaveValue("d/dx(x²)");
  });

  it("desabilita o botão Resolver quando o campo está vazio", () => {
    render(<QuickCalculator />);
    expect(screen.getByRole("button", { name: /^resolver$/i })).toBeDisabled();
  });

  it("renderiza os exemplos com KaTeX, mesmo componente compartilhado com a Calculadora", async () => {
    const { container } = render(<QuickCalculator />);

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull(), { timeout: 2000 });
    expect(
      Array.from(container.querySelectorAll("annotation")).some((node) =>
        node.textContent?.includes(String.raw`\frac{d}{dx}`)
      )
    ).toBe(true);
  });

  it("clicar num exemplo renderizado via KaTeX ainda preenche a expressão exata (não o LaTeX)", async () => {
    const { container } = render(<QuickCalculator />);

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull(), { timeout: 2000 });
    fireEvent.click(screen.getByRole("button", { name: /preencher exemplo: d\/dx\(x² \+ 3x\)/i }));

    expect(screen.getByLabelText("Expressão matemática")).toHaveValue("d/dx(x² + 3x)");
  });

  it("Sprint V2.4 (Sistemas Lineares): exemplo 'x+y=5; x-y=1' preenche o campo (';' sobrevive num input de uma linha, '\\n' não)", () => {
    render(<QuickCalculator />);

    fireEvent.click(screen.getByRole("button", { name: "Preencher exemplo: x+y=5; x-y=1" }));

    expect(screen.getByLabelText("Expressão matemática")).toHaveValue("x+y=5; x-y=1");
  });

  it("Sprint V2.5 (Sistemas Polinomiais Não Lineares): exemplo 'x²+y=5; x-y=1' preenche o campo", () => {
    render(<QuickCalculator />);

    fireEvent.click(screen.getByRole("button", { name: "Preencher exemplo: x²+y=5; x-y=1" }));

    expect(screen.getByLabelText("Expressão matemática")).toHaveValue("x²+y=5; x-y=1");
  });
});

/**
 * Correção de consistência visual (pós-Sprint V2.3): o card de resultado
 * renderizava `{result}` cru — agora reaproveita `useSolveLatex`/
 * `ProgressiveMathResult`, a MESMA infraestrutura de
 * `components/calculator/ResultPanel.tsx` (ver `ResultPanel.test.tsx`
 * para os testes equivalentes de referência, mesmo padrão de asserção via
 * `annotation` do MathML do KaTeX).
 */
describe("QuickCalculator — resultado em KaTeX (correção pós-Sprint V2.3)", () => {
  afterEach(() => {
    vi.mocked(apiClient.solve).mockReset();
  });

  function annotationsOf(container: HTMLElement): (string | null)[] {
    return Array.from(container.querySelectorAll("annotation")).map((node) => node.textContent);
  }

  it("1. resultado de equação renderizado em KaTeX (subscritos de solução)", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({
      expression: "x² - 4 = 0",
      result: "x₁ = -2, x₂ = 2",
      approx: null,
    });
    const { container } = render(<QuickCalculator />);
    solve("x² - 4 = 0");

    await waitFor(() => expect(annotationsOf(container).some((latex) => latex?.includes("x_{1}"))).toBe(true));
  });

  it("2. resultado de matriz (transpose) renderizado como \\begin{bmatrix}", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({
      expression: "transpose([[1,2,3],[4,5,6]])",
      result: "[[1, 4], [2, 5], [3, 6]]",
      approx: null,
    });
    const { container } = render(<QuickCalculator />);
    solve("transpose([[1,2,3],[4,5,6]])");

    await waitFor(() =>
      expect(annotationsOf(container).some((latex) => latex?.includes("\\begin{bmatrix}"))).toBe(true)
    );
  });

  it("3. frações em matriz (inv) renderizadas como \\frac", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({
      expression: "inv([[2,0],[0,2]])",
      result: "[[1/2, 0], [0, 1/2]]",
      approx: null,
    });
    const { container } = render(<QuickCalculator />);
    solve("inv([[2,0],[0,2]])");

    await waitFor(() =>
      expect(annotationsOf(container).some((latex) => latex?.includes("\\frac{1}{2}"))).toBe(true)
    );
    expect(annotationsOf(container).some((latex) => latex?.includes("\\begin{bmatrix}"))).toBe(true);
  });

  it("4. argumento complexo renderizado como \\frac{\\pi}{4}", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({
      expression: "argumento(1+i)",
      result: "π/4",
      approx: null,
    });
    const { container } = render(<QuickCalculator />);
    solve("argumento(1+i)");

    await waitFor(() =>
      expect(annotationsOf(container).some((latex) => latex?.includes("\\frac{\\pi}{4}"))).toBe(true)
    );
  });

  it("5. forma polar renderizada com raiz, cosseno, seno e unidade imaginária", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({
      expression: "polar(1+i)",
      result: "√2(cos(π/4)+i·sin(π/4))",
      approx: null,
    });
    const { container } = render(<QuickCalculator />);
    solve("polar(1+i)");

    await waitFor(() => expect(annotationsOf(container).some((latex) => latex?.includes("\\sqrt"))).toBe(true));
    const polar = annotationsOf(container).find((latex) => latex?.includes("\\sqrt"));
    expect(polar).toContain("\\cos");
    expect(polar).toContain("\\sin");
  });

  it("6. resultado de somatório renderizado em KaTeX", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({
      expression: "Σ(i=1..10) i",
      result: "55",
      approx: null,
    });
    const { container } = render(<QuickCalculator />);
    solve("Σ(i=1..10) i");

    await waitFor(() => expect(annotationsOf(container).some((latex) => latex === "55")).toBe(true));
  });

  it("7. resultado de número complexo renderizado em KaTeX", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({
      expression: "(2+i)(3-i)",
      result: "7 + i",
      approx: null,
    });
    const { container } = render(<QuickCalculator />);
    solve("(2+i)(3-i)");

    await waitFor(() => expect(annotationsOf(container).some((latex) => latex === "7+ i")).toBe(true));
  });

  it("8. fallback seguro: resultado sem forma reconhecida vira texto puro, sem lançar e sem KaTeX inválido", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({
      expression: "relacao_retas([(0,0),(1,0)],[(0,0),(0,1)])",
      result: "Relação entre as retas: Perpendiculares ⊥",
      approx: null,
    });
    render(<QuickCalculator />);
    solve("relacao_retas([(0,0),(1,0)],[(0,0),(0,1)])");

    expect(await screen.findByText("Relação entre as retas: Perpendiculares ⊥")).toBeInTheDocument();
  });

  it("9. nenhuma regressão: erro do backend continua mostrando a mensagem amigável em texto", async () => {
    vi.mocked(apiClient.solve).mockRejectedValue(
      new ApiError("invalid_expression", "Não foi possível interpretar a expressão: @@@")
    );
    render(<QuickCalculator />);
    solve("@@@");

    expect(await screen.findByText("Não foi possível interpretar a expressão: @@@")).toBeInTheDocument();
  });

  it("11. resultado de sistema linear (Sprint V2.4) renderizado em KaTeX", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({
      expression: "x+y=5; x-y=1",
      result: "x = 3, y = 2",
      approx: null,
    });
    const { container } = render(<QuickCalculator />);
    solve("x+y=5; x-y=1");

    await waitFor(() =>
      expect(annotationsOf(container).some((latex) => latex?.replace(/\s/g, "").includes("x=3"))).toBe(true)
    );
    expect(
      annotationsOf(container).some((latex) => latex?.replace(/\s/g, "").includes("y=2"))
    ).toBe(true);
  });

  it("12. resultado de sistema não linear com múltiplas soluções (Sprint V2.5) renderizado em KaTeX, unidas por ' ou '", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({
      expression: "x²+y=5; x-y=1",
      result: "x = -3, y = -4 ou x = 2, y = 1",
      approx: null,
    });
    const { container } = render(<QuickCalculator />);
    solve("x²+y=5; x-y=1");

    await waitFor(() =>
      expect(annotationsOf(container).some((latex) => latex?.includes("\\text{ou}"))).toBe(true)
    );
  });

  it("10. reaproveita a pipeline compartilhada de lib/math/to-latex — mesma saída de resultToLatex direto, sem conversor paralelo", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({
      expression: "(2+i)(3-i)",
      result: "7 + i",
      approx: null,
    });
    const { container } = render(<QuickCalculator />);
    solve("(2+i)(3-i)");

    const expectedSegments = await resultToLatex("7 + i");
    expect(expectedSegments).not.toBeNull();
    const expectedLatex = expectedSegments![0].latex;

    await waitFor(() => expect(annotationsOf(container).some((latex) => latex === expectedLatex)).toBe(true));
  });
});

/**
 * Ajuste de layout (card cortando matrizes 2x2 no card verde): o card de
 * resultado nunca deve ter uma classe de altura FIXA nem `overflow-y-hidden`
 * própria — precisa crescer com `height: auto` conforme o conteúdo KaTeX
 * real (matrizes, frações). `MathFormula`/`ProgressiveMathResult` (não
 * tocados) já cuidam do `overflow-x-auto` horizontal por conta própria.
 */
describe("QuickCalculator — layout do card de resultado (correção de corte vertical)", () => {
  afterEach(() => {
    vi.mocked(apiClient.solve).mockReset();
  });

  function resultCard(container: HTMLElement): HTMLElement {
    const label = Array.from(container.querySelectorAll("span")).find(
      (node) => node.textContent === "Resultado"
    );
    const card = label?.parentElement;
    expect(card, "card de resultado não encontrado").toBeTruthy();
    return card as HTMLElement;
  }

  /** Classe Tailwind de altura FIXA (ex. "h-16") — exclui "min-h-*"/"max-h-*", que são o oposto do que este teste proíbe. */
  function hasFixedHeightClass(element: HTMLElement): boolean {
    return element.className.split(/\s+/).some((token) => /^h-\d/.test(token));
  }

  it("o card não tem altura fixa nem overflow-y-hidden própria (cresce com o conteúdo naturalmente)", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({
      expression: "inv([[2,0],[0,2]])",
      result: "[[1/2, 0], [0, 1/2]]",
      approx: null,
    });
    const { container } = render(<QuickCalculator />);
    solve("inv([[2,0],[0,2]])");

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());
    const card = resultCard(container);

    expect(hasFixedHeightClass(card)).toBe(false);
    expect(card.className).not.toMatch(/\bmax-h-/);
    expect(card.className).not.toMatch(/overflow-y-hidden/);
  });

  it("o wrapper do KaTeX (MathFormula, componente compartilhado) nunca tem overflow-y-hidden", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({
      expression: "inv([[2,0],[0,2]])",
      result: "[[1/2, 0], [0, 1/2]]",
      approx: null,
    });
    const { container } = render(<QuickCalculator />);
    solve("inv([[2,0],[0,2]])");

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());
    // Escopado ao card de resultado (não aos exemplos, cujo KaTeX é modo
    // "plain" — sem wrapper de overflow nenhum, por design; ver `MathFormula.tsx`).
    const card = resultCard(container);
    const katexWrappers = Array.from(card.querySelectorAll(".katex")).map(
      (node) => node.parentElement?.parentElement
    );
    expect(katexWrappers.length).toBeGreaterThan(0);
    for (const wrapper of katexWrappers) {
      expect(wrapper?.className).not.toMatch(/overflow-y-hidden/);
      expect(wrapper?.className).toContain("overflow-x-auto");
    }
  });

  it("matriz 2x2 com frações (inv) renderiza sem nenhum nó KaTeX truncado/ausente", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({
      expression: "inv([[2,0],[0,2]])",
      result: "[[1/2, 0], [0, 1/2]]",
      approx: null,
    });
    const { container } = render(<QuickCalculator />);
    solve("inv([[2,0],[0,2]])");

    await waitFor(() =>
      expect(
        Array.from(container.querySelectorAll("annotation")).some((node) =>
          node.textContent?.includes("\\begin{bmatrix}")
        )
      ).toBe(true)
    );
    // O mtable (linhas/colunas reais da matriz) tem que estar presente no
    // HTML renderizado — não só na anotação MathML crua.
    expect(container.querySelector(".katex .mtable")).not.toBeNull();
  });

  it("multiplicação de matrizes 2x2 (resultado maior) também renderiza o mtable completo", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({
      expression: "[[1,2],[3,4]]*[[5,6],[7,8]]",
      result: "[[19, 22], [43, 50]]",
      approx: null,
    });
    const { container } = render(<QuickCalculator />);
    solve("[[1,2],[3,4]]*[[5,6],[7,8]]");

    await waitFor(() => expect(container.querySelector(".katex .mtable")).not.toBeNull());
  });

  it("matriz 3x2 (transpose) continua funcionando normalmente (não regride)", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({
      expression: "transpose([[1,2,3],[4,5,6]])",
      result: "[[1, 4], [2, 5], [3, 6]]",
      approx: null,
    });
    const { container } = render(<QuickCalculator />);
    solve("transpose([[1,2,3],[4,5,6]])");

    await waitFor(() => expect(container.querySelector(".katex .mtable")).not.toBeNull());
  });

  it("resultado simples (somatório) continua compacto: sem leading/padding extra vazando classes de altura fixa", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({
      expression: "Σ(i=1..10) i",
      result: "55",
      approx: null,
    });
    const { container } = render(<QuickCalculator />);
    solve("Σ(i=1..10) i");

    await waitFor(() => expect(annotationsOf(container).some((latex) => latex === "55")).toBe(true));
    const card = resultCard(container);
    expect(hasFixedHeightClass(card)).toBe(false);
    expect(card.className).not.toMatch(/overflow-y-hidden/);
  });

  it("forma polar (raiz + trig + i) renderiza sem cortar nenhum símbolo", async () => {
    vi.mocked(apiClient.solve).mockResolvedValue({
      expression: "polar(1+i)",
      result: "√2(cos(π/4)+i·sin(π/4))",
      approx: null,
    });
    const { container } = render(<QuickCalculator />);
    solve("polar(1+i)");

    await waitFor(() => expect(container.querySelector(".katex .sqrt")).not.toBeNull());
  });

  function annotationsOf(container: HTMLElement): (string | null)[] {
    return Array.from(container.querySelectorAll("annotation")).map((node) => node.textContent);
  }
});
