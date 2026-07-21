import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { plotExpressionToLatex } from "@/lib/math/graph-normalize";

import { FunctionList } from "./FunctionList";
import type { PlotFunction } from "./types";

function makeFunction(overrides: Partial<PlotFunction> = {}): PlotFunction {
  return { id: "fn-1", expression: "x^2 - 4", color: "#3d6eff", visible: true, ...overrides };
}

describe("FunctionList", () => {
  beforeAll(async () => {
    // Aquece o dynamic import do mathjs para os waitFor abaixo serem confiáveis.
    await plotExpressionToLatex("x");
  });

  it("mostra estado vazio quando não há funções", () => {
    render(<FunctionList functions={[]} errors={new Map()} onAdd={vi.fn()} onToggle={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(/nenhuma função adicionada ainda/i)).toBeInTheDocument();
  });

  it("renderiza a expressão da função via KaTeX", async () => {
    const { container } = render(
      <FunctionList
        functions={[makeFunction()]}
        errors={new Map()}
        onAdd={vi.fn()}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull(), { timeout: 2000 });
    // annotation carrega o LaTeX resultante (saída do toTex), não o texto original digitado.
    expect(
      Array.from(container.querySelectorAll("annotation")).some((node) => node.textContent?.includes("^{2}"))
    ).toBe(true);
  });

  it("mostra mensagem de erro associada à função, quando existe", () => {
    const errors = new Map([["fn-1", "Não foi possível plotar esta função."]]);
    render(
      <FunctionList
        functions={[makeFunction()]}
        errors={errors}
        onAdd={vi.fn()}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText("Não foi possível plotar esta função.")).toBeInTheDocument();
  });

  it("chama onToggle/onRemove com o id correto, independente da renderização KaTeX", () => {
    const onToggle = vi.fn();
    const onRemove = vi.fn();
    render(
      <FunctionList
        functions={[makeFunction()]}
        errors={new Map()}
        onAdd={vi.fn()}
        onToggle={onToggle}
        onRemove={onRemove}
      />
    );

    fireEvent.click(screen.getByLabelText(/ocultar função x\^2 - 4/i));
    expect(onToggle).toHaveBeenCalledWith("fn-1");

    fireEvent.click(screen.getByRole("button", { name: /remover função x\^2 - 4/i }));
    expect(onRemove).toHaveBeenCalledWith("fn-1");
  });

  it("submete o texto digitado via onAdd, sem alterá-lo", () => {
    const onAdd = vi.fn();
    render(<FunctionList functions={[]} errors={new Map()} onAdd={onAdd} onToggle={vi.fn()} onRemove={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/adicionar função/i), { target: { value: "x² - 4" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(onAdd).toHaveBeenCalledWith("x² - 4");
  });

  it("botões de exemplo simples continuam um clique = uma função (Linear, Quadrática, Racional)", () => {
    render(<FunctionList functions={[]} errors={new Map()} onAdd={vi.fn()} onToggle={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByRole("button", { name: /adicionar exemplo linear/i })).toHaveTextContent("Linear");
    expect(screen.getByRole("button", { name: /adicionar exemplo quadrática/i })).toHaveTextContent("Quadrática");
    expect(screen.getByRole("button", { name: /adicionar exemplo racional/i })).toHaveTextContent("Racional");
  });

  describe("categorias com múltiplas funções (menu expansível)", () => {
    it("mostra os botões de categoria fechados por padrão, sem painel visível", () => {
      render(<FunctionList functions={[]} errors={new Map()} onAdd={vi.fn()} onToggle={vi.fn()} onRemove={vi.fn()} />);

      const toggle = screen.getByRole("button", { name: /ver funções de trigonométrica/i });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(toggle).toHaveAttribute("aria-haspopup", "true");
      expect(screen.queryByRole("group")).not.toBeInTheDocument();
    });

    it("abre o painel ao clicar e lista as sub-funções da categoria", () => {
      render(<FunctionList functions={[]} errors={new Map()} onAdd={vi.fn()} onToggle={vi.fn()} onRemove={vi.fn()} />);

      fireEvent.click(screen.getByRole("button", { name: /ver funções de trigonométrica/i }));

      const panel = screen.getByRole("group", { name: /funções de trigonométrica/i });
      expect(within(panel).getByRole("button", { name: /— sen\(x\):/i })).toBeInTheDocument();
      expect(within(panel).getByRole("button", { name: /cotg\(x\)/i })).toBeInTheDocument();
      // "— sec(x):" (com o travessão) — "sec(x)" sozinho é substring literal de "cossec(x)".
      expect(within(panel).getByRole("button", { name: /— sec\(x\):/i })).toBeInTheDocument();
      expect(within(panel).getByRole("button", { name: /cossec\(x\)/i })).toBeInTheDocument();
    });

    it("chama onAdd com a expressão técnica correta ao clicar numa sub-função", () => {
      const onAdd = vi.fn();
      render(<FunctionList functions={[]} errors={new Map()} onAdd={onAdd} onToggle={vi.fn()} onRemove={vi.fn()} />);

      fireEvent.click(screen.getByRole("button", { name: /ver funções de trigonométrica/i }));
      const panel = screen.getByRole("group", { name: /funções de trigonométrica/i });
      fireEvent.click(within(panel).getByRole("button", { name: /cotg\(x\)/i }));

      expect(onAdd).toHaveBeenCalledWith("cot(x)");
    });

    it("todas as categorias expansíveis da biblioteca aparecem", () => {
      render(<FunctionList functions={[]} errors={new Map()} onAdd={vi.fn()} onToggle={vi.fn()} onRemove={vi.fn()} />);

      for (const label of ["Polinomial", "Exponencial", "Logarítmica", "Trigonométrica", "Especiais", "Interessantes"]) {
        expect(screen.getByRole("button", { name: new RegExp(`ver funções de ${label}`, "i") })).toBeInTheDocument();
      }
    });
  });

  describe("rótulos em KaTeX (refinamento visual)", () => {
    it("todos os itens de todas as categorias exibem markup KaTeX (nenhum texto solto)", () => {
      render(<FunctionList functions={[]} errors={new Map()} onAdd={vi.fn()} onToggle={vi.fn()} onRemove={vi.fn()} />);

      const groupLabels = ["Polinomial", "Exponencial", "Logarítmica", "Trigonométrica", "Especiais", "Interessantes"];
      for (const groupLabel of groupLabels) {
        fireEvent.click(screen.getByRole("button", { name: new RegExp(`ver funções de ${groupLabel}`, "i") }));
        const panel = screen.getByRole("group", { name: new RegExp(`funções de ${groupLabel}`, "i") });
        const buttons = within(panel).getAllByRole("button");
        expect(buttons.length).toBeGreaterThan(0);
        for (const button of buttons) {
          expect(button.querySelector(".katex")).not.toBeNull();
        }
        // fecha antes de abrir a próxima (só um painel por vez).
        fireEvent.click(screen.getByRole("button", { name: new RegExp(`ver funções de ${groupLabel}`, "i") }));
      }
    });

    it("o texto acessível (aria-label) continua disponível e correto mesmo com o rótulo em KaTeX", () => {
      render(<FunctionList functions={[]} errors={new Map()} onAdd={vi.fn()} onToggle={vi.fn()} onRemove={vi.fn()} />);

      fireEvent.click(screen.getByRole("button", { name: /ver funções de logarítmica/i }));
      const panel = screen.getByRole("group", { name: /funções de logarítmica/i });

      const logA = within(panel).getByRole("button", { name: /logarítmica — logₐ\(x\): log\(x, 2\)/i });
      expect(logA).toBeInTheDocument();
      // o conteúdo visual (KaTeX) fica aria-hidden — o nome acessível vem só do aria-label.
      expect(logA.querySelector("[aria-hidden='true']")).not.toBeNull();
    });

    it("clicar num item com rótulo KaTeX ainda insere a expressão técnica correta, não o LaTeX", () => {
      const onAdd = vi.fn();
      render(<FunctionList functions={[]} errors={new Map()} onAdd={onAdd} onToggle={vi.fn()} onRemove={vi.fn()} />);

      fireEvent.click(screen.getByRole("button", { name: /ver funções de interessantes/i }));
      const panel = screen.getByRole("group", { name: /funções de interessantes/i });
      fireEvent.click(within(panel).getByRole("button", { name: /sigmoide/i }));

      expect(onAdd).toHaveBeenCalledWith("1/(1 + e^(-x))");
      expect(onAdd).not.toHaveBeenCalledWith(expect.stringContaining("\\frac"));
    });

    it("o rótulo mais longo (a·sen(bx+c)+d) renderiza em KaTeX crescendo naturalmente, sem scroll interno", () => {
      render(<FunctionList functions={[]} errors={new Map()} onAdd={vi.fn()} onToggle={vi.fn()} onRemove={vi.fn()} />);

      fireEvent.click(screen.getByRole("button", { name: /ver funções de trigonométrica/i }));
      const panel = screen.getByRole("group", { name: /funções de trigonométrica/i });
      const button = within(panel).getByRole("button", { name: /trigonométrica — a·sen\(bx\+c\)\+d/i });

      expect(button.querySelector(".katex")).not.toBeNull();
      const wrapper = button.querySelector(".katex")?.parentElement;
      expect(wrapper).not.toBeNull();
      expect(wrapper).toHaveClass("w-max", "max-w-none", "overflow-visible", "whitespace-nowrap");
    });

    it("nenhum rótulo de nenhuma categoria usa overflow-x-auto/overflow-y-auto (nunca cria scrollbar interna)", () => {
      render(<FunctionList functions={[]} errors={new Map()} onAdd={vi.fn()} onToggle={vi.fn()} onRemove={vi.fn()} />);

      const groupLabels = ["Polinomial", "Exponencial", "Logarítmica", "Trigonométrica", "Especiais", "Interessantes"];
      for (const groupLabel of groupLabels) {
        fireEvent.click(screen.getByRole("button", { name: new RegExp(`ver funções de ${groupLabel}`, "i") }));
        const panel = screen.getByRole("group", { name: new RegExp(`funções de ${groupLabel}`, "i") });
        for (const button of within(panel).getAllByRole("button")) {
          const wrapper = button.querySelector(".katex")?.parentElement;
          expect(wrapper).not.toBeNull();
          expect(wrapper).not.toHaveClass("overflow-x-auto");
          expect(wrapper).not.toHaveClass("overflow-y-auto");
          expect(wrapper).not.toHaveClass("max-w-full");
        }
        fireEvent.click(screen.getByRole("button", { name: new RegExp(`ver funções de ${groupLabel}`, "i") }));
      }
    });

    it("o container dos itens do grupo continua com flex-wrap (permite quebrar linha)", () => {
      render(<FunctionList functions={[]} errors={new Map()} onAdd={vi.fn()} onToggle={vi.fn()} onRemove={vi.fn()} />);

      fireEvent.click(screen.getByRole("button", { name: /ver funções de trigonométrica/i }));
      const panel = screen.getByRole("group", { name: /funções de trigonométrica/i });
      expect(panel.firstElementChild).toHaveClass("flex-wrap");
    });

    it("exemplos simples (Linear, Quadrática, Racional) continuam em texto puro — não têm labelLatex", () => {
      render(<FunctionList functions={[]} errors={new Map()} onAdd={vi.fn()} onToggle={vi.fn()} onRemove={vi.fn()} />);

      const linear = screen.getByRole("button", { name: /adicionar exemplo linear/i });
      expect(linear.querySelector(".katex")).toBeNull();
      expect(linear).toHaveTextContent("Linear");
    });

    it("todos os itens dos menus expansíveis têm a mesma altura/largura mínima e centralização (ajuste uniforme)", () => {
      render(<FunctionList functions={[]} errors={new Map()} onAdd={vi.fn()} onToggle={vi.fn()} onRemove={vi.fn()} />);

      const groupLabels = ["Polinomial", "Exponencial", "Logarítmica", "Trigonométrica", "Especiais", "Interessantes"];
      for (const groupLabel of groupLabels) {
        fireEvent.click(screen.getByRole("button", { name: new RegExp(`ver funções de ${groupLabel}`, "i") }));
        const panel = screen.getByRole("group", { name: new RegExp(`funções de ${groupLabel}`, "i") });
        for (const button of within(panel).getAllByRole("button")) {
          expect(button).toHaveClass("min-h-8", "min-w-14", "inline-flex", "items-center", "justify-center");
        }
        fireEvent.click(screen.getByRole("button", { name: new RegExp(`ver funções de ${groupLabel}`, "i") }));
      }
    });

    it("os botões de categoria e os exemplos simples NÃO ganham o ajuste de tamanho (escopo só dos itens de menu)", () => {
      render(<FunctionList functions={[]} errors={new Map()} onAdd={vi.fn()} onToggle={vi.fn()} onRemove={vi.fn()} />);

      const categoryToggle = screen.getByRole("button", { name: /ver funções de trigonométrica/i });
      expect(categoryToggle).not.toHaveClass("min-h-8");
      expect(categoryToggle).not.toHaveClass("min-w-14");

      const linear = screen.getByRole("button", { name: /adicionar exemplo linear/i });
      expect(linear).not.toHaveClass("min-h-8");
      expect(linear).not.toHaveClass("min-w-14");
    });
  });
});
