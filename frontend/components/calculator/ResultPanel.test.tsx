import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

    const formulaWrappers = Array.from(container.querySelectorAll(".katex")).map(
      (node) => node.parentElement
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

describe("ResultPanel — apresentação progressiva (Sprint V2.1)", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("sem approx, mostra só o botão 'Copiar' (comportamento de antes, intocado)", async () => {
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
    expect(screen.queryByRole("button", { name: "Copiar aproximado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copiar exato" })).not.toBeInTheDocument();
  });

  it("com approx (resultado sem rótulo), mostra 'Copiar aproximado' e 'Copiar exato' em vez de 'Copiar'", async () => {
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
      expect(screen.getByRole("button", { name: "Copiar aproximado" })).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: "Copiar exato" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copiar" })).not.toBeInTheDocument();
  });

  it("'Copiar aproximado' copia o texto aproximado; 'Copiar exato' copia o texto exato do backend", async () => {
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
      expect(screen.getByRole("button", { name: "Copiar aproximado" })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Copiar aproximado" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("1.87");

    fireEvent.click(screen.getByRole("button", { name: "Copiar exato" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("sin(1) + sin(2)");
  });

  it("approx não é associado a um resultado com MÚLTIPLOS segmentos rotulados (ex. geometria) — mostra 'Copiar' normal", async () => {
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
    expect(screen.queryByRole("button", { name: "Copiar aproximado" })).not.toBeInTheDocument();
  });
});
