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
    // usadas pelos handlers de clique — nunca a lógica de layout real do
    // MathLive (só testada no navegador real, ver relatório do hotfix).
    lastOffset = 0;
    selectionIsCollapsed = true;
    mockBounds = new Map<
      number,
      { latex?: string; depth?: number; bounds: { x: number; y: number; width: number; height: number } | null }
    >();
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

    // Hotfix P0 (2ª rodada) — `handleFieldClick` (`StructuredMathInput.tsx`)
    // agora delega inteiramente a `field.getOffsetFromPoint(x, y)` (a API
    // pública e nativa do MathLive) em vez de uma heurística própria — o
    // mock só precisa devolver o offset configurado por cada teste,
    // registrando os argumentos recebidos pra provar que as coordenadas
    // do clique real chegaram até a API sem transformação.
    getOffsetFromPointCalls: Array<{ x: number; y: number }> = [];
    mockOffsetFromPoint: number | null = null;

    getOffsetFromPoint(x: number, y: number): number {
      this.getOffsetFromPointCalls.push({ x, y });
      return this.mockOffsetFromPoint ?? -1;
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

  // --- Hotfix P0 (2ª rodada) — Cursor via API nativa do MathLive -----------
  //
  // `handleFieldClick` agora delega inteiramente a
  // `field.getOffsetFromPoint(x, y)` (API pública do MathLive) em vez de
  // uma heurística própria de distância — os testes abaixo provam (a)
  // que as coordenadas do clique chegam intactas até a API, (b) que o
  // offset devolvido é aplicado a `field.position`, e (c) que devoluções
  // inválidas (fora do intervalo, ou o `-1` que a própria API usa pra
  // "nenhuma posição") nunca movem o cursor — nunca testa a geometria
  // interna do MathLive em si (isso é do fornecedor, testado no navegador
  // real, ver relatório do hotfix).
  type MockFieldWithClickSupport = MockFieldWithSetValue & {
    lastOffset: number;
    selectionIsCollapsed: boolean;
    positionSetCalls: number[];
    position: number;
    getOffsetFromPointCalls: Array<{ x: number; y: number }>;
    mockOffsetFromPoint: number | null;
    mockBounds: Map<
      number,
      { latex?: string; depth?: number; bounds: { x: number; y: number; width: number; height: number } | null }
    >;
  };

  it("clique dentro do campo delega pra field.getOffsetFromPoint com as coordenadas exatas do clique", () => {
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={vi.fn()} />);
    const field = getField(container) as unknown as MockFieldWithClickSupport;
    field.value = "x^2";
    field.lastOffset = 4;
    field.mockOffsetFromPoint = 4;

    field.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 123, clientY: 45 }));

    expect(field.getOffsetFromPointCalls).toEqual([{ x: 123, y: 45 }]);
    expect(field.position).toBe(4);
  });

  // Hotfix P0 (2ª rodada — dump real do usuário) — reprodução do bug
  // capturado no navegador real: em `\int x^2e^2\,dx`, um clique visado
  // logo depois de "x²" (querendo continuar no nível principal) resolvia
  // pro offset 2 (`latex:"x"`, o nó BASE — antes até do expoente),
  // confirmado via `math-field.getElementInfo`/`.position` reais colados
  // pelo usuário. Investigação (ver `resolveClickOffset` em
  // `StructuredMathInput.tsx`) confirmou que `field.getOffsetFromPoint`
  // chamada diretamente resolve esse caso corretamente pro offset da
  // SAÍDA da potência (offset 4 pra `x^2`, `depth:0, latex:"^2"`) — este
  // teste fixa que o componente CONFIA nesse retorno sem reprocessar ou
  // sobrepor com uma heurística própria (a causa raiz do bug antigo).
  it("REGRESSÃO (dump real) — clique à direita de x² nunca fica preso no nó base, usa o offset de saída que getOffsetFromPoint devolve", () => {
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={vi.fn()} />);
    const field = getField(container) as unknown as MockFieldWithClickSupport;
    field.value = "\\int x^2e^2\\,dx";
    field.lastOffset = 9;
    field.mockOffsetFromPoint = 4; // saída da potência, confirmada no navegador real

    field.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 95, clientY: 150 }));

    expect(field.position).toBe(4);
    expect(field.position).not.toBe(2); // o offset do nó base — o bug real relatado
  });

  // Hotfix P0 (2ª rodada) — `preferGroupExitBeyondContent`: geometria
  // real capturada no navegador (`getElementInfo`) pra
  // `\frac{x^2-9}{x^2+1}` — clicar no espaço vazio entre o dígito "2" do
  // expoente do numerador (offset 4, bounds reais terminam em x≈72.16) e
  // o "-" seguinte (offset 6, começa em x≈78.17) fazia
  // `field.getOffsetFromPoint` sozinha devolver o offset 4 (dentro do
  // expoente) — confirmado no navegador real. A correção detecta que o
  // clique (x=74) está À DIREITA da bounding box do offset 4 e que o
  // offset seguinte (5, `^2`, sem bounds própria) é mais RASO (depth 1 <
  // depth 2) — promove pro offset 5, o nível do numerador, exatamente
  // onde `x²|` deveria ficar antes de "-9".
  it("clique no espaço vazio depois do expoente do numerador de uma fração sai pro nível do numerador, não fica preso no expoente", () => {
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={vi.fn()} />);
    const field = getField(container) as unknown as MockFieldWithClickSupport;
    field.value = "\\frac{x^2-9}{x^2+1}";
    field.lastOffset = 15;
    field.mockBounds = new Map([
      [4, { latex: "2", depth: 2, bounds: { x: 66.15625, y: 140.46875, width: 6, height: 14 } }],
      [5, { latex: "^2", depth: 1, bounds: null }],
      [6, { latex: "-", depth: 1, bounds: { x: 78.171875, y: 141.9375, width: 13, height: 21 } }],
    ]);
    field.mockOffsetFromPoint = 4;

    field.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 74, clientY: 147 }));

    expect(field.position).toBe(5);
  });

  // Confirma a guarda oposta: um clique AINDA dentro (ou antes) da
  // bounding box do próprio dígito nunca promove pro nível pai — cobre o
  // item 5 do ticket ("não aplicar isso se o clique for... sobre o
  // expoente; dentro do expoente").
  it("clique ainda dentro da bounding box do dígito do expoente nunca promove pro nível pai", () => {
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={vi.fn()} />);
    const field = getField(container) as unknown as MockFieldWithClickSupport;
    field.value = "\\frac{x^2-9}{x^2+1}";
    field.lastOffset = 15;
    field.mockBounds = new Map([
      [4, { latex: "2", depth: 2, bounds: { x: 66.15625, y: 140.46875, width: 6, height: 14 } }],
      [5, { latex: "^2", depth: 1, bounds: null }],
    ]);
    field.mockOffsetFromPoint = 4;

    field.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 68, clientY: 147 }));

    expect(field.position).toBe(4);
  });

  // A promoção só acontece quando o offset seguinte é genuinamente uma
  // SAÍDA de grupo (sem bounds própria E mais raso) — nunca quando o
  // próximo offset é só outro átomo real normal (ex. fim do campo, sem
  // mais nada estrutural pra sair).
  it("clique à direita de um átomo comum (sem saída de grupo estrutural seguinte) não promove offset", () => {
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={vi.fn()} />);
    const field = getField(container) as unknown as MockFieldWithClickSupport;
    field.value = "x+3";
    field.lastOffset = 3;
    field.mockBounds = new Map([[3, { latex: "3", bounds: { x: 80, y: 140, width: 8, height: 17 } }]]);
    field.mockOffsetFromPoint = 3;

    field.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 200, clientY: 147 }));

    expect(field.position).toBe(3);
  });

  it("getOffsetFromPoint devolvendo -1 (nenhuma posição, sentinela da própria API) nunca move o cursor", () => {
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={vi.fn()} />);
    const field = getField(container) as unknown as MockFieldWithClickSupport;
    field.value = "x^2";
    field.lastOffset = 4;
    field.mockOffsetFromPoint = -1;

    field.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 95, clientY: 150 }));

    expect(field.positionSetCalls).toHaveLength(0);
  });

  it("getOffsetFromPoint devolvendo um offset fora do intervalo válido (> lastOffset) nunca move o cursor", () => {
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={vi.fn()} />);
    const field = getField(container) as unknown as MockFieldWithClickSupport;
    field.value = "x^2";
    field.lastOffset = 4;
    field.mockOffsetFromPoint = 99;

    field.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 95, clientY: 150 }));

    expect(field.positionSetCalls).toHaveLength(0);
  });

  it("seleção em andamento (arrasto do usuário) nunca é colapsada por um clique — nem chama getOffsetFromPoint", () => {
    const { container } = render(<StructuredMathInput id="campo" value="" onChange={vi.fn()} />);
    const field = getField(container) as unknown as MockFieldWithClickSupport;
    field.value = "x^2";
    field.lastOffset = 4;
    field.mockOffsetFromPoint = 4;
    field.selectionIsCollapsed = false;

    field.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 95, clientY: 150 }));

    expect(field.positionSetCalls).toHaveLength(0);
    expect(field.getOffsetFromPointCalls).toHaveLength(0);
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
    field.value = "x^2";
    field.lastOffset = 4;
    field.mockOffsetFromPoint = 1;

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

  // --- Hotfix P0 (3ª rodada) — expoente fresco não nasce letra dentro ------
  //
  // Bug real confirmado no navegador: `x` -> clicar "xⁿ" -> digitar "2"
  // (fica dentro, esperado) -> digitar "e" SEM sair primeiro -> MathLive
  // deixa "e" DENTRO do expoente (`x^{2e}`), porque `smartSuperscript` da
  // própria biblioteca só cobre dígito sozinho (lido no código-fonte:
  // `atom.parentBranch === "superscript" && /\d/.test(c)` — nunca letra).
  // `handleKeyDown` (`StructuredMathInput.tsx`) complementa isso sem tocar
  // em `node_modules`: liga uma flag SÓ quando `api.insert()` insere
  // EXATAMENTE o template da tecla "xⁿ" (`^{\placeholder{}}`), e o
  // primeiro caractere não-dígito digitado em seguida (sem clique/seta no
  // meio) aciona `moveToNextChar` antes da inserção. Testado aqui via
  // `executeCommand`/`getElementInfo`/`position` do mock — a inserção real
  // do caractere em si é do MathLive de verdade, testada no navegador
  // real (ver relatório do hotfix).
  async function buildFreshExponentField(onReady = vi.fn()) {
    const onChange = vi.fn();
    const { container } = render(
      <StructuredMathInput id="campo" value="" onChange={onChange} onReady={onReady} />
    );
    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    const api = onReady.mock.calls[0][0] as StructuredMathInputApi;
    const field = getField(container) as unknown as MockFieldWithClickSupport;
    return { api, field, onChange };
  }

  it("dígito seguido de letra, sem sair do expoente fresco antes: aciona moveToNextChar antes da letra", async () => {
    const { api, field } = await buildFreshExponentField();
    api.insert("^{\\placeholder{}}"); // clique na tecla "xⁿ"

    field.lastOffset = 4;
    field.mockBounds = new Map([
      [3, { latex: "2", depth: 1, bounds: { x: 10, y: 10, width: 5, height: 10 } }],
    ]);
    field.position = 3; // dígito "2" já digitado, cursor ainda dentro (depth 1)

    field.dispatchEvent(new KeyboardEvent("keydown", { key: "2", bubbles: true, cancelable: true }));
    expect(field.lastExecutedCommand).toBeNull(); // dígito nunca força saída

    field.dispatchEvent(new KeyboardEvent("keydown", { key: "e", bubbles: true, cancelable: true }));
    expect(field.lastExecutedCommand).toBe("moveToNextChar");
  });

  it("dígito seguido de outro dígito continua acumulando dentro do expoente (preserva x^23)", async () => {
    const { api, field } = await buildFreshExponentField();
    api.insert("^{\\placeholder{}}");
    field.lastOffset = 4;
    field.mockBounds = new Map([[3, { latex: "2", depth: 1, bounds: { x: 10, y: 10, width: 5, height: 10 } }]]);
    field.position = 3;

    field.dispatchEvent(new KeyboardEvent("keydown", { key: "2", bubbles: true, cancelable: true }));
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "3", bubbles: true, cancelable: true }));

    expect(field.lastExecutedCommand).toBeNull();
  });

  it("dígito seguido de operador (+) também aciona a saída (regra estrutural, não amarrada a letras)", async () => {
    const { api, field } = await buildFreshExponentField();
    api.insert("^{\\placeholder{}}");
    field.lastOffset = 4;
    field.mockBounds = new Map([[3, { latex: "2", depth: 1, bounds: { x: 10, y: 10, width: 5, height: 10 } }]]);
    field.position = 3;

    field.dispatchEvent(new KeyboardEvent("keydown", { key: "2", bubbles: true, cancelable: true }));
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "+", bubbles: true, cancelable: true }));

    expect(field.lastExecutedCommand).toBe("moveToNextChar");
  });

  it("um clique entre o dígito e a letra desliga a saída automática — respeita a posição manual (x^(2e))", async () => {
    const { api, field } = await buildFreshExponentField();
    api.insert("^{\\placeholder{}}");
    field.lastOffset = 4;
    field.mockBounds = new Map([[3, { latex: "2", depth: 1, bounds: { x: 10, y: 10, width: 5, height: 10 } }]]);
    field.position = 3;
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "2", bubbles: true, cancelable: true }));

    field.mockOffsetFromPoint = 3; // clique manual resolve pro mesmo dígito
    field.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 12, clientY: 15 }));

    field.dispatchEvent(new KeyboardEvent("keydown", { key: "e", bubbles: true, cancelable: true }));
    expect(field.lastExecutedCommand).toBeNull(); // nunca força saída depois de um clique
  });

  it("Backspace entre o dígito e a letra desliga a flag sem forçar saída (nunca atropela uma edição explícita)", async () => {
    const { api, field } = await buildFreshExponentField();
    api.insert("^{\\placeholder{}}");
    field.lastOffset = 4;
    field.mockBounds = new Map([[3, { latex: "2", depth: 1, bounds: { x: 10, y: 10, width: 5, height: 10 } }]]);
    field.position = 3;
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "2", bubbles: true, cancelable: true }));

    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }));
    expect(field.lastExecutedCommand).toBeNull();

    // Flag já desligada — próxima letra nunca mais força saída sozinha.
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "e", bubbles: true, cancelable: true }));
    expect(field.lastExecutedCommand).toBeNull();
  });

  it("template de fração nunca liga a flag — dígito seguido de letra no numerador nunca força saída", async () => {
    const { api, field } = await buildFreshExponentField();
    api.insert("\\frac{\\placeholder{}}{\\placeholder{}}"); // clique na tecla "Inserir fração"
    field.lastOffset = 4;
    field.mockBounds = new Map([[1, { latex: "2", depth: 1, bounds: { x: 10, y: 10, width: 5, height: 10 } }]]);
    field.position = 1;

    field.dispatchEvent(new KeyboardEvent("keydown", { key: "2", bubbles: true, cancelable: true }));
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "e", bubbles: true, cancelable: true }));

    expect(field.lastExecutedCommand).toBeNull();
  });

  it("Espaço entre o dígito e a letra nunca aciona moveToNextChar (Hotfix V3.0.2a preservado — espaço continua no-op)", async () => {
    const { api, field } = await buildFreshExponentField();
    api.insert("^{\\placeholder{}}");
    field.lastOffset = 4;
    field.mockBounds = new Map([[3, { latex: "2", depth: 1, bounds: { x: 10, y: 10, width: 5, height: 10 } }]]);
    field.position = 3;
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "2", bubbles: true, cancelable: true }));

    field.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
    expect(field.lastExecutedCommand).toBeNull();
  });
});
