import { createRef } from "react";

import { render } from "@testing-library/react";
import katex from "katex";
import { describe, expect, it, vi } from "vitest";

import { MathFormula } from "./MathFormula";

describe("MathFormula", () => {
  it("renderiza LaTeX válido como markup KaTeX", () => {
    const { container } = render(<MathFormula formula="\frac{a+b}{c+d}" />);
    expect(container.querySelector(".katex")).not.toBeNull();
  });

  it("renderiza inline por padrão e em bloco com displayMode", () => {
    const inline = render(<MathFormula formula="x^2" />);
    expect(inline.container.querySelector(".katex-display")).toBeNull();

    const block = render(<MathFormula formula="x^2" displayMode />);
    expect(block.container.querySelector(".katex-display")).not.toBeNull();
  });

  it("embute MathML com o LaTeX original para leitores de tela", () => {
    const { container } = render(<MathFormula formula="\int_0^1 x^2\,dx" displayMode />);
    const annotation = container.querySelector("annotation");
    expect(annotation?.getAttribute("encoding")).toBe("application/x-tex");
    expect(annotation?.textContent).toBe("\\int_0^1 x^2\\,dx");
  });

  it("não lança para LaTeX inválido — degrada para exibição do código-fonte", () => {
    expect(() => render(<MathFormula formula="\frac{a" />)).not.toThrow();
    const { container } = render(<MathFormula formula="\frac{a" />);
    expect(container.textContent).toContain("\\frac{a");
  });

  it("propaga className para o wrapper", () => {
    const { container } = render(<MathFormula formula="x" className="text-text-secondary" />);
    expect(container.querySelector(".text-text-secondary")).not.toBeNull();
  });

  // --- Sprint V2.1, BUG 1: fórmulas longas não podem vazar do container ---

  it("por padrão, inline NÃO ganha rolagem própria (preserva o comportamento de rótulos pequenos, ex. FunctionList)", () => {
    const { container } = render(<MathFormula formula="x^2" />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.tagName).toBe("SPAN");
    expect(wrapper?.className).not.toContain("overflow-x-auto");
    expect(wrapper?.className).not.toContain("max-w-full");
  });

  it("scrollable=true envolve o inline num wrapper com rolagem horizontal própria (não vaza do container)", () => {
    const { container } = render(<MathFormula formula="x^2" scrollable />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.tagName).toBe("SPAN");
    expect(wrapper?.className).toContain("overflow-x-auto");
    expect(wrapper?.className).toContain("max-w-full");
    // display:block via CLASSE, não via tag — continua HTML válido dentro de <p>.
    expect(wrapper?.className).toContain("block");
  });

  it("wrapper em bloco (displayMode) também permite rolagem horizontal própria", () => {
    const { container } = render(<MathFormula formula="x^2" displayMode />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.tagName).toBe("DIV");
    expect(wrapper?.className).toContain("overflow-x-auto");
    expect(wrapper?.className).toContain("max-w-full");
  });

  it("não trunca fórmulas longas — o MathML/anotação preserva o LaTeX completo", () => {
    const longFormula = Array.from({ length: 30 }, (_, i) => `\\sin(${i + 1})`).join(" + ");
    const { container } = render(<MathFormula formula={longFormula} scrollable />);
    const annotation = container.querySelector("annotation");
    expect(annotation?.textContent).toBe(longFormula);
  });

  // --- Sprint V2.1 (apresentação progressiva): ref encaminhada para o
  // elemento raiz de fato renderizado, usada por `ProgressiveMathResult`
  // para medir overflow real via `useIsOverflowing`.

  it("encaminha a ref para o span raiz (inline)", () => {
    const ref = createRef<HTMLElement>();
    render(<MathFormula formula="x^2" scrollable ref={ref} />);
    expect(ref.current?.tagName).toBe("SPAN");
    expect(ref.current?.className).toContain("overflow-x-auto");
  });

  it("encaminha a ref para o div raiz (displayMode)", () => {
    const ref = createRef<HTMLElement>();
    render(<MathFormula formula="x^2" displayMode ref={ref} />);
    expect(ref.current?.tagName).toBe("DIV");
  });

  it("encaminha a ref para o <code> de fallback (katex.renderToString lança de verdade)", () => {
    // `throwOnError:false` faz o KaTeX absorver quase todo erro de sintaxe
    // renderizando o próprio texto em cor de erro (não lança) — o caminho
    // `<code>` só é alcançado se `renderToString` lançar mesmo assim.
    const spy = vi.spyOn(katex, "renderToString").mockImplementation(() => {
      throw new Error("boom");
    });
    const ref = createRef<HTMLElement>();
    render(<MathFormula formula="x" ref={ref} />);
    expect(ref.current?.tagName).toBe("CODE");
    spy.mockRestore();
  });

  // --- Correção de layout (card cortando o alto/baixo de matrizes/frações
  // em modo scrollable/displayMode): `overflow-y-hidden` clipava conteúdo
  // KaTeX que visualmente ultrapassa a caixa calculada em fluxo normal
  // (delimitadores de matriz, barras de fração). Nenhum dos dois wrappers
  // com `overflow-x-auto` pode ter `overflow-y-hidden`/`overflow-y-*`
  // nenhum — a defesa contra corte vertical passa a ser estrutural: o HTML
  // do KaTeX nunca é filho DIRETO do wrapper com overflow-x, e sim de um
  // wrapper interno comum, sem NENHUMA propriedade de overflow própria. ---

  describe("correção de corte vertical (matrizes/frações em scrollable/displayMode)", () => {
    it("scrollable: o wrapper externo nunca tem overflow-y-hidden nem qualquer overflow-y", () => {
      const { container } = render(<MathFormula formula="\begin{bmatrix}1&2\\3&4\end{bmatrix}" scrollable />);
      const outer = container.firstElementChild;
      expect(outer?.className).not.toMatch(/overflow-y/);
      expect(outer?.className).toContain("overflow-x-auto");
    });

    it("displayMode: o wrapper externo nunca tem overflow-y-hidden nem qualquer overflow-y", () => {
      const { container } = render(
        <MathFormula formula="\begin{bmatrix}1&2\\3&4\end{bmatrix}" displayMode />
      );
      const outer = container.firstElementChild;
      expect(outer?.className).not.toMatch(/overflow-y/);
      expect(outer?.className).toContain("overflow-x-auto");
    });

    it("scrollable: o HTML do KaTeX não é filho direto do wrapper externo — vai num wrapper interno sem overflow próprio", () => {
      const { container } = render(<MathFormula formula="x^2" scrollable />);
      const outer = container.firstElementChild;
      const katex = container.querySelector(".katex");
      expect(katex?.parentElement).not.toBe(outer);
      expect(katex?.parentElement?.parentElement).toBe(outer);
      // o wrapper interno é o pai direto do `.katex` — não pode ter
      // NENHUMA propriedade de overflow própria (visible é o padrão).
      expect(katex?.parentElement?.className).not.toMatch(/overflow/);
      expect(katex?.parentElement?.className).toContain("inline-block");
    });

    it("displayMode: o wrapper interno (pai de .katex-display) não é o wrapper externo e não tem overflow próprio", () => {
      const { container } = render(<MathFormula formula="x^2" displayMode />);
      const outer = container.firstElementChild;
      // Em displayMode o próprio KaTeX insere um `.katex-display` (span) em
      // volta de `.katex` — o wrapper INTERNO deste componente é o pai
      // desse `.katex-display`, não o pai direto de `.katex`.
      const katexDisplay = container.querySelector(".katex-display");
      const inner = katexDisplay?.parentElement;
      expect(inner).not.toBe(outer);
      expect(inner?.parentElement).toBe(outer);
      expect(inner?.className).not.toMatch(/overflow/);
    });

    it("preserva a folga pr-1 (evita falso overflow horizontal por arredondamento sub-pixel) nos dois modos", () => {
      const scrollable = render(<MathFormula formula="x^2" scrollable />);
      expect(scrollable.container.firstElementChild?.className).toContain("pr-1");

      const display = render(<MathFormula formula="x^2" displayMode />);
      expect(display.container.firstElementChild?.className).toContain("pr-1");
    });

    it("a ref continua apontando para o wrapper EXTERNO (overflow-x-auto) — useIsOverflowing mede scrollWidth/clientWidth nele", () => {
      const scrollableRef = createRef<HTMLElement>();
      render(<MathFormula formula="x^2" scrollable ref={scrollableRef} />);
      expect(scrollableRef.current?.className).toContain("overflow-x-auto");

      const displayRef = createRef<HTMLElement>();
      render(<MathFormula formula="x^2" displayMode ref={displayRef} />);
      expect(displayRef.current?.className).toContain("overflow-x-auto");
    });

    it("uma matriz 2x2 renderiza o mtable completo (sem nó ausente) em scrollable e displayMode", () => {
      const formula = "\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}";
      const scrollable = render(<MathFormula formula={formula} scrollable />);
      expect(scrollable.container.querySelector(".katex .mtable")).not.toBeNull();

      const display = render(<MathFormula formula={formula} displayMode />);
      expect(display.container.querySelector(".katex .mtable")).not.toBeNull();
    });

    /**
     * Regressão de uma barra de rolagem vertical FALSA (não corte): mesmo
     * sem `overflow-y-hidden`, o wrapper externo (overflow-x-auto) tem seu
     * overflow-y computado como "auto" pela especificação CSS (mistura de
     * eixos), então uns poucos pixels de folga do "vlist"/strut interno do
     * KaTeX em matrizes com fração ou 3+ linhas já contam como overflow
     * real e disparam uma barra vertical indevida. Confirmado empiricamente
     * (Chrome headless real, KaTeX renderizado de verdade, não jsdom — que
     * não faz layout de caixa real): `py-1` (4px) no wrapper interno NÃO
     * fecha essa folga para `transpose([[1,2,3],[4,5,6]])` (3 linhas,
     * scrollHeight 89 vs clientHeight 86) nem para `inv([[2,0],[0,2]])`
     * (frações, 62 vs 60); `py-2` (8px) fecha nos dois casos
     * (scrollHeight === clientHeight). jsdom não mede layout real, então
     * este teste só verifica a CLASSE (regressão de reverter para `py-1`
     * por engano) — a validação de pixel foi feita fora da suíte, num
     * repro HTML isolado com KaTeX real.
     */
    it("o wrapper interno usa py-2 (não py-1) — folga vertical validada empiricamente para matrizes com fração/3+ linhas", () => {
      const scrollable = render(<MathFormula formula="x^2" scrollable />);
      const scrollableInner = scrollable.container.querySelector(".katex")?.parentElement;
      expect(scrollableInner?.className).toContain("py-2");
      expect(scrollableInner?.className).not.toContain("py-1");

      const display = render(<MathFormula formula="x^2" displayMode />);
      const displayInner = display.container.querySelector(".katex-display")?.parentElement;
      expect(displayInner?.className).toContain("py-2");
      expect(displayInner?.className).not.toContain("py-1");
    });
  });
});
