import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resultToLatex } from "@/lib/math/to-latex";

import { HistoryPanel } from "./HistoryPanel";

const NOOP = vi.fn();

function item(expression: string, result: string, timestamp: string, approx: string | null = null) {
  return { expression, result, approx, timestamp };
}

type ResizeCallback = () => void;
let observedCallbacks: ResizeCallback[] = [];

class MockResizeObserver {
  callback: ResizeCallback;
  constructor(callback: ResizeCallback) {
    this.callback = callback;
    observedCallbacks.push(callback);
  }
  observe() {}
  disconnect() {}
}

function forceOverflow(node: Element): void {
  Object.defineProperty(node, "scrollWidth", { value: 400, configurable: true });
  Object.defineProperty(node, "clientWidth", { value: 200, configurable: true });
}

describe("HistoryPanel", () => {
  beforeAll(async () => {
    // Aquece o dynamic import do mathjs para os timeouts curtos abaixo serem confiáveis.
    await resultToLatex("x = 2");
  });

  it("mostra o estado vazio quando não há itens visíveis", () => {
    render(
      <HistoryPanel items={[]} hiddenTimestamps={new Set()} onSelect={NOOP} onHide={NOOP} />
    );
    expect(screen.getByText("Nenhuma expressão resolvida ainda.")).toBeInTheDocument();
  });

  it("promove expressão e resultado a KaTeX quando a conversão resolve", async () => {
    const { container } = render(
      <HistoryPanel
        items={[item("√8", "2√2", "2026-01-01T00:00:00Z")]}
        hiddenTimestamps={new Set()}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());
    const annotations = Array.from(container.querySelectorAll("annotation")).map(
      (node) => node.textContent
    );
    expect(annotations.some((latex) => latex?.includes("\\sqrt"))).toBe(true);
  });

  it("promove a expressão de geometria a KaTeX via Tier 2, mas mantém o resultado sem forma reconhecida como texto puro", async () => {
    const { container } = render(
      <HistoryPanel
        items={[
          item(
            "relacao_retas([(0,0),(1,0)],[(0,0),(0,1)])",
            "Relação entre as retas: Perpendiculares ⊥",
            "2026-01-01T00:00:00Z"
          ),
        ]}
        hiddenTimestamps={new Set()}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );

    // A EXPRESSÃO (entrada do usuário) agora passa pelo mesmo pipeline
    // tolerante do preview — nunca mais fica presa em texto cru.
    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());
    // O RESULTADO (rótulo vindo do backend, "Perpendiculares ⊥") continua
    // sem forma reconhecida em `resultToLatex` — comportamento intocado.
    expect(screen.getByText("Relação entre as retas: Perpendiculares ⊥")).toBeInTheDocument();
  });

  it("preserva reutilizar/ocultar com nome acessível em texto cru", async () => {
    const onSelect = vi.fn();
    const onHide = vi.fn();
    render(
      <HistoryPanel
        items={[item("2+2", "4", "2026-01-01T00:00:00Z")]}
        hiddenTimestamps={new Set()}
        onSelect={onSelect}
        onHide={onHide}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Reutilizar expressão: 2+2 igual a 4" }));
    expect(onSelect).toHaveBeenCalledWith("2+2");

    fireEvent.click(screen.getByRole("button", { name: "Ocultar da lista: 2+2" }));
    expect(onHide).toHaveBeenCalledWith("2026-01-01T00:00:00Z");
  });

  // --- Sprint V2.1, BUG 1: mesmo tratamento de overflow do ResultPanel ---

  it("resultado longo no histórico fica em wrapper com rolagem própria (min-w-0 na linha/botão), sem truncar", async () => {
    const longResult = Array.from({ length: 30 }, (_, i) => `sin(${i + 1})`).join(" + ");
    const { container } = render(
      <HistoryPanel
        items={[item("Σ(i=1..30) sin(i)", longResult, "2026-01-01T00:00:00Z")]}
        hiddenTimestamps={new Set()}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());

    // Correção de layout (card cortando matrizes/somas longas): o HTML do
    // KaTeX não é mais filho DIRETO do wrapper com `overflow-x-auto` — vai
    // num wrapper interno sem overflow próprio (ver `MathFormula.tsx`), um
    // nível a mais que antes.
    const formulaWrappers = Array.from(container.querySelectorAll(".katex")).map(
      (node) => node.parentElement?.parentElement
    );
    expect(formulaWrappers.length).toBeGreaterThan(0);
    for (const wrapper of formulaWrappers) {
      expect(wrapper?.className).toContain("overflow-x-auto");
      expect(wrapper?.className).toContain("max-w-full");
    }

    const button = screen.getByRole("button", { name: new RegExp(`Reutilizar expressão`) });
    expect(button.className).toContain("min-w-0");

    const annotations = Array.from(container.querySelectorAll("annotation")).map(
      (node) => node.textContent
    );
    expect(annotations.some((latex) => latex?.includes("sin") && latex.includes("30"))).toBe(true);
  });

  // --- Sprint V2.1 (apresentação progressiva): aproximação fixa, sem toggle ---

  describe("com aproximação (approx)", () => {
    beforeEach(() => {
      observedCallbacks = [];
      vi.stubGlobal("ResizeObserver", MockResizeObserver);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("com overflow real detectado, mostra a aproximação e NUNCA um botão de toggle (evitaria <button> dentro de <button>)", async () => {
      const { container } = render(
        <HistoryPanel
          items={[item("Σ(i=1..30) sin(i)", "sin(1) + sin(2)", "2026-01-01T00:00:00Z", "1.87")]}
          hiddenTimestamps={new Set()}
          onSelect={NOOP}
          onHide={NOOP}
        />
      );

      await waitFor(() => expect(container.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(2));

      // A expressão (1º ProgressiveMathResult) nunca recebe approx — só o
      // segmento do RESULTADO (2º KaTeX renderizado) é relevante aqui.
      // `.parentElement.parentElement` (não só `.parentElement`): o wrapper
      // com a ref/overflow-x-auto que `useIsOverflowing` observa é o AVÔ do
      // `.katex` agora, não o pai (ver `MathFormula.tsx`).
      const wrappers = Array.from(container.querySelectorAll(".katex")).map(
        (node) => node.parentElement?.parentElement
      );
      expect(wrappers.length).toBeGreaterThanOrEqual(2);
      forceOverflow(wrappers[1]!);
      act(() => {
        observedCallbacks.forEach((callback) => callback());
      });

      expect(await screen.findByText("≈ 1.87")).toBeInTheDocument();
      // só o botão "Reutilizar"/"Ocultar" do item — nenhum toggle aninhado.
      const buttons = screen.getAllByRole("button").map((button) => button.textContent);
      expect(buttons.some((text) => text?.includes("Ver resultado exato"))).toBe(false);
    });

    it("sem overflow, mostra o valor exato normalmente (approx não usado)", async () => {
      render(
        <HistoryPanel
          items={[item("Σ(i=1..10) i", "55", "2026-01-01T00:00:00Z", "55.0000000000")]}
          hiddenTimestamps={new Set()}
          onSelect={NOOP}
          onHide={NOOP}
        />
      );

      await waitFor(() => expect(screen.getAllByText("55").length).toBeGreaterThan(0));
      expect(screen.queryByText(/^≈/)).not.toBeInTheDocument();
    });
  });

  it("item de matriz cujo resultado É a própria matriz mostra UMA cadeia só, nunca 'A = A' (Sprint V2.2 + hotfix pós-V2.7.1)", async () => {
    // Antes do hotfix este item renderizava "bmatrix = bmatrix" (expressão
    // e resultado idênticos, dois KaTeX separados por "="). A regra 6 do
    // hotfix (resultado igual à expressão, sem forma fechada) elimina o
    // eco redundante: uma única renderização.
    const { container } = render(
      <HistoryPanel
        items={[item("[[1,2],[3,4]]", "[[1, 2], [3, 4]]", "2026-01-01T00:00:00Z")]}
        hiddenTimestamps={new Set()}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(1));
    const annotations = Array.from(container.querySelectorAll("annotation")).map(
      (node) => node.textContent
    );
    expect(annotations.filter((latex) => latex?.includes("\\begin{bmatrix}"))).toHaveLength(1);
  });

  it("resultado de operação de matriz (det) continua com expressão = resultado separados", async () => {
    const { container } = render(
      <HistoryPanel
        items={[item("det([[1,2],[3,4]])", "-2", "2026-01-01T00:00:00Z")]}
        hiddenTimestamps={new Set()}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(2));
    const annotations = Array.from(container.querySelectorAll("annotation")).map(
      (node) => node.textContent
    );
    expect(annotations.some((latex) => latex?.includes("\\det"))).toBe(true);
  });

  // --- Hotfix pós-V2.7.1: dedução de combinatória não duplica a cabeça ---

  function normalizedAnnotations(container: HTMLElement): string[] {
    return Array.from(container.querySelectorAll("annotation")).map(
      (node) => node.textContent?.replace(/[\s~]|\\[,;:!]/g, "") ?? ""
    );
  }

  it("arranjo: dedução vira cadeia única, sem 'A_{20,6} = A_{20,6} = ...'", async () => {
    const { container } = render(
      <HistoryPanel
        items={[
          item("arranjo(20,6)", "A(20,6) = 20!/(20-6)! = 20!/14! = 27907200", "2026-01-01T00:00:00Z"),
        ]}
        hiddenTimestamps={new Set()}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(1));
    const [chain] = normalizedAnnotations(container);
    expect(chain.startsWith("A_{20,6}=")).toBe(true);
    expect(chain).toContain("=27907200");
    expect(chain.match(/A_\{20,6\}/g)).toHaveLength(1);
    // Layout: a fórmula única continua no wrapper com rolagem própria
    // (sem overflow indevido no card, mesmo contrato do teste de resultado
    // longo acima).
    const wrapper = container.querySelector(".katex")?.parentElement?.parentElement;
    expect(wrapper?.className).toContain("overflow-x-auto");
    expect(wrapper?.className).toContain("max-w-full");
  });

  it("combinação: cadeia única com \\binom, digitada como combinacao(...) ou C(...)", async () => {
    const { container } = render(
      <HistoryPanel
        items={[
          item("combinacao(10,3)", "C(10,3) = 10!/(3!*7!) = 120", "2026-01-01T00:00:00Z"),
          item("C(10,3)", "C(10,3) = 10!/(3!*7!) = 120", "2026-01-02T00:00:00Z"),
        ]}
        hiddenTimestamps={new Set()}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(2));
    for (const chain of normalizedAnnotations(container)) {
      expect(chain.startsWith("\\binom{10}{3}=")).toBe(true);
      expect(chain).toContain("=120");
      expect(chain.match(/\\binom/g)).toHaveLength(1);
    }
  });

  it("permutação: 'P_{6} = 6! = 720' sem duplicação", async () => {
    const { container } = render(
      <HistoryPanel
        items={[item("P(6)", "P(6) = 6! = 720", "2026-01-01T00:00:00Z")]}
        hiddenTimestamps={new Set()}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(1));
    const [chain] = normalizedAnnotations(container);
    expect(chain).toBe("P_{6}=6!=720");
  });

  it("fatorial: '7! = 5040' nunca vira '7! = 7! = 5040'", async () => {
    const { container } = render(
      <HistoryPanel
        items={[item("fatorial(7)", "7! = 5040", "2026-01-01T00:00:00Z")]}
        hiddenTimestamps={new Set()}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(1));
    const [chain] = normalizedAnnotations(container);
    expect(chain).toBe("7!=5040");
  });

  it("permutação com repetição (resultado sem cabeça) mantém 'expressão = cadeia'", async () => {
    // O resultado NÃO começa pela expressão (não há cabeça de texto puro
    // para P_n^{a,b,...}) — aqui a composição com "=" é correta e produz
    // "P_{8}^{3,2,2} = 8!/(3!·2!·2!) = 1680".
    const { container } = render(
      <HistoryPanel
        items={[
          item("permutacao_repeticao(8,3,2,2)", "8!/(3!*2!*2!) = 1680", "2026-01-01T00:00:00Z"),
        ]}
        hiddenTimestamps={new Set()}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(2));
    const annotations = normalizedAnnotations(container);
    expect(annotations.some((latex) => latex.includes("P_{8}^{3,2,2}"))).toBe(true);
    expect(annotations.some((latex) => latex.includes("=1680"))).toBe(true);
  });

  // --- Sprint V2.8 (Motor de Probabilidade) — mesmo hotfix pós-V2.7.1: a
  // notação abstrata do preview ("P(A)") e a cabeça da cadeia do backend
  // ("P(A) = ...") produzem o MESMO LaTeX, então `resultEchoesExpression`
  // colapsa em uma única fórmula, sem duplicar a cabeça.

  it("probabilidade clássica: cadeia única, sem 'P(A) = P(A) = ...'", async () => {
    const { container } = render(
      <HistoryPanel
        items={[item("probabilidade(3,10)", "P(A) = 3/10 = 0.3", "2026-01-01T00:00:00Z")]}
        hiddenTimestamps={new Set()}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(1));
    const [chain] = normalizedAnnotations(container);
    expect(chain.startsWith("P(A)=")).toBe(true);
    expect(chain).toContain("=0.3");
    expect(chain.match(/P\(A\)/g)).toHaveLength(1);
  });

  it("complementar: cadeia única com o sobrescrito 'c', sem duplicar a cabeça", async () => {
    const { container } = render(
      <HistoryPanel
        items={[item("complementar(0.3)", "P(Aᶜ) = 1-0.3 = 0.7", "2026-01-01T00:00:00Z")]}
        hiddenTimestamps={new Set()}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(1));
    const [chain] = normalizedAnnotations(container);
    expect(chain.startsWith("P(A^{c})=")).toBe(true);
    expect(chain).toContain("=0.7");
  });

  it("binomial: preview mostra a expressão instanciada sem calcular, resultado mostra a dedução completa (não colapsam)", async () => {
    // Sprint V2.8.1 — o preview de binomial passou a mostrar os valores
    // reais SEM resolver ("P(X=3)=\binom{10}{3}(0.5)^3(1-0.5)^7", com
    // "(1-0.5)" literal, não reduzido a "0.5"), diferente da dedução do
    // backend (que já chega com o complemento substituído — "0.5^7", sem
    // "1-" literal — e a cadeia completa até o valor final). As duas
    // cadeias continuam estruturalmente diferentes por construção
    // (parênteses+justaposição vs "\cdot" do backend), então
    // `resultEchoesExpression` não colapsa: 2 nós KaTeX, nunca 1.
    const { container } = render(
      <HistoryPanel
        items={[
          item(
            "binomial(10,3,0.5)",
            "P(X=3) = C(10,3)*0.5³*0.5⁷ = 120*0.125*0.0078125 = 0.1171875",
            "2026-01-01T00:00:00Z"
          ),
        ]}
        hiddenTimestamps={new Set()}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(2));
    const annotations = normalizedAnnotations(container);
    expect(
      annotations.some((latex) => latex.includes("P(X=3)=\\binom{10}{3}(0.5)^{3}(1-0.5)^{7}"))
    ).toBe(true);
    expect(annotations.some((latex) => latex.includes("=0.1171875"))).toBe(true);
    expect(annotations.some((latex) => latex.includes("120"))).toBe(true);
  });

  it("independentes: resultado sem notação KaTeX dedicada cai no texto puro, sem lançar", async () => {
    // O resultado de `independentes(...)` não casa nenhuma cabeça
    // reconhecida (não é uma dedução "P(...) = ..." de fórmula única) —
    // `resultToLatex` devolve null e o componente mostra o texto cru
    // (ver `HistoryPanel.tsx`: `segments === null` -> `<span>{result}</span>`).
    // A EXPRESSÃO digitada ainda renderiza via Tier 2 (nunca falha), então
    // ainda há 1 KaTeX (o eco de "independentes(...)"), não 0.
    const { container } = render(
      <HistoryPanel
        items={[
          item(
            "independentes(0.5,0.2,0.1)",
            "P(A)*P(B) = 0.5*0.2 = 0.1, P(A∩B) = 0.1 -> Eventos independentes",
            "2026-01-01T00:00:00Z"
          ),
        ]}
        hiddenTimestamps={new Set()}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );

    await waitFor(() => expect(container.textContent).toContain("Eventos independentes"));
    expect(container.querySelectorAll(".katex").length).toBe(1);
  });

  it("resultado simples (equação) continua com expressão = soluções separadas", async () => {
    const { container } = render(
      <HistoryPanel
        items={[item("x² - 4 = 0", "x₁ = -2, x₂ = 2", "2026-01-01T00:00:00Z")]}
        hiddenTimestamps={new Set()}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(2));
    const annotations = normalizedAnnotations(container);
    expect(annotations.some((latex) => latex.includes("{x}^{2}-4=0"))).toBe(true);
    expect(annotations.some((latex) => latex.includes("x_{1}=-2"))).toBe(true);
  });

  it("polinômio com dedução rotulada (Expandido) não é tratado como eco", async () => {
    const { container } = render(
      <HistoryPanel
        items={[
          item("expandir((x+2)³)", "Expandido: x**3 + 6*x**2 + 12*x + 8", "2026-01-01T00:00:00Z"),
        ]}
        hiddenTimestamps={new Set()}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(2));
    expect(screen.getByText("Expandido:")).toBeInTheDocument();
  });

  it("Sprint V2.4 (Sistemas Lineares): mostra um item de sistema linear com a expressão em \\begin{cases} e o resultado como lista de igualdades", async () => {
    const { container } = render(
      <HistoryPanel
        items={[item("x+y=5\nx-y=1", "x = 3, y = 2", "2026-01-01T00:00:00Z")]}
        hiddenTimestamps={new Set()}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(2));
    const annotations = Array.from(container.querySelectorAll("annotation")).map(
      (node) => node.textContent
    );
    expect(annotations.some((latex) => latex?.includes("\\begin{cases}"))).toBe(true);
    expect(
      annotations.some((latex) => latex?.replace(/[\s~]|\\[,;:!]/g, "").includes("x=3,y=2"))
    ).toBe(true);
  });

  it("Sprint V2.5 (Sistemas Polinomiais Não Lineares): mostra um item de sistema não linear com múltiplas soluções unidas por ' ou '", async () => {
    const { container } = render(
      <HistoryPanel
        items={[
          item(
            "x**2+y=5\nx-y=1",
            "x = -3, y = -4 ou x = 2, y = 1",
            "2026-01-01T00:00:00Z"
          ),
        ]}
        hiddenTimestamps={new Set()}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(2));
    const annotations = Array.from(container.querySelectorAll("annotation")).map(
      (node) => node.textContent
    );
    expect(annotations.some((latex) => latex?.includes("\\begin{cases}"))).toBe(true);
    expect(annotations.some((latex) => latex?.includes("\\text{ou}"))).toBe(true);
  });

  it("filtra itens ocultos", () => {
    render(
      <HistoryPanel
        items={[item("2+2", "4", "2026-01-01T00:00:00Z")]}
        hiddenTimestamps={new Set(["2026-01-01T00:00:00Z"])}
        onSelect={NOOP}
        onHide={NOOP}
      />
    );
    expect(
      screen.queryByRole("button", { name: /reutilizar expressão: 2\+2/i })
    ).not.toBeInTheDocument();
  });
});
