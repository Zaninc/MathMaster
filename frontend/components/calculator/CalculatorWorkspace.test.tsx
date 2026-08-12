import { StrictMode } from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const searchParamsMock = vi.fn(() => new URLSearchParams());
const routerReplaceMock = vi.fn();
const routerPushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock(),
  useRouter: () => ({ push: routerPushMock, replace: routerReplaceMock }),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: { solve: vi.fn(), getHistory: vi.fn() },
}));

/**
 * `mathlive` real resolve, sob Vitest/Node, pra sua build "SSR-safe"
 * (inerte por design — ver `StructuredMathInput.test.tsx`). Mesmo mock
 * mínimo reaproveitado aqui: só a superfície que `StructuredMathInput`
 * realmente usa.
 */
vi.mock("mathlive", () => {
  class MockMathfieldElement extends HTMLElement {
    private _value = "";
    mathVirtualKeyboardPolicy = "auto";
    smartFence = false;
    smartSuperscript = false;

    get value() {
      return this._value;
    }

    set value(v: string) {
      this._value = v;
    }

    insert(latex: string) {
      this._value += latex;
      this.dispatchEvent(new Event("input"));
      return true;
    }

    // Hotfix V3.0.2a — `StructuredMathInput`'s `handleInput` chama
    // `setValue`/`executeCommand` quando detecta um pulo de ambiente
    // (ver `StructuredMathInput.test.tsx` pros testes dedicados a esse
    // comportamento); mockados aqui só pra este arquivo não quebrar caso
    // algum teste futuro dispare o caminho de reparo — nenhum teste
    // EXISTENTE aqui produz LaTeX malformado, então nunca são chamados na
    // prática hoje.
    setValue(value: string) {
      this._value = value;
    }

    executeCommand() {
      return true;
    }
  }
  if (!customElements.get("math-field")) {
    customElements.define("math-field", MockMathfieldElement);
  }
  return {};
});

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { previewLatex } from "@/lib/math/to-latex";

import { CalculatorWorkspace } from "./CalculatorWorkspace";

/**
 * `StructuredMathInputLoader` é `next/dynamic(..., {ssr:false})` — o
 * `<math-field>` real só existe depois que o import dinâmico resolve
 * (mostra "Carregando editor..." antes disso). Todo teste que interage
 * com o campo precisa esperar por ele primeiro.
 */
async function getField(container: HTMLElement): Promise<HTMLElement & { value: string }> {
  await waitFor(() => expect(container.querySelector("math-field")).not.toBeNull());
  return container.querySelector("math-field") as HTMLElement & { value: string };
}

/**
 * Simula "o usuário deixou o campo com este LaTeX" — dispara `input` como
 * o campo real faria. `fireEvent` (não `field.dispatchEvent` cru) garante
 * que o `setState` disparado por `handleInput` seja processado (`act()`)
 * antes do próximo comando do teste.
 */
function setFieldLatex(field: HTMLElement & { value: string }, latex: string) {
  field.value = latex;
  fireEvent(field, new Event("input", { bubbles: true }));
}

describe("CalculatorWorkspace", () => {
  afterEach(() => {
    vi.mocked(apiClient.solve).mockReset();
    vi.mocked(apiClient.getHistory).mockReset();
    searchParamsMock.mockReturnValue(new URLSearchParams());
    routerReplaceMock.mockReset();
    routerPushMock.mockReset();
  });

  it("resolve com sucesso e atualiza o histórico", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    vi.mocked(apiClient.solve).mockResolvedValue({ expression: "2+2", result: "4", approx: null });

    const { container } = render(<CalculatorWorkspace />);
    const field = await getField(container);
    setFieldLatex(field, "2+2");

    fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

    await waitFor(() => expect(apiClient.solve).toHaveBeenCalledWith("2+2"));
    // findAllByText: o resultado aparece primeiro como texto puro e é
    // promovido a KaTeX (que duplica o "4" em MathML + HTML visual) — a
    // asserção precisa valer nas duas fases.
    expect((await screen.findAllByText("4")).length).toBeGreaterThan(0);
  });

  it("mostra mensagem amigável de erro quando o backend rejeita a expressão", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    vi.mocked(apiClient.solve).mockRejectedValue(
      new ApiError("invalid_expression", "Não foi possível interpretar.")
    );

    const { container } = render(<CalculatorWorkspace />);
    const field = await getField(container);
    setFieldLatex(field, "x");

    fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

    expect(await screen.findByText("Não foi possível interpretar.")).toBeInTheDocument();
  });

  // --- Sprint V3.0 (Structured Math Input) --------------------------------

  it("notação LaTeX fora do catálogo desta sprint mostra mensagem amigável, nunca chama o backend", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);

    const { container } = render(<CalculatorWorkspace />);
    const field = await getField(container);
    // Binomial (combinatória) — integral/limite/derivada/somatório
    // (V3.0.1), sistema/matriz/determinante (V3.0.2) e log/ln/logₐ/eˣ
    // (V3.0.3, categoria Funções) passaram a ser suportados; combinatória
    // continua fora do catálogo.
    setFieldLatex(field, "\\binom{n}{k}");

    fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

    expect(await screen.findByText("Esta notação ainda não é suportada pela calculadora.")).toBeInTheDocument();
    expect(apiClient.solve).not.toHaveBeenCalled();
  });

  it("slot de template não preenchido (\\placeholder{} vazio) mostra mensagem amigável distinta, nunca chama o backend", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);

    const { container } = render(<CalculatorWorkspace />);
    const field = await getField(container);
    setFieldLatex(field, "\\frac{1}{\\placeholder{}}");

    fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

    expect(await screen.findByText("Preencha todos os espaços antes de resolver.")).toBeInTheDocument();
    expect(apiClient.solve).not.toHaveBeenCalled();
  });

  // --- Hotfix V3.0.1a (bridge básica + teclado virtual MathLive) ---------
  //
  // Regressão real: `x³-6x²+11x-6=0` (polinômio básico, sempre funcionou)
  // passou a cair em "unsupported" depois da V3.0. Causa: o LaTeX REAL que
  // o mathjs produz (via `previewLatex`, usado pros exemplos/histórico)
  // envolve variáveis em chaves com espaço (`{ x}`) e usa "~" entre
  // coeficiente e variável (`6~{x}^2`) — o adapter só reconhecia
  // `[0-9a-zA-Z(]` como início de um novo fator na multiplicação
  // implícita, nunca "{", truncando a expressão. Corrigido genericamente
  // em `mathfield-to-backend.ts` (não com um caso especial pra este
  // polinômio) — os testes abaixo usam a MESMA forma real (não a forma
  // idealizada que escondeu o bug da primeira vez).
  describe("Hotfix V3.0.1a — bridge de polinômios básicos + teclado virtual do MathLive", () => {
    it("x³-6x²+11x-6=0 (regressão relatada) — a bridge aceita, múltiplos termos/coeficientes/sinais/potências/igualdade", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      vi.mocked(apiClient.solve).mockResolvedValue({
        expression: "x³-6x²+11x-6=0",
        result: "x=1 ou x=2 ou x=3",
        approx: null,
      });

      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);
      // Forma REAL que o mathjs produz (não a idealizada) — a mesma que
      // causou a regressão original.
      setFieldLatex(field, "{ x}^{3}-6~{ x}^{2}+11~ x-6 = 0");

      fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

      await waitFor(() => expect(apiClient.solve).toHaveBeenCalledWith("x³-6x²+11x-6=0"));
    });

    it("x²-4=0 continua aceito (forma real do mathjs)", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      vi.mocked(apiClient.solve).mockResolvedValue({ expression: "x²-4=0", result: "x=2 ou x=-2", approx: null });

      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);
      setFieldLatex(field, "{ x}^{2}-4 = 0");

      fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

      await waitFor(() => expect(apiClient.solve).toHaveBeenCalledWith("x²-4=0"));
    });

    it("2x+4=10 continua aceito (forma real do mathjs)", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      vi.mocked(apiClient.solve).mockResolvedValue({ expression: "2x+4=10", result: "x=3", approx: null });

      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);
      setFieldLatex(field, "2~ x+4 = 10");

      fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

      await waitFor(() => expect(apiClient.solve).toHaveBeenCalledWith("2x+4=10"));
    });

    it("teclado virtual do MathLive não fica disponível — política manual e ícone de abrir ocultado por CSS", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);

      const { container } = render(<CalculatorWorkspace />);
      const field = (await getField(container)) as unknown as { mathVirtualKeyboardPolicy: string };

      await waitFor(() => expect(field.mathVirtualKeyboardPolicy).toBe("manual"));
      const style = document.getElementById("structured-math-input-hide-virtual-keyboard-toggle");
      expect(style?.textContent).toContain("virtual-keyboard-toggle");
      expect(style?.textContent).toContain("display: none");
    });
  });

  it("teclado mostra Básico, Cálculo, Álgebra e Funções nesta página (Trigonometria/Geometria/Combinatória/Probabilidade/Símbolos ficam fora até serem migradas)", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    render(<CalculatorWorkspace />);

    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.getByRole("tab", { name: "Básico" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Cálculo" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Álgebra" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Funções" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Símbolos" })).not.toBeInTheDocument();
  });

  it("aba Funções (structuredOnly) esconde f(x)=/f( ) fora de escopo (sem mathLiveInsert)", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    render(<CalculatorWorkspace />);

    fireEvent.click(screen.getByRole("tab", { name: "Funções" }));
    expect(screen.queryByRole("button", { name: "Inserir definição de função" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inserir avaliação de função" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inserir logaritmo natural" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inserir exponencial de base e" })).toBeInTheDocument();
  });

  it("aba Álgebra (structuredOnly) esconde as teclas de polinômio fora de escopo (sem mathLiveInsert)", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    render(<CalculatorWorkspace />);

    fireEvent.click(screen.getByRole("tab", { name: "Álgebra" }));
    expect(screen.queryByRole("button", { name: "Inserir fatoração de polinômio" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inserir menor ou igual" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inserir matriz 2x2" })).toBeInTheDocument();
  });

  it("as 9 teclas básicas inserem estruturas via a API real do MathLive (nunca concatenação de string)", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    const { container } = render(<CalculatorWorkspace />);
    const field = await getField(container);

    fireEvent.click(screen.getByRole("button", { name: "Inserir expoente 2" }));
    expect(field.value).toBe("^{2}");
  });

  it("tecla de fração insere \\frac{}{} estruturado", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    const { container } = render(<CalculatorWorkspace />);
    const field = await getField(container);

    fireEvent.click(screen.getByRole("button", { name: "Inserir fração" }));
    expect(field.value).toBe("\\frac{\\placeholder{}}{\\placeholder{}}");
  });

  it("tecla de raiz quadrada insere \\sqrt{} estruturado", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    const { container } = render(<CalculatorWorkspace />);
    const field = await getField(container);

    fireEvent.click(screen.getByRole("button", { name: "Inserir raiz quadrada" }));
    expect(field.value).toBe("\\sqrt{\\placeholder{}}");
  });

  it("tecla de raiz n-ésima (nova nesta sprint) insere \\sqrt[]{}  com índice e radicando como slots independentes", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    const { container } = render(<CalculatorWorkspace />);
    const field = await getField(container);

    fireEvent.click(screen.getByRole("button", { name: "Inserir raiz n-ésima" }));
    expect(field.value).toBe("\\sqrt[\\placeholder{}]{\\placeholder{}}");
  });

  it("tecla π insere \\pi", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    const { container } = render(<CalculatorWorkspace />);
    const field = await getField(container);

    fireEvent.click(screen.getByRole("button", { name: "Inserir pi" }));
    expect(field.value).toBe("\\pi");
  });

  it("tecla de parênteses insere \\left(\\right) com slot dentro", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    const { container } = render(<CalculatorWorkspace />);
    const field = await getField(container);

    fireEvent.click(screen.getByRole("button", { name: "Inserir parênteses" }));
    expect(field.value).toBe("\\left(\\placeholder{}\\right)");
  });

  // --- Sprint V3.0.1 (Structured Calculus Input) --------------------------

  describe("Sprint V3.0.1 — categoria Cálculo: teclado + solve ponta-a-ponta", () => {
    // `MathKeyboard` só renderiza o painel da aba ATIVA (Básico por
    // padrão) — todo teste que clica numa tecla de Cálculo precisa trocar
    // de aba primeiro (mesma UX real: usuário clica "Cálculo" antes de
    // ver essas teclas).
    function switchToCalculo() {
      fireEvent.click(screen.getByRole("tab", { name: "Cálculo" }));
    }

    it("tecla d/dx insere \\frac{d}{dx}(placeholder) estruturado", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);
      switchToCalculo();

      fireEvent.click(screen.getByRole("button", { name: "Inserir derivada" }));
      expect(field.value).toBe("\\frac{d}{dx}\\left(\\placeholder{}\\right)");
    });

    it("tecla ∫ dx insere integral indefinida estruturada", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);
      switchToCalculo();

      fireEvent.click(screen.getByRole("button", { name: "Inserir integral indefinida" }));
      expect(field.value).toBe("\\int \\placeholder{}\\,dx");
    });

    it("tecla ∫ₐᵇ dx (nova) insere integral definida com 3 slots independentes", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);
      switchToCalculo();

      fireEvent.click(screen.getByRole("button", { name: "Inserir integral definida" }));
      expect(field.value).toBe("\\int_{\\placeholder{}}^{\\placeholder{}}\\placeholder{}\\,dx");
    });

    it("tecla lim insere limite estruturado", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);
      switchToCalculo();

      fireEvent.click(screen.getByRole("button", { name: "Inserir limite" }));
      expect(field.value).toBe("\\lim_{x\\to\\placeholder{}}\\placeholder{}");
    });

    it("tecla Σ (Cálculo) insere somatório estruturado com índice pré-preenchido 'i'", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);
      switchToCalculo();

      fireEvent.click(screen.getByRole("button", { name: "Inserir somatório" }));
      expect(field.value).toBe("\\sum_{\\placeholder{i}=\\placeholder{}}^{\\placeholder{}}\\placeholder{}");
    });

    it("tecla ∞ (Cálculo) insere infinito — reaproveita a MESMA configuração que já existia, categoria inteira de Símbolos continua oculta", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);
      switchToCalculo();

      fireEvent.click(screen.getByRole("button", { name: "Inserir infinito" }));
      expect(field.value).toBe("\\infty");
    });

    it.each([
      ["d/dx(x²)", "\\frac{d}{dx}\\left(x^2\\right)", "derivada(x², x)"],
      ["d/dx(x² + 3x)", "\\frac{d}{dx}\\left(x^2+3x\\right)", "derivada(x²+3x, x)"],
      ["∫x² dx", "\\int x^2\\,dx", "integral(x², x)"],
      ["∫sin(x) dx", "\\int \\sin(x)\\,dx", "integral(sin(x), x)"],
      ["∫₀¹x² dx", "\\int_{0}^{1}x^2\\,dx", "integral(x², x, 0, 1)"],
      ["lim x→0 sin(x)/x", "\\lim_{x\\to0}\\frac{\\sin(x)}{x}", "limite((sin(x))/x, x, 0)"],
      ["lim x→∞ 1/x", "\\lim_{x\\to\\infty}\\frac{1}{x}", "limite(1/x, x, ∞)"],
      ["Σ i=1..10 i", "\\sum_{i=1}^{10}i", "Σ(i=1..10) i"],
    ])("%s digitado/estruturado no campo -> Resolver chama o backend com a sintaxe canônica correta", async (_label, latex, backendExpression) => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      vi.mocked(apiClient.solve).mockResolvedValue({ expression: backendExpression, result: "resultado", approx: null });

      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);
      setFieldLatex(field, latex);

      fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

      await waitFor(() => expect(apiClient.solve).toHaveBeenCalledWith(backendExpression));
    });

    it.each([
      ["derivada sem expressão", "\\frac{d}{dx}\\left(\\placeholder{}\\right)"],
      ["integral sem integrando", "\\int \\placeholder{}\\,dx"],
      ["integral definida sem limite inferior", "\\int_{\\placeholder{}}^{1}x^2\\,dx"],
      ["integral definida sem limite superior", "\\int_{0}^{\\placeholder{}}x^2\\,dx"],
      ["limite sem destino", "\\lim_{x\\to\\placeholder{}}x"],
      ["limite sem expressão", "\\lim_{x\\to0}\\placeholder{}"],
      ["somatório sem limite superior", "\\sum_{i=1}^{\\placeholder{}}i"],
      ["somatório sem expressão", "\\sum_{i=1}^{10}\\placeholder{}"],
    ])("%s (slot vazio) mostra mensagem amigável, nunca chama o backend, nunca 500", async (_label, latex) => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);

      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);
      setFieldLatex(field, latex);

      fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

      expect(await screen.findByText("Preencha todos os espaços antes de resolver.")).toBeInTheDocument();
      expect(apiClient.solve).not.toHaveBeenCalled();
    });

    it("estrutura aninhada: fração dentro de integral -> integral((x²+1)/x, x)", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      vi.mocked(apiClient.solve).mockResolvedValue({ expression: "integral((x²+1)/x, x)", result: "r", approx: null });

      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);
      setFieldLatex(field, "\\int \\frac{x^2+1}{x}\\,dx");

      fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

      await waitFor(() => expect(apiClient.solve).toHaveBeenCalledWith("integral((x²+1)/x, x)"));
    });

    it("estrutura aninhada: raiz dentro de derivada -> derivada(√(x²+1), x)", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      vi.mocked(apiClient.solve).mockResolvedValue({ expression: "derivada(√(x²+1), x)", result: "r", approx: null });

      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);
      setFieldLatex(field, "\\frac{d}{dx}\\sqrt{x^2+1}");

      fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

      await waitFor(() => expect(apiClient.solve).toHaveBeenCalledWith("derivada(√(x²+1), x)"));
    });

    it("clicar num exemplo de Cálculo preenche o campo com o LaTeX equivalente (via previewLatex real)", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);

      fireEvent.click(screen.getByRole("button", { name: "Preencher exemplo: d/dx(x² + 3x)" }));

      const expectedLatex = await previewLatex("d/dx(x² + 3x)");
      await waitFor(() => expect(field.value).toBe(expectedLatex));
    });
  });

  // --- Sprint V3.0.2 (Structured Algebra Input) ----------------------------

  describe("Sprint V3.0.2 — categoria Álgebra: teclado + solve ponta-a-ponta", () => {
    function switchToAlgebra() {
      fireEvent.click(screen.getByRole("tab", { name: "Álgebra" }));
    }

    it("tecla Matriz 2×2 insere \\begin{bmatrix} estruturado, nunca string simulando matriz", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);
      switchToAlgebra();

      fireEvent.click(screen.getByRole("button", { name: "Inserir matriz 2x2" }));
      expect(field.value).toBe(
        "\\begin{bmatrix}\\placeholder{}&\\placeholder{}\\\\\\placeholder{}&\\placeholder{}\\end{bmatrix}"
      );
    });

    it("tecla Sistema 3×3 insere \\begin{cases} estruturado com 3 slots", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);
      switchToAlgebra();

      fireEvent.click(screen.getByRole("button", { name: "Inserir sistema linear 3x3" }));
      expect(field.value).toBe(
        "\\begin{cases}\\placeholder{}\\\\\\placeholder{}\\\\\\placeholder{}\\end{cases}"
      );
    });

    it("tecla Determinante 2×2 insere \\begin{vmatrix} (representação visual de barras)", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);
      switchToAlgebra();

      fireEvent.click(screen.getByRole("button", { name: "Inserir determinante 2x2" }));
      expect(field.value).toBe(
        "\\begin{vmatrix}\\placeholder{}&\\placeholder{}\\\\\\placeholder{}&\\placeholder{}\\end{vmatrix}"
      );
    });

    it("tecla A⁻¹ insere \\operatorname{inv}(placeholder)", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);
      switchToAlgebra();

      fireEvent.click(screen.getByRole("button", { name: "Inserir inversa" }));
      expect(field.value).toBe("\\operatorname{inv}\\left(\\placeholder{}\\right)");
    });

    it("tecla Aᵀ insere \\operatorname{transpose}(placeholder)", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);
      switchToAlgebra();

      fireEvent.click(screen.getByRole("button", { name: "Inserir transposta" }));
      expect(field.value).toBe("\\operatorname{transpose}\\left(\\placeholder{}\\right)");
    });

    it.each([
      ["sistema 2x2", "\\begin{cases}x+y=5\\\\x-y=1\\end{cases}", "x+y=5;x-y=1"],
      [
        "sistema 3x3",
        "\\begin{cases}x+y+z=6\\\\2x-y+z=3\\\\x+2y-z=2\\end{cases}",
        "x+y+z=6;2x-y+z=3;x+2y-z=2",
      ],
      ["matriz 2x2", "\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}", "[[1,2],[3,4]]"],
      [
        "matriz 3x3",
        "\\begin{bmatrix}1&2&3\\\\4&5&6\\\\7&8&9\\end{bmatrix}",
        "[[1,2,3],[4,5,6],[7,8,9]]",
      ],
      ["determinante 2x2 (barras)", "\\begin{vmatrix}1&2\\\\3&4\\end{vmatrix}", "det([[1,2],[3,4]])"],
      [
        "determinante 3x3 (barras)",
        "\\begin{vmatrix}1&2&3\\\\0&1&4\\\\5&6&0\\end{vmatrix}",
        "det([[1,2,3],[0,1,4],[5,6,0]])",
      ],
      [
        "soma de matrizes",
        "\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}+\\begin{bmatrix}5&6\\\\7&8\\end{bmatrix}",
        "[[1,2],[3,4]]+[[5,6],[7,8]]",
      ],
      [
        "multiplicação de matrizes",
        "\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}\\times\\begin{bmatrix}5&6\\\\7&8\\end{bmatrix}",
        "[[1,2],[3,4]]*[[5,6],[7,8]]",
      ],
      ["escalar × matriz (2A)", "2\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}", "2*[[1,2],[3,4]]"],
      [
        "inversa",
        "\\operatorname{inv}\\left(\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}\\right)",
        "inv([[1,2],[3,4]])",
      ],
      [
        "transposta",
        "\\operatorname{transpose}\\left(\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}\\right)",
        "transpose([[1,2],[3,4]])",
      ],
      [
        "célula com potência/fração/raiz/π",
        "\\begin{bmatrix}x^2&\\frac{1}{2}\\\\\\sqrt{2}&\\pi\\end{bmatrix}",
        "[[x²,1/2],[√(2),π]]",
      ],
    ])("%s digitado/estruturado no campo -> Resolver chama o backend com a sintaxe canônica correta", async (_label, latex, backendExpression) => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      vi.mocked(apiClient.solve).mockResolvedValue({ expression: backendExpression, result: "resultado", approx: null });

      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);
      setFieldLatex(field, latex);

      fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

      await waitFor(() => expect(apiClient.solve).toHaveBeenCalledWith(backendExpression));
    });

    it.each([
      ["matriz 2x2 com célula vazia", "\\begin{bmatrix}1&\\placeholder{}\\\\3&4\\end{bmatrix}"],
      [
        "matriz 3x3 com célula vazia",
        "\\begin{bmatrix}1&2&3\\\\4&\\placeholder{}&6\\\\7&8&9\\end{bmatrix}",
      ],
      ["sistema com equação vazia", "\\begin{cases}x+y=5\\\\\\placeholder{}\\end{cases}"],
      ["sistema com um lado vazio", "\\begin{cases}x+y=5\\\\x-y=\\placeholder{}\\end{cases}"],
      ["determinante 2x2 com célula vazia", "\\begin{vmatrix}1&\\placeholder{}\\\\3&4\\end{vmatrix}"],
      [
        "determinante 3x3 com célula vazia",
        "\\begin{vmatrix}1&2&3\\\\0&\\placeholder{}&4\\\\5&6&0\\end{vmatrix}",
      ],
    ])("%s (slot vazio) mostra mensagem amigável, nunca chama o backend, nunca 500", async (_label, latex) => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);

      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);
      setFieldLatex(field, latex);

      fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

      expect(await screen.findByText("Preencha todos os espaços antes de resolver.")).toBeInTheDocument();
      expect(apiClient.solve).not.toHaveBeenCalled();
    });

    it.each([
      ["Sistema 2×2", "x+y=5; x-y=1"],
      ["Sistema 3×3", "x+y+z=6; 2x-y+z=3; x+2y-z=2"],
      ["[[1,2],[3,4]]", "[[1,2],[3,4]]"],
      ["det([[1,2],[3,4]])", "det([[1,2],[3,4]])"],
    ])("clicar no exemplo '%s' preenche o campo com o LaTeX equivalente (via previewLatex real) e carrega VISUALMENTE (nunca texto cru)", async (label, unicodeExpression) => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      const { container } = render(<CalculatorWorkspace />);
      const field = await getField(container);

      fireEvent.click(screen.getByRole("button", { name: `Preencher exemplo: ${label}` }));

      const expectedLatex = await previewLatex(unicodeExpression);
      await waitFor(() => expect(field.value).toBe(expectedLatex));
      // Nunca a sintaxe literal crua do backend ("[[1,2],[3,4]]") — sempre
      // um ambiente LaTeX real (a matriz/sistema/determinante desenhados
      // como células/linhas de verdade pelo MathField).
      expect(field.value).toMatch(/\\begin\{(bmatrix|cases|vmatrix)\}|\\det/);
    });
  });

  it("Limpar esvazia o campo estruturado", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    const { container } = render(<CalculatorWorkspace />);
    const field = await getField(container);
    setFieldLatex(field, "x^2");

    await waitFor(() => expect(screen.getByRole("button", { name: /^limpar$/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: /^limpar$/i }));

    await waitFor(() => expect(field.value).toBe(""));
  });

  it("ida e volta pelo histórico preenche o campo com o LaTeX equivalente à expressão", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([
      { expression: "x²-4=0", result: "x=2 ou x=-2", approx: null, timestamp: "2026-01-01T00:00:00Z" },
    ]);
    const { container } = render(<CalculatorWorkspace />);
    const field = await getField(container);

    const historyButton = await screen.findByRole("button", { name: /reutilizar expressão: x²-4=0/i });
    fireEvent.click(historyButton);

    const expectedLatex = await previewLatex("x²-4=0");
    await waitFor(() => expect(field.value).toBe(expectedLatex));
  });

  it("clicar num exemplo preenche o campo com o LaTeX equivalente", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    const { container } = render(<CalculatorWorkspace />);
    const field = await getField(container);

    fireEvent.click(screen.getByRole("button", { name: "Preencher exemplo: (x+1)³" }));

    const expectedLatex = await previewLatex("(x+1)³");
    await waitFor(() => expect(field.value).toBe(expectedLatex));
  });

  it("todos os exemplos (V3.0 + Cálculo da V3.0.1 + Álgebra da V3.0.2 + Funções da V3.0.3) aparecem como botões", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    render(<CalculatorWorkspace />);

    for (const label of [
      "x² - 4 = 0",
      "2x + 4 = 10",
      "(x+1)³",
      "√16",
      "1/2 + 1/3",
      "x³-6x²+11x-6=0",
      "π/2",
      "d/dx(x² + 3x)",
      "∫ x² dx",
      "∫₀¹ x² dx",
      "lim x→0 sin(x)/x",
      "Σ i=1..10 i",
      "Sistema 2×2",
      "Sistema 3×3",
      "[[1,2],[3,4]]",
      "det([[1,2],[3,4]])",
      "ln(e)",
      "2^x=8",
      "ln(x)=2",
      "log₂(8)",
    ]) {
      expect(screen.getByRole("button", { name: `Preencher exemplo: ${label}` })).toBeInTheDocument();
    }
  });

  it("pré-preenche a partir da query string sem resolver automaticamente", async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("expression=x%C2%B2-4%3D0"));
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);

    const { container } = render(<CalculatorWorkspace />);
    const field = await getField(container);

    const expectedLatex = await previewLatex("x²-4=0");
    await waitFor(() => expect(field.value).toBe(expectedLatex));
    expect(apiClient.solve).not.toHaveBeenCalled();
  });

  /**
   * Investigação "Ver propriedades" (pós-Sprint V2.3) — regressão do bug
   * real: `useState(() => searchParams.get("expression") ?? "")` só roda
   * no PRIMEIRO mount. Um link como "Ver propriedades" aponta pra ESTA
   * MESMA rota (`/calculadora?expression=...`), então clicar nele troca
   * só a query string SEM desmontar `CalculatorWorkspace` — sem a
   * correção, o campo/resultado nunca reagiam à nova query. `rerender`
   * simula exatamente essa navegação intra-página (o mock de
   * `useSearchParams` muda de valor SEM o componente desmontar, igual ao
   * App Router faria de verdade).
   */
  describe("navegação intra-página via query string (ex. 'Ver propriedades')", () => {
    it("uma query string NOVA (após o mount) atualiza o campo, mesmo sem desmontar o componente", async () => {
      searchParamsMock.mockReturnValue(new URLSearchParams("expression=det(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)"));
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);

      const { container, rerender } = render(<CalculatorWorkspace />);
      const field = await getField(container);
      await waitFor(async () => expect(field.value).toBe(await previewLatex("det([[1,2],[3,4]])")));

      searchParamsMock.mockReturnValue(
        new URLSearchParams("expression=transpose(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)")
      );
      rerender(<CalculatorWorkspace />);

      await waitFor(async () => expect(field.value).toBe(await previewLatex("transpose([[1,2],[3,4]])")));
    });

    it("query string com autoSolve=1 resolve automaticamente ao chegar (ex. 'Ver propriedades')", async () => {
      searchParamsMock.mockReturnValue(new URLSearchParams());
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      vi.mocked(apiClient.solve).mockResolvedValue({
        expression: "det([[1,2],[3,4]])",
        result: "-2",
        approx: null,
      });

      const { rerender } = render(<CalculatorWorkspace />);
      expect(apiClient.solve).not.toHaveBeenCalled();

      searchParamsMock.mockReturnValue(
        new URLSearchParams("expression=det(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)&autoSolve=1")
      );
      rerender(<CalculatorWorkspace />);

      await waitFor(() => expect(apiClient.solve).toHaveBeenCalledWith("det([[1,2],[3,4]])"));
      expect((await screen.findAllByText("-2")).length).toBeGreaterThan(0);
    });

    it("sem autoSolve, uma query string nova só pré-preenche — não resolve sozinha", async () => {
      searchParamsMock.mockReturnValue(new URLSearchParams());
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);

      const { container, rerender } = render(<CalculatorWorkspace />);
      await getField(container);

      searchParamsMock.mockReturnValue(new URLSearchParams("expression=det(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)"));
      rerender(<CalculatorWorkspace />);

      const field = await getField(container);
      await waitFor(async () => expect(field.value).toBe(await previewLatex("det([[1,2],[3,4]])")));
      expect(apiClient.solve).not.toHaveBeenCalled();
    });

    it("re-renderizar com a MESMA query string não reprocessa (evita loop/nova chamada)", async () => {
      searchParamsMock.mockReturnValue(
        new URLSearchParams("expression=det(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)&autoSolve=1")
      );
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      vi.mocked(apiClient.solve).mockResolvedValue({ expression: "det(...)", result: "-2", approx: null });

      const { rerender } = render(<CalculatorWorkspace />);
      await waitFor(() => expect(apiClient.solve).toHaveBeenCalledTimes(1));

      rerender(<CalculatorWorkspace />);
      rerender(<CalculatorWorkspace />);

      expect(apiClient.solve).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Investigação "auto-resolve só funciona na primeira vez" (pós-Sprint
   * V2.3): o guard antigo comparava só por "expression" — uma SEGUNDA
   * ação idêntica (mesmo "Ver propriedades", mesma matriz) produzia a
   * MESMA URL já registrada como processada, e o guard (corretamente,
   * pela lógica antiga) bloqueava a segunda execução. Corrigido com
   * `&request=<uuid>` (gerado no clique, nunca durante renderização — ver
   * `ContextActions.tsx`): quando presente, vira a chave de
   * deduplicação, garantindo uma execução nova a cada clique mesmo com
   * expressão idêntica.
   */
  describe("identificador de solicitação (request) — cada ação é nova, mesmo com expressão idêntica", () => {
    it("um segundo clique (request NOVO) resolve de novo, mesmo com a mesma expressão", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      vi.mocked(apiClient.solve).mockResolvedValue({ expression: "det(...)", result: "-2", approx: null });

      const { rerender } = render(<CalculatorWorkspace />);

      searchParamsMock.mockReturnValue(
        new URLSearchParams("expression=det(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)&autoSolve=1&request=aaa")
      );
      rerender(<CalculatorWorkspace />);
      await waitFor(() => expect(apiClient.solve).toHaveBeenCalledTimes(1));

      // Mesma expressão, request DIFERENTE — simula um segundo clique real
      // em "Ver propriedades" (a URL só muda pelo nonce novo).
      searchParamsMock.mockReturnValue(
        new URLSearchParams("expression=det(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)&autoSolve=1&request=bbb")
      );
      rerender(<CalculatorWorkspace />);

      await waitFor(() => expect(apiClient.solve).toHaveBeenCalledTimes(2));
    });

    it("cada ação (request distinto) gera exatamente uma chamada ao /solve — nunca mais, nunca menos", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      vi.mocked(apiClient.solve).mockResolvedValue({ expression: "det(...)", result: "-2", approx: null });

      const { rerender } = render(<CalculatorWorkspace />);
      for (const request of ["r1", "r2", "r3"]) {
        searchParamsMock.mockReturnValue(
          new URLSearchParams(`expression=det(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)&autoSolve=1&request=${request}`)
        );
        rerender(<CalculatorWorkspace />);
        // re-renderizar 2x a mais por request, simulando renders extras
        // (StrictMode, updates não relacionados) sem re-disparar.
        rerender(<CalculatorWorkspace />);
        rerender(<CalculatorWorkspace />);
      }
      await waitFor(() => expect(apiClient.solve).toHaveBeenCalledTimes(3));
    });

    it("depois de resolver, a URL é limpa via router.replace (request/autoSolve removidos) e isso não causa loop", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      vi.mocked(apiClient.solve).mockResolvedValue({ expression: "det(...)", result: "-2", approx: null });

      const { rerender } = render(<CalculatorWorkspace />);

      searchParamsMock.mockReturnValue(
        new URLSearchParams("expression=det(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)&autoSolve=1&request=ccc")
      );
      rerender(<CalculatorWorkspace />);
      await waitFor(() => expect(apiClient.solve).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(routerReplaceMock).toHaveBeenCalledWith(
          "/calculadora?expression=det(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)"
        )
      );

      // Simula o efeito real de router.replace: a URL muda, sem autoSolve/request.
      searchParamsMock.mockReturnValue(new URLSearchParams("expression=det(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)"));
      rerender(<CalculatorWorkspace />);
      rerender(<CalculatorWorkspace />);

      // Nenhuma chamada extra — a limpeza da URL não reabre o guard.
      expect(apiClient.solve).toHaveBeenCalledTimes(1);
      expect(routerReplaceMock).toHaveBeenCalledTimes(1);
    });

    it("request novo com expressão DIFERENTE continua funcionando normalmente", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      vi.mocked(apiClient.solve).mockImplementation(async (value: string) => ({
        expression: value,
        result: value === "det([[1,2],[3,4]])" ? "-2" : "5",
        approx: null,
      }));

      const { rerender } = render(<CalculatorWorkspace />);

      searchParamsMock.mockReturnValue(
        new URLSearchParams("expression=det(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)&autoSolve=1&request=x1")
      );
      rerender(<CalculatorWorkspace />);
      await waitFor(() => expect(apiClient.solve).toHaveBeenCalledWith("det([[1,2],[3,4]])"));

      searchParamsMock.mockReturnValue(
        new URLSearchParams("expression=trace(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)&autoSolve=1&request=x2")
      );
      rerender(<CalculatorWorkspace />);
      await waitFor(() => expect(apiClient.solve).toHaveBeenCalledWith("trace([[1,2],[3,4]])"));

      expect(apiClient.solve).toHaveBeenCalledTimes(2);
    });

    it("erro na primeira execução não impede uma tentativa posterior (request novo)", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      vi.mocked(apiClient.solve)
        .mockRejectedValueOnce(new ApiError("invalid_expression", "Falha de rede."))
        .mockResolvedValueOnce({ expression: "det(...)", result: "-2", approx: null });

      const { rerender } = render(<CalculatorWorkspace />);

      searchParamsMock.mockReturnValue(
        new URLSearchParams("expression=det(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)&autoSolve=1&request=err1")
      );
      rerender(<CalculatorWorkspace />);
      expect(await screen.findByText("Falha de rede.")).toBeInTheDocument();

      searchParamsMock.mockReturnValue(
        new URLSearchParams("expression=det(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)&autoSolve=1&request=err2")
      );
      rerender(<CalculatorWorkspace />);

      expect((await screen.findAllByText("-2")).length).toBeGreaterThan(0);
      expect(apiClient.solve).toHaveBeenCalledTimes(2);
    });

    it("React StrictMode não duplica a chamada pra um único request", async () => {
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);
      vi.mocked(apiClient.solve).mockResolvedValue({ expression: "det(...)", result: "-2", approx: null });
      searchParamsMock.mockReturnValue(
        new URLSearchParams("expression=det(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)&autoSolve=1&request=strict1")
      );

      render(
        <StrictMode>
          <CalculatorWorkspace />
        </StrictMode>
      );

      await waitFor(() => expect(apiClient.solve).toHaveBeenCalledTimes(1));
    });
  });

  it("preenche o campo ao clicar num item do histórico", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([
      { expression: "2+2", result: "4", approx: null, timestamp: "2026-01-01T00:00:00Z" },
    ]);

    const { container } = render(<CalculatorWorkspace />);
    const field = await getField(container);

    const historyButton = await screen.findByRole("button", { name: /reutilizar expressão: 2\+2/i });
    fireEvent.click(historyButton);

    const expectedLatex = await previewLatex("2+2");
    await waitFor(() => expect(field.value).toBe(expectedLatex));
  });

  it("oculta um item do histórico localmente ao clicar em Ocultar", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([
      { expression: "2+2", result: "4", approx: null, timestamp: "2026-01-01T00:00:00Z" },
    ]);

    render(<CalculatorWorkspace />);

    // Consulta por role/aria-label (texto cru), não pelo texto visual — a
    // linha do histórico agora é composta (KaTeX após a conversão).
    await screen.findByRole("button", { name: /reutilizar expressão: 2\+2/i });
    fireEvent.click(screen.getByRole("button", { name: /ocultar da lista: 2\+2/i }));

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /reutilizar expressão: 2\+2/i })
      ).not.toBeInTheDocument()
    );
  });
});
