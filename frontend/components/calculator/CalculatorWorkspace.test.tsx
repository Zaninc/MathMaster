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
    setFieldLatex(field, "\\int_0^1 x^2\\,dx");

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

  it("teclado mostra só a categoria Básico nesta página (Álgebra/Funções/Símbolos ficam fora até serem migradas)", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    render(<CalculatorWorkspace />);

    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Básico" })).toBeInTheDocument();
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

  it("todos os exemplos reduzidos da V3.0 aparecem como botões", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    render(<CalculatorWorkspace />);

    for (const label of ["x² - 4 = 0", "2x + 4 = 10", "(x+1)³", "√16", "1/2 + 1/3", "x³-6x²+11x-6=0", "π/2"]) {
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
