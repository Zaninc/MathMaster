import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { KEYBOARD_CATEGORIES } from "@/data/keyboard";

import { MathKeyboard } from "./MathKeyboard";

describe("MathKeyboard", () => {
  it("renderiza rótulos LaTeX como KaTeX e mantém teclas sem latex como texto", () => {
    const { container } = render(<MathKeyboard onInsert={vi.fn()} />);

    // Aba Básico ativa por padrão: x²/x³/xⁿ/a-b/√/∛ são KaTeX; "( )" e "=" são texto.
    expect(container.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(6);
    expect(screen.getByRole("button", { name: "Inserir parênteses" })).toHaveTextContent("( )");
    expect(screen.getByRole("button", { name: "Inserir igual" })).toHaveTextContent("=");
  });

  it("clicar numa tecla entrega a tecla inteira com insert/cursor intactos (latex é só visual)", () => {
    const onInsert = vi.fn();
    render(<MathKeyboard onInsert={onInsert} />);

    fireEvent.click(screen.getByRole("button", { name: "Inserir expoente 2" }));
    expect(onInsert).toHaveBeenCalledWith(expect.objectContaining({ insert: "²", cursorOffset: 1 }));

    fireEvent.click(screen.getByRole("button", { name: "Inserir fração" }));
    expect(onInsert).toHaveBeenCalledWith(
      expect.objectContaining({ insert: "()/()", cursorOffset: 1 })
    );

    fireEvent.click(screen.getByRole("button", { name: "Inserir raiz quadrada" }));
    expect(onInsert).toHaveBeenCalledWith(
      expect.objectContaining({ insert: "√()", cursorOffset: 2 })
    );
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
    expect(onInsert).toHaveBeenCalledWith(
      expect.objectContaining({ insert: "log()/log()", cursorOffset: 4 })
    );
  });

  it("fechamento da Sprint de Matrizes: det/inversa/transposta aparecem na aba Álgebra com label KaTeX e inserem a sintaxe de função", () => {
    const onInsert = vi.fn();
    render(<MathKeyboard onInsert={onInsert} />);

    fireEvent.click(screen.getByRole("tab", { name: "Álgebra" }));

    const det = screen.getByRole("button", { name: "Inserir determinante" });
    const inversa = screen.getByRole("button", { name: "Inserir inversa" });
    const transposta = screen.getByRole("button", { name: "Inserir transposta" });

    // Label visual renderizada via KaTeX (mesmo mecanismo das demais teclas).
    expect(det.querySelector(".katex")).not.toBeNull();
    expect(inversa.querySelector(".katex")).not.toBeNull();
    expect(transposta.querySelector(".katex")).not.toBeNull();

    fireEvent.click(det);
    expect(onInsert).toHaveBeenCalledWith(expect.objectContaining({ insert: "det()", cursorOffset: 4 }));

    fireEvent.click(inversa);
    expect(onInsert).toHaveBeenCalledWith(expect.objectContaining({ insert: "inv()", cursorOffset: 4 }));

    fireEvent.click(transposta);
    expect(onInsert).toHaveBeenCalledWith(
      expect.objectContaining({ insert: "transpose()", cursorOffset: 10 })
    );

    // Nunca a sintaxe não suportada (^-1 / ^T) — só a de função.
    for (const call of onInsert.mock.calls) {
      const inserted = (call[0] as { insert: string }).insert;
      expect(inserted).not.toContain("^-1");
      expect(inserted).not.toContain("^T");
    }
  });

  it("Sprint V2.4 (Sistemas Lineares): tecla 'Sistema linear' (Álgebra) renderiza como \\begin{cases}...\\end{cases} e insere o exemplo multilinha", () => {
    const onInsert = vi.fn();
    render(<MathKeyboard onInsert={onInsert} />);

    fireEvent.click(screen.getByRole("tab", { name: "Álgebra" }));
    const button = screen.getByRole("button", { name: "Inserir sistema linear de exemplo" });

    expect(button.querySelector(".katex")).not.toBeNull();

    fireEvent.click(button);
    expect(onInsert).toHaveBeenCalledWith(
      expect.objectContaining({ insert: "x+y=5\nx-y=1", cursorOffset: "x+y=5\nx-y=1".length })
    );
  });

  // --- Sprint V3.0 (Structured Math Input) --------------------------------

  it("prop `categories` restringe as abas mostradas (Calculadora passa só Básico nesta sprint)", () => {
    const basico = KEYBOARD_CATEGORIES.filter((category) => category.id === "basico");
    render(<MathKeyboard onInsert={vi.fn()} categories={basico} />);

    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Básico" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Álgebra" })).not.toBeInTheDocument();
  });

  it("sem a prop `categories`, mostra todas (comportamento de antes, compatibilidade)", () => {
    render(<MathKeyboard onInsert={vi.fn()} />);
    expect(screen.getAllByRole("tab").length).toBe(KEYBOARD_CATEGORIES.length);
  });
});
