import { render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

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
        errorMessage={null}
        errorId="err"
        onRetry={NOOP}
      />
    );

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());
    expect(screen.getByText("Centro:")).toBeInTheDocument();
    expect(screen.getByText("circunferência")).toBeInTheDocument();
  });

  it("não renderiza nada em idle e mostra erro em error", () => {
    const { container } = render(
      <ResultPanel
        status="idle"
        expression=""
        result={null}
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
      <ResultPanel status="success" expression="2 + 2" result="4" errorMessage={null} errorId="err" onRetry={NOOP} />
    );
    expect(screen.queryByText("Explorar")).not.toBeInTheDocument();
  });

  it("não mostra Explorar fora do estado de sucesso", () => {
    render(
      <ResultPanel
        status="error"
        expression="x² - 4 = 0"
        result={null}
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
