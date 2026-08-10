import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StructuredMathInput, type StructuredMathInputApi } from "./StructuredMathInput";

/**
 * `mathlive` real (o pacote de verdade) resolve, sob Vitest/Node, pra sua
 * própria build "SSR-safe" (`mathlive-ssr.min.mjs`, via a condição `node`
 * do `package.json` da lib) — inerte por design, sem a lógica real de
 * edição. Um mock local, mínimo, cobre só a superfície que
 * `StructuredMathInput` realmente usa (`value`, `insert()`,
 * `executeCommand()`, `mathVirtualKeyboardPolicy`, eventos
 * `input`/`keydown`) — suficiente pra testar O WRAPPER (nosso código),
 * não a biblioteca de terceiros. `executeCommand` é um espião simples
 * (registra o comando pedido) — a navegação REAL entre placeholders é
 * lógica do MathLive de verdade, testada no navegador real (ver
 * relatório da Sprint V3.0.1).
 */
vi.mock("mathlive", () => {
  class MockMathfieldElement extends HTMLElement {
    private _value = "";
    mathVirtualKeyboardPolicy = "auto";
    smartFence = false;
    smartSuperscript = false;
    lastExecutedCommand: string | null = null;
    nextExecuteCommandResult = true;

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

    executeCommand(command: string) {
      this.lastExecutedCommand = command;
      return this.nextExecuteCommandResult;
    }
  }
  if (!customElements.get("math-field")) {
    customElements.define("math-field", MockMathfieldElement);
  }
  return {};
});

function getField(container: HTMLElement): HTMLElement & { value: string } {
  const field = container.querySelector("math-field");
  if (!field) throw new Error("math-field não encontrado");
  return field as HTMLElement & { value: string };
}

describe("StructuredMathInput", () => {
  it("monta um <math-field> dentro do container e chama onReady com insert/focus", async () => {
    const onReady = vi.fn();
    const { container } = render(
      <StructuredMathInput id="campo" value="" onChange={vi.fn()} onReady={onReady} />
    );

    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    const api = onReady.mock.calls[0][0] as StructuredMathInputApi;
    expect(typeof api.insert).toBe("function");
    expect(typeof api.focus).toBe("function");
    expect(getField(container)).toBeInTheDocument();
  });

  it("propaga o value inicial pro campo", () => {
    const { container } = render(
      <StructuredMathInput id="campo" value="x^2" onChange={vi.fn()} />
    );
    expect(getField(container).value).toBe("x^2");
  });

  it("digitar (evento input do campo) chama onChange com o LaTeX atual", () => {
    const onChange = vi.fn();
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={onChange} />);

    const field = getField(container);
    field.value = "x^2-4=0";
    field.dispatchEvent(new Event("input"));

    expect(onChange).toHaveBeenCalledWith("x^2-4=0");
  });

  it("mudar o value externamente (exemplo/histórico/limpar) sincroniza o campo sem precisar de digitação", () => {
    const { container, rerender } = render(
      <StructuredMathInput id="campo" value="x" onChange={vi.fn()} />
    );
    expect(getField(container).value).toBe("x");

    // Valor atribuído a uma constante ANTES do JSX (nunca uma string-literal
    // inline com "\\" direto num atributo JSX): peculiaridade confirmada
    // desta stack (Vite + @vitejs/plugin-react-swc) em arquivo de teste com
    // múltiplos `it()` — uma string-literal JSX com backslash escapado,
    // repetida entre casos de teste do mesmo arquivo, pode ser duplicada
    // pelo transform (`"\\frac{1}{2}"` virando `"\\\\frac{1}{2}"` em
    // tempo de execução). Passar por variável evita o bug do transform sem
    // mudar o comportamento real do componente (confirmado isolando o
    // problema fora deste arquivo antes de aplicar o contorno).
    const fracLatex = "\\frac{1}{2}";
    rerender(<StructuredMathInput id="campo" value={fracLatex} onChange={vi.fn()} />);
    expect(getField(container).value).toBe(fracLatex);
  });

  it("api.insert() delega pro insert() real do campo (nunca concatenação de string por fora)", async () => {
    const onReady = vi.fn();
    const onChange = vi.fn();
    const { container } = render(
      <StructuredMathInput id="campo" value="" onChange={onChange} onReady={onReady} />
    );
    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));

    const api = onReady.mock.calls[0][0] as StructuredMathInputApi;
    api.insert("\\sqrt{\\placeholder{}}");

    expect(getField(container).value).toBe("\\sqrt{\\placeholder{}}");
    expect(onChange).toHaveBeenCalledWith("\\sqrt{\\placeholder{}}");
  });

  it("Ctrl+Enter dentro de um <form> dispara o submit (mesmo atalho do textarea legado)", () => {
    const { container } = render(
      <form>
        <StructuredMathInput id="campo" value="1+1" onChange={vi.fn()} />
        <button type="submit">Resolver</button>
      </form>
    );
    const form = container.querySelector("form")!;
    const requestSubmit = vi.fn();
    form.requestSubmit = requestSubmit;

    const field = getField(container);
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));

    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });

  it("Ctrl+Enter não faz nada quando o botão Resolver está desabilitado", () => {
    const { container } = render(
      <form>
        <StructuredMathInput id="campo" value="" onChange={vi.fn()} />
        <button type="submit" disabled>
          Resolver
        </button>
      </form>
    );
    const form = container.querySelector("form")!;
    const requestSubmit = vi.fn();
    form.requestSubmit = requestSubmit;

    const field = getField(container);
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));

    expect(requestSubmit).not.toHaveBeenCalled();
  });

  it("Enter sozinho (sem Ctrl/Cmd) não dispara submit", () => {
    const { container } = render(
      <form>
        <StructuredMathInput id="campo" value="1+1" onChange={vi.fn()} />
        <button type="submit">Resolver</button>
      </form>
    );
    const form = container.querySelector("form")!;
    const requestSubmit = vi.fn();
    form.requestSubmit = requestSubmit;

    const field = getField(container);
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(requestSubmit).not.toHaveBeenCalled();
  });

  // --- Sprint V3.0.1: Tab/Shift+Tab chamam moveToNextPlaceholder/moveToPreviousPlaceholder ---
  //
  // Achado da validação no navegador real: depois de `insert()` selecionar
  // o primeiro `\placeholder{}`, a tecla Tab física nem sempre avança pro
  // PRÓXIMO placeholder sozinha em estruturas com vários slots (ex.
  // integral definida) — mas os comandos nativos do MathLive
  // (`moveToNextPlaceholder`/`moveToPreviousPlaceholder`) sempre funcionam
  // quando chamados direto. Este componente passou a chamá-los
  // explicitamente no `keydown` do Tab.

  type MockField = HTMLElement & {
    lastExecutedCommand: string | null;
    nextExecuteCommandResult: boolean;
  };

  it("Tab chama moveToNextPlaceholder (comando nativo do MathLive) e previne o Tab padrão quando há um próximo slot", () => {
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={vi.fn()} />);
    const field = getField(container) as unknown as MockField;

    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    field.dispatchEvent(event);

    expect(field.lastExecutedCommand).toBe("moveToNextPlaceholder");
    expect(event.defaultPrevented).toBe(true);
  });

  it("Shift+Tab chama moveToPreviousPlaceholder", () => {
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={vi.fn()} />);
    const field = getField(container) as unknown as MockField;

    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));

    expect(field.lastExecutedCommand).toBe("moveToPreviousPlaceholder");
  });

  it("sem mais placeholders (comando devolve false), o Tab NÃO é interceptado — sai do campo normalmente (acessibilidade)", () => {
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={vi.fn()} />);
    const field = getField(container) as unknown as MockField;
    field.nextExecuteCommandResult = false;

    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    field.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  // --- Hotfix V3.0.1a: teclado virtual do MathLive fica inacessível -------

  it("mathVirtualKeyboardPolicy é 'manual' — nunca abre sozinho no foco", async () => {
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={vi.fn()} />);
    const field = getField(container) as unknown as { mathVirtualKeyboardPolicy: string };
    await waitFor(() => expect(field.mathVirtualKeyboardPolicy).toBe("manual"));
  });

  it("injeta CSS ocultando o ícone de abrir o teclado virtual (::part(virtual-keyboard-toggle))", () => {
    render(<StructuredMathInput id="campo" value="" onChange={vi.fn()} />);

    const style = document.getElementById("structured-math-input-hide-virtual-keyboard-toggle");
    expect(style).not.toBeNull();
    expect(style?.textContent).toContain("virtual-keyboard-toggle");
    expect(style?.textContent).toContain("display: none");
  });

  it("a injeção do CSS é idempotente — só uma tag <style>, mesmo com vários campos montados", () => {
    render(
      <>
        <StructuredMathInput id="campo-1" value="" onChange={vi.fn()} />
        <StructuredMathInput id="campo-2" value="" onChange={vi.fn()} />
      </>
    );

    expect(
      document.querySelectorAll("#structured-math-input-hide-virtual-keyboard-toggle")
    ).toHaveLength(1);
  });

  it("aria-describedby/aria-invalid são refletidos no elemento real", () => {
    const { container, rerender } = render(
      <StructuredMathInput id="campo" value="" onChange={vi.fn()} ariaDescribedBy="erro-1" ariaInvalid={false} />
    );
    const field = getField(container);
    expect(field.getAttribute("aria-describedby")).toBe("erro-1");
    expect(field.getAttribute("aria-invalid")).toBe("false");

    rerender(
      <StructuredMathInput id="campo" value="" onChange={vi.fn()} ariaDescribedBy="erro-1" ariaInvalid={true} />
    );
    expect(field.getAttribute("aria-invalid")).toBe("true");
  });
});
