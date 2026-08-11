import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StructuredMathInput, type StructuredMathInputApi } from "./StructuredMathInput";

/**
 * `mathlive` real (o pacote de verdade) resolve, sob Vitest/Node, pra sua
 * própria build "SSR-safe" (`mathlive-ssr.min.mjs`, via a condição `node`
 * do `package.json` da lib) — inerte por design, sem a lógica real de
 * edição. Um mock local, mínimo, cobre só a superfície que
 * `StructuredMathInput` realmente usa (`value`, `insert()`, `setValue()`,
 * `executeCommand()`, `mathVirtualKeyboardPolicy`, eventos
 * `input`/`keydown`) — suficiente pra testar O WRAPPER (nosso código),
 * não a biblioteca de terceiros. `executeCommand`/`setValue` são espiões
 * simples (registram o que foi pedido) — a navegação REAL entre
 * placeholders, e o comportamento REAL de "sair do ambiente inteiro" na
 * barra de espaço (Hotfix V3.0.2a), são lógica do MathLive de verdade,
 * testados no navegador real (ver relatório do hotfix).
 */
vi.mock("mathlive", () => {
  class MockMathfieldElement extends HTMLElement {
    private _value = "";
    mathVirtualKeyboardPolicy = "auto";
    smartFence = false;
    smartSuperscript = false;
    lastExecutedCommand: string | null = null;
    nextExecuteCommandResult = true;
    lastSetValueCall: { value: string; options: unknown } | null = null;

    get value() {
      return this._value;
    }

    set value(v: string) {
      this._value = v;
    }

    // Hotfix V3.0.2c — achado do navegador real: `field.insert()` (chamado
    // por TODO clique de tecla do `MathKeyboard`, via `api.insert()`) NÃO
    // dispara um evento `input` visível a `addEventListener("input", ...)`
    // — só digitação física dispara. Este mock reflete esse contrato real
    // (nunca despachando `input` sozinho) para que os testes provem que o
    // reparo em `api.insert()` (`StructuredMathInput.tsx`) é acionado pela
    // chamada EXPLÍCITA do componente, não por um evento que na vida real
    // nunca chegaria.
    insert(latex: string) {
      this._value += latex;
      return true;
    }

    // Hotfix V3.0.2a — usado por `handleInput` pra corrigir o campo depois
    // do reparo textual (`repairMathLiveEnvironmentEscape`), sem disparar
    // um novo `input` sozinho (a chamada em `handleInput` já dispara
    // `onChangeRef.current` explicitamente depois) — mesmo contrato do
    // `setValue` real (não redispara `input`).
    setValue(value: string, options?: unknown) {
      this.lastSetValueCall = { value, options };
      this._value = value;
    }

    executeCommand(command: string) {
      this.lastExecutedCommand = command;
      return this.nextExecuteCommandResult;
    }

    // Hotfix — Cursor e navegação estrutural: mocks mínimos das APIs reais
    // usadas por `computeBestOffset`/`cursorPointForOffset` e pelos
    // handlers de clique — nunca a lógica de layout real do MathLive (só
    // testada no navegador real, ver relatório do hotfix). `mockBounds`
    // deixa cada teste descrever a MESMA geometria capturada de verdade
    // (`getElementInfo` real) sem depender de um layout engine.
    lastOffset = 0;
    selectionIsCollapsed = true;
    mockBounds = new Map<number, { latex?: string; bounds: { x: number; y: number; width: number; height: number } | null }>();
    mockShadowHit: { classListLength: number } | null = null;
    positionSetCalls: number[] = [];
    private _position = 0;

    get position() {
      return this._position;
    }

    set position(value: number) {
      this._position = value;
      this.positionSetCalls.push(value);
    }

    getElementInfo(offset: number) {
      return this.mockBounds.get(offset);
    }

    get shadowRoot() {
      const hit = this.mockShadowHit;
      return {
        elementFromPoint: () => (hit ? ({ classList: { length: hit.classListLength } } as unknown as Element) : null),
      } as unknown as ShadowRoot;
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

  // --- Hotfix V3.0.2a — corrige ao vivo o "pulo pra fora do ambiente
  // inteiro" que a barra de espaço do MathLive causa dentro de
  // `\begin{cases|bmatrix|...}` (ver `mathfield-to-backend.ts`). O valor
  // malformado usado abaixo é exatamente o que o MathLive real produz
  // (capturado via `math-field.value` no navegador real) — simulado aqui
  // atribuindo `.value` direto no mock e disparando `input`, do mesmo
  // jeito que o campo real dispararia depois do MathLive processar a
  // barra de espaço sozinho.
  type MockFieldWithSetValue = HTMLElement & {
    value: string;
    lastSetValueCall: { value: string; options: unknown } | null;
    lastExecutedCommand: string | null;
  };

  it("campo malformado por um pulo de ambiente (barra de espaço) é corrigido ao vivo via setValue — sem executeCommand extra por cima", () => {
    const onChange = vi.fn();
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={onChange} />);
    const field = getField(container) as MockFieldWithSetValue;

    field.value = "\\begin{cases}x^2\\\\ \\placeholder{}\\end{cases}-4=0";
    field.dispatchEvent(new Event("input"));

    expect(field.lastSetValueCall?.value).toBe("\\begin{cases}x^2-4=0\\\\ \\placeholder{}\\end{cases}");
    // Achado da validação no navegador real: `setValue()` sozinho já
    // reposiciona corretamente no próximo `\placeholder{}` restante —
    // chamar `executeCommand("moveToNextPlaceholder")` por cima pulava
    // UMA célula/linha a mais (confirmado com sistema 3x3 e matriz 2x2)
    // — por isso NUNCA é chamado aqui.
    expect(field.lastExecutedCommand).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith("\\begin{cases}x^2-4=0\\\\ \\placeholder{}\\end{cases}");
  });

  it("campo já bem-formado (sem pulo de ambiente) nunca chama setValue — só o input normal", () => {
    const onChange = vi.fn();
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={onChange} />);
    const field = getField(container) as MockFieldWithSetValue;

    field.value = "x^2-4=0";
    field.dispatchEvent(new Event("input"));

    expect(field.lastSetValueCall).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith("x^2-4=0");
  });

  // --- Hotfix V3.0.2c — reparo acionado explicitamente em api.insert() ----

  it("api.insert() aciona o reparo mesmo sem o campo despachar 'input' sozinho (MathLive real não dispara input em insert() — só digitação física dispara)", async () => {
    const onReady = vi.fn();
    const onChange = vi.fn();
    const { container } = render(
      <StructuredMathInput id="campo" value="" onChange={onChange} onReady={onReady} />
    );
    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    const api = onReady.mock.calls[0][0] as StructuredMathInputApi;
    const field = getField(container) as MockFieldWithSetValue;

    api.insert("\\begin{cases}x^2\\\\ \\placeholder{}\\end{cases}-4=0");

    expect(field.lastSetValueCall?.value).toBe("\\begin{cases}x^2-4=0\\\\ \\placeholder{}\\end{cases}");
    expect(onChange).toHaveBeenLastCalledWith("\\begin{cases}x^2-4=0\\\\ \\placeholder{}\\end{cases}");
  });

  it("api.insert() com LaTeX já bem-formado nunca chama setValue — só o insert() normal do campo", async () => {
    const onReady = vi.fn();
    const onChange = vi.fn();
    const { container } = render(
      <StructuredMathInput id="campo" value="" onChange={onChange} onReady={onReady} />
    );
    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    const api = onReady.mock.calls[0][0] as StructuredMathInputApi;
    const field = getField(container) as MockFieldWithSetValue;

    api.insert("\\sqrt{\\placeholder{}}");

    expect(field.lastSetValueCall).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith("\\sqrt{\\placeholder{}}");
  });

  // --- Hotfix — Cursor e navegação estrutural ------------------------------
  //
  // Geometria abaixo (bounds de cada offset) é a CAPTURADA de verdade no
  // navegador real via `field.getElementInfo(offset)` pra
  // `\begin{cases}x^2\\ \placeholder{}\end{cases}` — nunca valores
  // idealizados. Offset 5 (`bounds: null`) é o marcador de fim-de-grupo do
  // expoente (logo depois de "x²", ainda dentro da primeira linha do
  // sistema) — a causa raiz real do bug: sem herança, nenhum candidato
  // representa "o fim da linha", e o clique cai sempre dentro do "2"
  // (offset 4). Clique real capturado (`math-field.value`/`position`
  // antes/depois) confirmou exatamente isso no navegador antes do reparo.
  type MockFieldWithClickSupport = MockFieldWithSetValue & {
    lastOffset: number;
    selectionIsCollapsed: boolean;
    mockBounds: Map<number, { latex?: string; bounds: { x: number; y: number; width: number; height: number } | null }>;
    mockShadowHit: { classListLength: number } | null;
    positionSetCalls: number[];
    position: number;
  };

  function setCasesWithPowerGeometry(field: MockFieldWithClickSupport) {
    field.value = "\\begin{cases}x^2\\\\ \\placeholder{}\\end{cases}";
    field.lastOffset = 8;
    field.mockBounds = new Map([
      [0, { latex: "", bounds: { x: 54, y: 157, width: -1, height: 23 } }],
      [1, { latex: "", bounds: { x: 69, y: 144, width: -1, height: 23 } }],
      [2, { latex: "x", bounds: { x: 69, y: 149, width: 9, height: 17 } }],
      [3, { latex: "", bounds: { x: 79, y: 143, width: -1, height: 17 } }],
      [4, { latex: "2", bounds: { x: 79, y: 145, width: 6, height: 14 } }],
      [5, { latex: "^2", bounds: null }],
      [6, { latex: "", bounds: { x: 69, y: 170, width: -1, height: 23 } }],
      [7, { latex: "\\placeholder{}", bounds: { x: 69, y: 172, width: 14, height: 21 } }],
      [8, { latex: "\\begin{cases}x^2\\\\ \\placeholder{}\\end{cases}", bounds: { x: 54, y: 144, width: 52, height: 54 } }],
    ]);
  }

  it("clique no espaço vazio à direita de 'x²' dentro de cases (elemento sem classe CSS — estrutural) pousa no fim da linha, nunca dentro do expoente", () => {
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={vi.fn()} />);
    const field = getField(container) as unknown as MockFieldWithClickSupport;
    setCasesWithPowerGeometry(field);
    field.mockShadowHit = { classListLength: 0 };

    field.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 95, clientY: 150 }));

    expect(field.position).toBe(5);
  });

  it("clique NORMAL sobre um glifo real (classe CSS presente) nunca aciona o recálculo — o MathLive continua 100% responsável", () => {
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={vi.fn()} />);
    const field = getField(container) as unknown as MockFieldWithClickSupport;
    setCasesWithPowerGeometry(field);
    field.mockShadowHit = { classListLength: 1 };

    field.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 72, clientY: 155 }));

    expect(field.positionSetCalls).toHaveLength(0);
  });

  it("seleção em andamento (arrasto do usuário) nunca é colapsada por um clique em espaço vazio", () => {
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={vi.fn()} />);
    const field = getField(container) as unknown as MockFieldWithClickSupport;
    setCasesWithPowerGeometry(field);
    field.mockShadowHit = { classListLength: 0 };
    field.selectionIsCollapsed = false;

    field.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 95, clientY: 150 }));

    expect(field.positionSetCalls).toHaveLength(0);
  });

  it("clique dentro de uma matriz com potência numa célula (mesma assinatura estrutural) também pousa no fim da célula, não dentro do expoente", () => {
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={vi.fn()} />);
    const field = getField(container) as unknown as MockFieldWithClickSupport;
    // Geometria real capturada pra `\begin{bmatrix}x^2&2\\3&4\end{bmatrix}`.
    field.value = "\\begin{bmatrix}x^2&2\\\\3&4\\end{bmatrix}";
    field.lastOffset = 12;
    field.mockBounds = new Map([
      [1, { latex: "", bounds: { x: 64, y: 140, width: -1, height: 23 } }],
      [2, { latex: "x", bounds: { x: 64, y: 145, width: 9, height: 17 } }],
      [3, { latex: "", bounds: { x: 74, y: 139, width: -1, height: 17 } }],
      [4, { latex: "2", bounds: { x: 74, y: 141, width: 6, height: 14 } }],
      [5, { latex: "^2", bounds: null }],
      [6, { latex: "", bounds: { x: 100, y: 140, width: -1, height: 23 } }],
      [7, { latex: "2", bounds: { x: 100, y: 142, width: 8, height: 21 } }],
    ]);
    field.mockShadowHit = { classListLength: 0 };

    field.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 90, clientY: 145 }));

    expect(field.position).toBe(5);
  });

  it("clique no padding do wrapper externo (fora do retângulo real do campo) foca e manda o cursor pro fim via moveToMathfieldEnd", () => {
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={vi.fn()} />);
    const field = getField(container) as unknown as MockFieldWithClickSupport;
    const wrapper = field.parentElement!;
    const focusSpy = vi.spyOn(field, "focus");

    wrapper.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 10, clientY: 10 }));

    expect(focusSpy).toHaveBeenCalled();
    expect(field.lastExecutedCommand).toBe("moveToMathfieldEnd");
  });

  it("clique cujo target já é o próprio campo (nunca o wrapper) não aciona moveToMathfieldEnd", () => {
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={vi.fn()} />);
    const field = getField(container) as unknown as MockFieldWithClickSupport;
    setCasesWithPowerGeometry(field);
    field.mockShadowHit = { classListLength: 1 };

    field.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 72, clientY: 155 }));

    expect(field.lastExecutedCommand).toBeNull();
  });

  it("Space continua sem nenhum efeito dentro de cases/matriz (Hotfix V3.0.2a preservado) — confirmado de novo no navegador real para este hotfix", () => {
    const onChange = vi.fn();
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={onChange} />);
    const field = getField(container) as unknown as MockFieldWithClickSupport;
    field.value = "\\begin{cases}x^2\\\\ \\placeholder{}\\end{cases}";

    const event = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    field.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(field.value).toBe("\\begin{cases}x^2\\\\ \\placeholder{}\\end{cases}");
    expect(onChange).not.toHaveBeenCalled();
  });
});
