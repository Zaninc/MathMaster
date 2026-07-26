import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// "Ver propriedades" (bloco Explorar de matrizes) usa `useRouter()` — ver
// `ContextActions.tsx:FreshRequestActionPill` — nunca chamado pelos
// outros links do Explorar, mas precisa existir no mock pro render não
// lançar quando esses testes de matriz renderizam.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { resultToLatex } from "@/lib/math/to-latex";

import { ResultPanel } from "./ResultPanel";

const NOOP = vi.fn();

describe("ResultPanel", () => {
  beforeAll(async () => {
    // Aquece o dynamic import do mathjs para os timeouts curtos abaixo serem confiáveis.
    await resultToLatex("x = 2");
  });

  it("mostra o texto puro imediatamente e promove a KaTeX quando a conversão resolve", async () => {
    const { container } = render(
      <ResultPanel
        status="success"
        expression="x²-4=0"
        result="x₁ = -2, x₂ = 2"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());
    const annotations = Array.from(container.querySelectorAll("annotation")).map(
      (node) => node.textContent
    );
    expect(annotations.some((latex) => latex?.includes("x_{1}"))).toBe(true);
  });

  it("promove a expressão a KaTeX via Tier 2, mas mantém o resultado sem forma reconhecida como texto puro", async () => {
    const { container } = render(
      <ResultPanel
        status="success"
        expression="relacao_retas([(0,0),(1,0)],[(0,0),(0,1)])"
        result="Relação entre as retas: Perpendiculares ⊥"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    // A EXPRESSÃO (entrada do usuário) agora passa pelo mesmo pipeline
    // tolerante do preview/histórico — nunca mais fica presa em texto cru.
    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());
    // O RESULTADO (rótulo vindo do backend, "Perpendiculares ⊥") continua
    // sem forma reconhecida em `resultToLatex` — comportamento intocado.
    expect(screen.getByText("Relação entre as retas: Perpendiculares ⊥")).toBeInTheDocument();
  });

  it("preserva rótulos como texto em segmentos mistos", async () => {
    const { container } = render(
      <ResultPanel
        status="success"
        expression="circunferencia((0,0),5)"
        result="Tipo: circunferência; Centro: (0, 0); Raio: 5; Equação: x² + y² = 25"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());
    expect(screen.getByText("Centro:")).toBeInTheDocument();
    expect(screen.getByText("circunferência")).toBeInTheDocument();
  });

  // --- Sprint V2.1, BUG 1: resultado longo (ex. somatório de muitos senos)
  // não pode vazar do card — precisa rolar horizontalmente dentro dele.

  it("resultado longo fica em um wrapper com rolagem própria, sem truncar nem vazar do card", async () => {
    const longResult = Array.from({ length: 30 }, (_, i) => `sin(${i + 1})`).join(" + ");
    const { container } = render(
      <ResultPanel
        status="success"
        expression="Σ(i=1..30) sin(i)"
        result={longResult}
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
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

    // Nada foi cortado: o resultado completo ainda está presente (via MathML),
    // incluindo o último termo da soma de 30 parcelas.
    const annotations = Array.from(container.querySelectorAll("annotation")).map(
      (node) => node.textContent
    );
    expect(annotations.some((latex) => latex?.includes("sin") && latex.includes("30"))).toBe(true);
  });

  it("card do resultado e a linha do resultado permitem encolher (min-w-0) como itens de flex", async () => {
    const { container } = render(
      <ResultPanel
        status="success"
        expression="x = 2"
        result="x = 2"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );
    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());

    const root = container.querySelector('[aria-live="polite"]');
    expect(root?.className).toContain("min-w-0");
  });

  it("não renderiza nada em idle e mostra erro em error", () => {
    const { container } = render(
      <ResultPanel
        status="idle"
        expression=""
        result={null}
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );
    expect(container).toBeEmptyDOMElement();

    render(
      <ResultPanel
        status="error"
        expression="@@@"
        result={null}
        approx={null}
        errorMessage="Não foi possível interpretar."
        errorId="err2"
        onRetry={NOOP}
      />
    );
    expect(screen.getByText("Não foi possível interpretar.")).toBeInTheDocument();
  });
});

describe("ResultPanel — bloco Explorar (sistema de conexões internas)", () => {
  it("equação quadrática mostra 'Ver gráfico', 'Ver fórmula relacionada' e 'Praticar exercícios semelhantes'", () => {
    render(
      <ResultPanel
        status="success"
        expression="x² - 4 = 0"
        result="x = 2 ou x = -2"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    expect(screen.getByText("Explorar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver gráfico" })).toHaveAttribute(
      "href",
      expect.stringContaining("/graficos?fn=")
    );
    expect(screen.getByRole("link", { name: "Ver fórmula relacionada" })).toHaveAttribute(
      "href",
      expect.stringContaining("/formulas?")
    );
    expect(screen.getByRole("link", { name: "Praticar exercícios semelhantes" })).toHaveAttribute(
      "href",
      "/aprendizado?topico=equacoes"
    );
  });

  it("derivada mostra só 'Ver fórmula relacionada'", () => {
    render(
      <ResultPanel
        status="success"
        expression="d/dx(x² + 3x)"
        result="2x + 3"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    expect(screen.getByRole("link", { name: "Ver fórmula relacionada" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver gráfico" })).not.toBeInTheDocument();
  });

  it("expressão sem classificação não mostra o bloco Explorar", () => {
    render(
      <ResultPanel
        status="success"
        expression="2 + 2"
        result="4"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );
    expect(screen.queryByText("Explorar")).not.toBeInTheDocument();
  });

  it("não mostra Explorar fora do estado de sucesso", () => {
    render(
      <ResultPanel
        status="error"
        expression="x² - 4 = 0"
        result={null}
        approx={null}
        errorMessage="Algo deu errado"
        errorId="err"
        onRetry={NOOP}
      />
    );
    expect(screen.queryByText("Explorar")).not.toBeInTheDocument();
  });

  it("cada link do Explorar tem nome acessível e foco visível (herdado do Button)", () => {
    render(
      <ResultPanel
        status="success"
        expression="x² - 4 = 0"
        result="x = 2 ou x = -2"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    const link = screen.getByRole("link", { name: "Ver gráfico" });
    expect(link).toHaveAccessibleName("Ver gráfico");
    expect(link.className).toContain("focus-visible:ring-2");
    expect(link.tabIndex).not.toBe(-1);
  });
});

describe("ResultPanel — alternância exato/aproximado", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("sem approx, mostra só o botão 'Copiar' e nenhum toggle (comportamento de antes, intocado)", async () => {
    render(
      <ResultPanel
        status="success"
        expression="2+2"
        result="4"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    expect(screen.getByRole("button", { name: "Copiar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resultado aproximado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resultado exato" })).not.toBeInTheDocument();
  });

  it("com approx (resultado sem rótulo), mostra o resultado exato compacto de início, com botão 'Resultado aproximado'", async () => {
    render(
      <ResultPanel
        status="success"
        expression="Σ(i=1..30) sin(i)"
        result="sin(1) + sin(2)"
        approx="1.87"
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Resultado aproximado" })).toBeInTheDocument()
    );
    expect(screen.queryByText("≈ 1.87")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar" })).toBeInTheDocument();
  });

  it("alterna exato -> aproximado ao clicar em 'Resultado aproximado'", async () => {
    render(
      <ResultPanel
        status="success"
        expression="Σ(i=1..30) sin(i)"
        result="sin(1) + sin(2)"
        approx="1.87"
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Resultado aproximado" })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Resultado aproximado" }));

    expect(screen.getByText("≈ 1.87")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resultado exato" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resultado aproximado" })).not.toBeInTheDocument();
  });

  it("alterna aproximado -> exato ao clicar em 'Resultado exato'", async () => {
    render(
      <ResultPanel
        status="success"
        expression="Σ(i=1..30) sin(i)"
        result="sin(1) + sin(2)"
        approx="1.87"
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Resultado aproximado" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Resultado aproximado" }));
    expect(screen.getByText("≈ 1.87")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Resultado exato" }));

    expect(screen.queryByText("≈ 1.87")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resultado aproximado" })).toBeInTheDocument();
  });

  it("alternar o modo não aciona o clipboard sozinho", async () => {
    render(
      <ResultPanel
        status="success"
        expression="Σ(i=1..30) sin(i)"
        result="sin(1) + sin(2)"
        approx="1.87"
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Resultado aproximado" })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Resultado aproximado" }));
    fireEvent.click(screen.getByRole("button", { name: "Resultado exato" }));

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("'Copiar' copia o valor exato quando o modo exato está visível, e o aproximado depois de alternar", async () => {
    render(
      <ResultPanel
        status="success"
        expression="Σ(i=1..30) sin(i)"
        result="sin(1) + sin(2)"
        approx="1.87"
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Resultado aproximado" })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith("sin(1) + sin(2)");

    fireEvent.click(screen.getByRole("button", { name: "Resultado aproximado" }));
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith("1.87");
  });

  it("a expressão original permanece inalterada ao trocar entre exato e aproximado", async () => {
    const { container } = render(
      <ResultPanel
        status="success"
        expression="Σ(i=1..30) sin(i)"
        result="sin(1) + sin(2)"
        approx="1.87"
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Resultado aproximado" })).toBeInTheDocument()
    );
    const expressionBefore = container.querySelectorAll(".katex")[0]?.textContent;

    fireEvent.click(screen.getByRole("button", { name: "Resultado aproximado" }));
    const expressionAfterApprox = container.querySelectorAll(".katex")[0]?.textContent;

    fireEvent.click(screen.getByRole("button", { name: "Resultado exato" }));
    const expressionAfterExact = container.querySelectorAll(".katex")[0]?.textContent;

    expect(expressionBefore).toBeTruthy();
    expect(expressionAfterApprox).toBe(expressionBefore);
    expect(expressionAfterExact).toBe(expressionBefore);
  });

  it("resultado e expressão não aparecem duplicados quando o resultado é a mesma notação Σ não expandida", async () => {
    const { container } = render(
      <ResultPanel
        status="success"
        expression="Σ(i=1..30) (sin(i)+cos(i))"
        result="Σ(i=1..30) (sin(i)+cos(i))"
        approx="-1.047113797"
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Resultado aproximado" })).toBeInTheDocument()
    );
    // Mesmo quando expressão e resultado exato coincidem textualmente, cada
    // um é renderizado em UM único elemento seu — exatamente dois blocos
    // KaTeX (expressão + resultado), nunca um terceiro nó "extra"
    // duplicando a mesma fórmula.
    expect(container.querySelectorAll(".katex").length).toBe(2);
  });

  it("approx não é associado a um resultado com MÚLTIPLOS segmentos rotulados (ex. geometria) — mostra 'Copiar' normal, sem toggle", async () => {
    render(
      <ResultPanel
        status="success"
        expression="circunferencia((0,0),5)"
        result="Tipo: circunferência; Raio: 5"
        approx="1.87"
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    await waitFor(() => expect(screen.getByText("Raio:")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Copiar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resultado aproximado" })).not.toBeInTheDocument();
  });
});

describe("ResultPanel — matrizes (Sprint V2.2)", () => {
  it("renderiza a expressão e o resultado de uma matriz literal como \\begin{bmatrix}, sem duplicar", async () => {
    const { container } = render(
      <ResultPanel
        status="success"
        expression="[[1,2],[3,4]]"
        result="[[1, 2], [3, 4]]"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(2));
    const annotations = Array.from(container.querySelectorAll("annotation")).map(
      (node) => node.textContent
    );
    // Exatamente dois blocos matemáticos (expressão + resultado), cada um
    // com \begin{bmatrix} — nunca um terceiro nó nem uma leitura como
    // tupla de dois vetores-linha (regressão do bug de `pairToLatex`).
    expect(annotations.filter((latex) => latex?.includes("\\begin{bmatrix}"))).toHaveLength(2);
    expect(annotations.some((latex) => latex?.includes("\\right)"))).toBe(false);
  });

  it("renderiza o resultado escalar de det(...) normalmente (não é lido como matriz)", async () => {
    const { container } = render(
      <ResultPanel
        status="success"
        expression="det([[1,2],[3,4]])"
        result="-2"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());
    const annotations = Array.from(container.querySelectorAll("annotation")).map(
      (node) => node.textContent
    );
    // O RESULTADO (o segmento, não o eco da expressão "det([[...]])" no
    // topo — esse legitimamente contém "\begin{bmatrix}", já que o INPUT
    // tem uma matriz dentro) é o escalar limpo "-2", nunca uma matriz.
    expect(annotations.some((latex) => latex === "-2")).toBe(true);
  });

  it("bloco Explorar de uma matriz literal mostra 'Ver propriedades', 'Ver fórmulas relacionadas' e 'Exercícios semelhantes'", () => {
    render(
      <ResultPanel
        status="success"
        expression="[[1,2],[3,4]]"
        result="[[1, 2], [3, 4]]"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    expect(screen.getByRole("link", { name: "Ver propriedades" })).toHaveAttribute(
      "href",
      expect.stringContaining("/calculadora?expression=")
    );
    expect(screen.getByRole("link", { name: "Ver fórmulas relacionadas" })).toHaveAttribute(
      "href",
      expect.stringContaining("categoria=algebra-linear")
    );
    expect(screen.getByRole("link", { name: "Exercícios semelhantes" })).toHaveAttribute(
      "href",
      "/aprendizado?topico=algebra-linear"
    );
  });

  it("bloco Explorar de det(...) não mostra 'Ver propriedades' (expressão já não é um literal puro)", () => {
    render(
      <ResultPanel
        status="success"
        expression="det([[1,2],[3,4]])"
        result="-2"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    expect(screen.queryByRole("link", { name: "Ver propriedades" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver fórmulas relacionadas" })).toBeInTheDocument();
  });
});

describe("ResultPanel — sistemas lineares (Sprint V2.4)", () => {
  it("renderiza a expressão como \\begin{cases}...\\end{cases} e o resultado como lista de igualdades", async () => {
    const { container } = render(
      <ResultPanel
        status="success"
        expression={"x+y=5\nx-y=1"}
        result="x = 3, y = 2"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
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

  it("sistema 3x3 renderiza as três equações dentro de cases", async () => {
    const { container } = render(
      <ResultPanel
        status="success"
        expression={"x+y+z=6\nx-y=0\ny-z=1"}
        result="x = 7/3, y = 7/3, z = 4/3"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(2));
    const annotations = Array.from(container.querySelectorAll("annotation")).map(
      (node) => node.textContent
    );
    expect(annotations.some((latex) => latex?.includes("\\begin{cases}"))).toBe(true);
    expect(annotations.some((latex) => latex?.includes("\\frac{7}{3}"))).toBe(true);
  });

  it("sistema impossível ('Sistema sem solução') mostra o texto puro, sem KaTeX no resultado nem erro visual", async () => {
    render(
      <ResultPanel
        status="success"
        expression={"x+y=2\nx+y=3"}
        result="Sistema sem solução"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    expect(await screen.findByText("Sistema sem solução")).toBeInTheDocument();
  });

  it("bloco Explorar de um sistema linear mostra 'Ver fórmula relacionada' e 'Exercícios semelhantes', NUNCA 'Ver propriedades' (não é matriz)", () => {
    render(
      <ResultPanel
        status="success"
        expression={"x+y=5\nx-y=1"}
        result="x = 3, y = 2"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    expect(screen.queryByRole("link", { name: "Ver propriedades" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver fórmula relacionada" })).toHaveAttribute(
      "href",
      expect.stringContaining("categoria=algebra-linear")
    );
    expect(screen.getByRole("link", { name: "Exercícios semelhantes" })).toHaveAttribute(
      "href",
      "/aprendizado?topico=algebra-linear"
    );
  });

  it("uma única equação (sem sistema) continua sem o bloco Explorar de Álgebra Linear (regressão)", () => {
    render(
      <ResultPanel
        status="success"
        expression="x+y=5"
        result="Infinitas soluções"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    expect(screen.queryByRole("link", { name: "Ver fórmula relacionada" })).not.toBeInTheDocument();
  });
});

describe("ResultPanel — sistemas polinomiais não lineares (Sprint V2.5)", () => {
  it("renderiza a expressão como \\begin{cases}...\\end{cases} e múltiplas soluções unidas por ' ou '", async () => {
    const { container } = render(
      <ResultPanel
        status="success"
        expression={"x**2+y=5\nx-y=1"}
        result="x = -3, y = -4 ou x = 2, y = 1"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBe(2));
    const annotations = Array.from(container.querySelectorAll("annotation")).map(
      (node) => node.textContent
    );
    expect(annotations.some((latex) => latex?.includes("\\begin{cases}"))).toBe(true);
    expect(annotations.some((latex) => latex?.includes("\\text{ou}"))).toBe(true);
  });

  it("sistema não linear impossível mostra o texto puro, sem KaTeX no resultado nem erro visual", async () => {
    render(
      <ResultPanel
        status="success"
        expression={"x**2+y**2=1\nx**2+y**2=4"}
        result="Sistema sem solução"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    expect(await screen.findByText("Sistema sem solução")).toBeInTheDocument();
  });

  it("bloco Explorar de um sistema não linear mostra 'Ver fórmula relacionada'/'Exercícios semelhantes', NUNCA 'Ver propriedades', e NUNCA aponta para Álgebra Linear", () => {
    render(
      <ResultPanel
        status="success"
        expression={"x**2+y=5\nx-y=1"}
        result="x = -3, y = -4 ou x = 2, y = 1"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    expect(screen.queryByRole("link", { name: "Ver propriedades" })).not.toBeInTheDocument();
    const formulaLink = screen.getByRole("link", { name: "Ver fórmula relacionada" });
    expect(formulaLink).toHaveAttribute("href", expect.stringContaining("categoria=algebra"));
    expect(formulaLink).not.toHaveAttribute("href", expect.stringContaining("algebra-linear"));
    expect(screen.getByRole("link", { name: "Exercícios semelhantes" })).toHaveAttribute(
      "href",
      "/aprendizado?topico=algebra-basica"
    );
  });

  it("sistema linear NUNCA aciona o bloco de sistema não linear (mutuamente exclusivos)", () => {
    render(
      <ResultPanel
        status="success"
        expression={"x+y=5\nx-y=1"}
        result="x = 3, y = 2"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    const formulaLink = screen.getByRole("link", { name: "Ver fórmula relacionada" });
    expect(formulaLink).toHaveAttribute("href", expect.stringContaining("algebra-linear"));
  });
});

describe("ResultPanel — variáveis locais de matriz (Sprint V2.2.1)", () => {
  it("renderiza um programa multi-linha (atribuições + expressão final) sem quebrar, expressão preservada verbatim", async () => {
    const expression = "A=[[1,2],[3,4]]\nB=[[5,6],[7,8]]\nA*B";
    const { container } = render(
      <ResultPanel
        status="success"
        expression={expression}
        result="[[19, 22], [43, 50]]"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelectorAll(".katex").length).toBeGreaterThan(0));
    const annotations = Array.from(container.querySelectorAll("annotation")).map(
      (node) => node.textContent
    );
    // Eco da expressão (topo) mostra as DUAS matrizes definidas via
    // atribuição; o resultado (embaixo) é a matriz final do produto —
    // pelo menos 2 blocos "\begin{bmatrix}" no total.
    expect(annotations.filter((latex) => latex?.includes("\\begin{bmatrix}")).length).toBeGreaterThanOrEqual(2);
  });

  it("bloco Explorar de um programa com variável na expressão final mostra 'Ver propriedades' com as atribuições preservadas no link", async () => {
    render(
      <ResultPanel
        status="success"
        expression={"A=[[1,2],[3,4]]\nA"}
        result="[[1, 2], [3, 4]]"
        approx={null}
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    const link = screen.getByRole("link", { name: "Ver propriedades" });
    const href = decodeURIComponent(link.getAttribute("href") ?? "");
    expect(href).toContain("A=[[1,2],[3,4]]");
    expect(href).toContain("det(A)");
  });
});
