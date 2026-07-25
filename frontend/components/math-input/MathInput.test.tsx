import { createRef } from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MathInput } from "./MathInput";

/** Mesma técnica de `ProgressiveMathResult.test.tsx`: jsdom não faz layout
 * real (`scrollHeight` é sempre 0), então a medição é simulada via
 * `Object.defineProperty` para testar a LÓGICA de crescimento, não o
 * resultado visual real de um navegador de verdade. */
function setScrollHeight(node: HTMLElement, value: number): void {
  Object.defineProperty(node, "scrollHeight", { value, configurable: true });
}

function Harness({
  value,
  onChange,
  submitDisabled = false,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  submitDisabled?: boolean;
  onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <MathInput id="expr" value={value} onChange={onChange} />
      <button type="submit" disabled={submitDisabled}>
        Resolver
      </button>
    </form>
  );
}

describe("MathInput", () => {
  it("renderiza como textarea (role textbox) com 1 linha inicial", () => {
    render(<MathInput id="expr" value="" onChange={vi.fn()} />);
    const field = screen.getByRole("textbox");
    expect(field.tagName).toBe("TEXTAREA");
    expect(field).toHaveAttribute("rows", "1");
  });

  it("Enter insere quebra de linha em vez de enviar o formulário", () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    render(<Harness value="2+2" onChange={onChange} onSubmit={onSubmit} />);

    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Ctrl+Enter resolve (envia o formulário)", () => {
    const onSubmit = vi.fn();
    render(<Harness value="2+2" onChange={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", ctrlKey: true });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("Cmd+Enter (metaKey, macOS) resolve também", () => {
    const onSubmit = vi.fn();
    render(<Harness value="2+2" onChange={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", metaKey: true });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("Ctrl+Enter não faz nada quando o botão Resolver está desabilitado (mesma trava do clique)", () => {
    const onSubmit = vi.fn();
    render(<Harness value="" onChange={vi.fn()} submitDisabled onSubmit={onSubmit} />);

    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", ctrlKey: true });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Ctrl com outra tecla (não Enter) não aciona o atalho", () => {
    const onSubmit = vi.fn();
    render(<Harness value="2+2" onChange={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.keyDown(screen.getByRole("textbox"), { key: "a", ctrlKey: true });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("cresce até o teto e depois passa a rolar (overflow-y-auto), nunca redimensionável manualmente", () => {
    const { rerender } = render(<MathInput id="expr" value="" onChange={vi.fn()} />);
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(field.className).toContain("resize-none");
    expect(field.className).toContain("overflow-y-auto");

    setScrollHeight(field, 60);
    rerender(<MathInput id="expr" value="linha 1\nlinha 2" onChange={vi.fn()} />);
    expect(field.style.height).toBe("60px");

    // Acima do teto (200px): satura, nunca ultrapassa.
    setScrollHeight(field, 500);
    rerender(<MathInput id="expr" value={"linha\n".repeat(20)} onChange={vi.fn()} />);
    expect(field.style.height).toBe("200px");
  });

  it("onChange do usuário continua funcionando normalmente", () => {
    const onChange = vi.fn();
    render(<MathInput id="expr" value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x=2" } });
    expect(onChange).toHaveBeenCalledWith("x=2");
  });

  it("encaminha a ref para o nó real do textarea (focus/setSelectionRange continuam funcionando)", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<MathInput ref={ref} id="expr" value="abc" onChange={vi.fn()} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    ref.current?.focus();
    expect(document.activeElement).toBe(ref.current);
    expect(() => ref.current?.setSelectionRange(1, 1)).not.toThrow();
  });

  it("preserva aria-describedby/aria-invalid/placeholder", () => {
    render(
      <MathInput
        id="expr"
        value=""
        onChange={vi.fn()}
        placeholder="Digite uma expressão"
        ariaDescribedBy="err"
        ariaInvalid
      />
    );
    const field = screen.getByRole("textbox");
    expect(field).toHaveAttribute("aria-describedby", "err");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAttribute("placeholder", "Digite uma expressão");
  });
});
