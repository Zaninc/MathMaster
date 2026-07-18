import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const searchParamsMock = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock(),
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
  });

  it("resolve com sucesso e atualiza o histórico", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    vi.mocked(apiClient.solve).mockResolvedValue({ expression: "2+2", result: "4" });

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

  it("xⁿ sem seleção insere o template visual ()ⁿ com cursor na base, nunca '**'", () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    render(<CalculatorWorkspace />);
    const input = screen.getByLabelText<HTMLInputElement>("Expressão matemática");

    fireEvent.click(screen.getByRole("button", { name: "Inserir potência" }));
    expect(input).toHaveValue("()ⁿ");
    expect(input).not.toHaveValue("**");
    expect(input.selectionStart).toBe(1);
  });

  it("xⁿ com seleção envolve a base preservada: 'x' vira (x)ⁿ com cursor após o expoente", () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([]);
    render(<CalculatorWorkspace />);
    const input = screen.getByLabelText<HTMLInputElement>("Expressão matemática");

    fireEvent.change(input, { target: { value: "x" } });
    input.setSelectionRange(0, 1);
    fireEvent.click(screen.getByRole("button", { name: "Inserir potência" }));

    expect(input).toHaveValue("(x)ⁿ");
    expect(input.selectionStart).toBe(4);
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
      { expression: "√(9)", result: "3", timestamp: "2026-01-01T00:00:00Z" },
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

  it("preenche o campo ao clicar num item do histórico", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([
      { expression: "2+2", result: "4", timestamp: "2026-01-01T00:00:00Z" },
    ]);

    render(<CalculatorWorkspace />);

    const historyButton = await screen.findByRole("button", { name: /reutilizar expressão: 2\+2/i });
    fireEvent.click(historyButton);

    expect(screen.getByLabelText("Expressão matemática")).toHaveValue("2+2");
  });

  it("oculta um item do histórico localmente ao clicar em Ocultar", async () => {
    vi.mocked(apiClient.getHistory).mockResolvedValue([
      { expression: "2+2", result: "4", timestamp: "2026-01-01T00:00:00Z" },
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
