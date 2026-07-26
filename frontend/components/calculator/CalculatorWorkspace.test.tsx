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

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import { CalculatorWorkspace } from "./CalculatorWorkspace";

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

    render(<CalculatorWorkspace />);

    fireEvent.change(screen.getByLabelText("Expressão matemática"), { target: { value: "2+2" } });
    fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

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

    render(<CalculatorWorkspace />);

    fireEvent.change(screen.getByLabelText("Expressão matemática"), { target: { value: "@@@" } });
    fireEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

    expect(await screen.findByText("Não foi possível interpretar.")).toBeInTheDocument();
  });

  it("insere uma tecla do teclado matemático no campo", () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    render(<CalculatorWorkspace />);

    fireEvent.click(screen.getByRole("tab", { name: "Trigonometria" }));
    fireEvent.click(screen.getByRole("button", { name: "Inserir seno" }));

    expect(screen.getByLabelText("Expressão matemática")).toHaveValue("sen()");
  });

  it("fechamento da Sprint de Matrizes: det/inversa/transposta (aba Álgebra) inserem no campo multilinha com cursor entre os parênteses", () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    render(<CalculatorWorkspace />);
    const input = screen.getByLabelText<HTMLTextAreaElement>("Expressão matemática");

    fireEvent.click(screen.getByRole("tab", { name: "Álgebra" }));
    fireEvent.click(screen.getByRole("button", { name: "Inserir determinante" }));
    expect(input).toHaveValue("det()");
    expect(input.selectionStart).toBe(4);

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Inserir inversa" }));
    expect(input).toHaveValue("inv()");
    expect(input.selectionStart).toBe(4);

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Inserir transposta" }));
    expect(input).toHaveValue("transpose()");
    expect(input.selectionStart).toBe(10);
  });

  it("Sprint V2.4 (Sistemas Lineares): tecla 'Sistema linear' insere o exemplo multilinha no campo, com cursor no fim", () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    render(<CalculatorWorkspace />);
    const input = screen.getByLabelText<HTMLTextAreaElement>("Expressão matemática");

    fireEvent.click(screen.getByRole("tab", { name: "Álgebra" }));
    fireEvent.click(screen.getByRole("button", { name: "Inserir sistema linear de exemplo" }));

    expect(input).toHaveValue("x+y=5\nx-y=1");
    expect(input.selectionStart).toBe("x+y=5\nx-y=1".length);
  });

  it("√ insere o glifo visual √() com cursor no parêntese; completado, preview deriva do MESMO texto", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    const { container } = render(<CalculatorWorkspace />);
    const input = screen.getByLabelText<HTMLInputElement>("Expressão matemática");

    fireEvent.click(screen.getByRole("button", { name: "Inserir raiz quadrada" }));
    expect(input).toHaveValue("√()");
    expect(input.selectionStart).toBe(2);

    // "digita 9" na posição do cursor
    fireEvent.change(input, { target: { value: "√(9)" } });
    expect(input).toHaveValue("√(9)");

    await waitFor(
      () => {
        const preview = container.querySelector("p[data-latex-source]");
        expect(preview?.getAttribute("data-latex-source")).toBe("√(9)");
      },
      { timeout: 2000 }
    );
    expect(
      Array.from(container.querySelectorAll("annotation")).some((node) =>
        node.textContent?.includes("\\sqrt{9}")
      )
    ).toBe(true);
  });

  it("∛ insere o glifo visual ∛(); completado, preview deriva exatamente de ∛(8)", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    const { container } = render(<CalculatorWorkspace />);
    const input = screen.getByLabelText<HTMLInputElement>("Expressão matemática");

    fireEvent.click(screen.getByRole("button", { name: "Inserir raiz cúbica" }));
    expect(input).toHaveValue("∛()");
    expect(input.selectionStart).toBe(2);

    fireEvent.change(input, { target: { value: "∛(8)" } });
    await waitFor(
      () => {
        const preview = container.querySelector("p[data-latex-source]");
        expect(preview?.getAttribute("data-latex-source")).toBe("∛(8)");
      },
      { timeout: 2000 }
    );
    expect(
      Array.from(container.querySelectorAll("annotation")).some((node) =>
        node.textContent?.includes("\\sqrt[3]{8}")
      )
    ).toBe(true);
  });

  it("xⁿ insere apenas o glifo sobrescrito ⁿ na posição do cursor, sem parênteses automáticos (mesmo padrão de x²/x³)", () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    render(<CalculatorWorkspace />);
    const input = screen.getByLabelText<HTMLInputElement>("Expressão matemática");

    fireEvent.click(screen.getByRole("button", { name: "Inserir expoente n" }));
    expect(input).toHaveValue("ⁿ");
    expect(input.selectionStart).toBe(1);
  });

  it("xⁿ com seleção substitui o texto selecionado normalmente, sem envolver em parênteses", () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    render(<CalculatorWorkspace />);
    const input = screen.getByLabelText<HTMLInputElement>("Expressão matemática");

    fireEvent.change(input, { target: { value: "x" } });
    input.setSelectionRange(0, 1);
    fireEvent.click(screen.getByRole("button", { name: "Inserir expoente n" }));

    expect(input).toHaveValue("ⁿ");
    expect(input.selectionStart).toBe(1);
  });

  it("eˣ insere o template visual eˣ() com cursor no parêntese; preview mostra e elevado", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    const { container } = render(<CalculatorWorkspace />);
    const input = screen.getByLabelText<HTMLInputElement>("Expressão matemática");

    fireEvent.click(screen.getByRole("tab", { name: "Funções" }));
    fireEvent.click(screen.getByRole("button", { name: "Inserir exponencial de base e" }));
    expect(input).toHaveValue("eˣ()");
    expect(input.selectionStart).toBe(3);

    fireEvent.change(input, { target: { value: "eˣ(2)" } });
    await waitFor(
      () => {
        const preview = container.querySelector("p[data-latex-source]");
        expect(preview?.getAttribute("data-latex-source")).toBe("eˣ(2)");
      },
      { timeout: 2000 }
    );
    expect(
      Array.from(container.querySelectorAll("annotation")).some((node) =>
        node.textContent?.includes("e^{2}")
      )
    ).toBe(true);
  });

  it("ida e volta pelo histórico preserva a expressão exata (Unicode visual incluído)", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([
      { expression: "√(9)", result: "3", approx: null, timestamp: "2026-01-01T00:00:00Z" },
    ]);
    render(<CalculatorWorkspace />);

    const historyButton = await screen.findByRole("button", { name: /reutilizar expressão: √\(9\)/i });
    fireEvent.click(historyButton);

    expect(screen.getByLabelText("Expressão matemática")).toHaveValue("√(9)");
  });

  it("pré-preenche a partir da query string sem resolver automaticamente", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("expression=x%C2%B2-4%3D0"));
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);

    render(<CalculatorWorkspace />);

    expect(screen.getByLabelText("Expressão matemática")).toHaveValue("x²-4=0");
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
    it("uma query string NOVA (após o mount) atualiza o campo, mesmo sem desmontar o componente", () => {
      searchParamsMock.mockReturnValue(new URLSearchParams("expression=det(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)"));
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);

      const { rerender } = render(<CalculatorWorkspace />);
      expect(screen.getByLabelText("Expressão matemática")).toHaveValue("det([[1,2],[3,4]])");

      searchParamsMock.mockReturnValue(
        new URLSearchParams("expression=transpose(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)")
      );
      rerender(<CalculatorWorkspace />);

      expect(screen.getByLabelText("Expressão matemática")).toHaveValue("transpose([[1,2],[3,4]])");
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

      expect(screen.getByLabelText("Expressão matemática")).toHaveValue("det([[1,2],[3,4]])");
      await waitFor(() => expect(apiClient.solve).toHaveBeenCalledWith("det([[1,2],[3,4]])"));
      expect((await screen.findAllByText("-2")).length).toBeGreaterThan(0);
    });

    it("sem autoSolve, uma query string nova só pré-preenche — não resolve sozinha", () => {
      searchParamsMock.mockReturnValue(new URLSearchParams());
      vi.mocked(apiClient.getHistory).mockResolvedValue([]);

      const { rerender } = render(<CalculatorWorkspace />);

      searchParamsMock.mockReturnValue(new URLSearchParams("expression=det(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)"));
      rerender(<CalculatorWorkspace />);

      expect(screen.getByLabelText("Expressão matemática")).toHaveValue("det([[1,2],[3,4]])");
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
    it("3. um segundo clique (request NOVO) resolve de novo, mesmo com a mesma expressão", async () => {
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

    it("5. cada ação (request distinto) gera exatamente uma chamada ao /solve — nunca mais, nunca menos", async () => {
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

    it("6. depois de resolver, a URL é limpa via router.replace (request/autoSolve removidos) e isso não causa loop", async () => {
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

    it("8. request novo com expressão DIFERENTE continua funcionando normalmente", async () => {
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

    it("9. erro na primeira execução não impede uma tentativa posterior (request novo)", async () => {
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

    it("10. React StrictMode não duplica a chamada pra um único request", async () => {
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

    render(<CalculatorWorkspace />);

    const historyButton = await screen.findByRole("button", { name: /reutilizar expressão: 2\+2/i });
    fireEvent.click(historyButton);

    expect(screen.getByLabelText("Expressão matemática")).toHaveValue("2+2");
  });

  it("preenche o campo com a expressão exata de um exemplo, mesmo exibido via KaTeX", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    render(<CalculatorWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "Preencher exemplo: d/dx(x² + 3x)" }));

    expect(screen.getByLabelText("Expressão matemática")).toHaveValue("d/dx(x² + 3x)");
  });

  it("Sprint V2.4 (Sistemas Lineares): exemplo 'x+y=5\\nx-y=1' preenche o campo multilinha com o valor exato", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    render(<CalculatorWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "Preencher exemplo: x+y=5\nx-y=1" }));

    expect(screen.getByLabelText("Expressão matemática")).toHaveValue("x+y=5\nx-y=1");
  });

  it("Sprint V2.2.1: o campo (agora um textarea) preserva um valor multi-linha de variáveis locais de matriz", async () => {
    // Sprint V2.2.2 removeu os exemplos com variáveis locais (A=..., B=...)
    // da lista de "Exemplos" (decisão de UX) — a sintaxe continua 100%
    // suportada pelo motor e pelo campo em si, só deixou de ter um botão
    // de exemplo dedicado. Preenchimento simulado diretamente (mesmo
    // caminho que colar/digitar exerceria) em vez de clicar um exemplo.
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    render(<CalculatorWorkspace />);

    const field = screen.getByLabelText("Expressão matemática");
    expect(field.tagName).toBe("TEXTAREA");

    fireEvent.change(field, { target: { value: "A=[[1,2],[3,4]]\nB=[[5,6],[7,8]]\nA*B" } });

    expect(field).toHaveValue("A=[[1,2],[3,4]]\nB=[[5,6],[7,8]]\nA*B");
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
