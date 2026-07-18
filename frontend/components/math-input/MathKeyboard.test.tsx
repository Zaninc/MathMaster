import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MathKeyboard } from "./MathKeyboard";

describe("MathKeyboard", () => {
  it("renderiza rótulos LaTeX como KaTeX e mantém teclas sem latex como texto", () => {
    const { container } = render(<MathKeyboard onInsert={vi.fn()} />);

    // Aba Básico ativa por padrão: x²/x³/xⁿ/a-b/√/∛ são KaTeX; "( )" e "=" são texto.
    expect(container.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(6);
    expect(screen.getByRole("button", { name: "Inserir parênteses" })).toHaveTextContent("( )");
    expect(screen.getByRole("button", { name: "Inserir igual" })).toHaveTextContent("=");
  });

  it("clicar numa tecla LaTeX insere o MESMO texto/cursor de antes (latex é só visual)", () => {
    const onInsert = vi.fn();
    render(<MathKeyboard onInsert={onInsert} />);

    fireEvent.click(screen.getByRole("button", { name: "Inserir expoente 2" }));
    expect(onInsert).toHaveBeenCalledWith("²", 1);

    fireEvent.click(screen.getByRole("button", { name: "Inserir fração" }));
    expect(onInsert).toHaveBeenCalledWith("()/()", 1);
  });

  it("o KaTeX visual fica aria-hidden e o nome acessível continua vindo do aria-label", () => {
    render(<MathKeyboard onInsert={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Inserir raiz quadrada" });
    const hidden = button.querySelector("span[aria-hidden='true'] .katex");
    expect(hidden).not.toBeNull();
  });

  it("teclas LaTeX funcionam em todas as abas (Funções: logₐ)", () => {
    const onInsert = vi.fn();
    render(<MathKeyboard onInsert={onInsert} />);

    fireEvent.click(screen.getByRole("tab", { name: "Funções" }));
    const logBase = screen.getByRole("button", { name: /logaritmo de base arbitrária/i });
    expect(logBase.querySelector(".katex")).not.toBeNull();

    fireEvent.click(logBase);
    expect(onInsert).toHaveBeenCalledWith("log()/log()", 4);
  });
});
