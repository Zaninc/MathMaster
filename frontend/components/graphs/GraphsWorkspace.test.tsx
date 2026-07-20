import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { plotExpressionToLatex } from "@/lib/math/graph-normalize";

import { GraphsWorkspace } from "./GraphsWorkspace";

describe("GraphsWorkspace", () => {
  beforeAll(async () => {
    // Aquece o dynamic import do mathjs para os waitFor abaixo serem confiáveis.
    await plotExpressionToLatex("x");
  });

  it("adiciona uma função válida sem erro", async () => {
    render(<GraphsWorkspace />);

    fireEvent.change(screen.getByLabelText(/adicionar função/i), { target: { value: "x^2 - 4" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    // A lista agora renderiza a expressão via KaTeX — consulta pelo aria-label
    // do checkbox (texto cru, inalterado) em vez do texto visual.
    await screen.findByLabelText(/ocultar função x\^2 - 4/i);
    const list = screen.getByRole("list");
    await waitFor(() => expect(within(list).queryByText(/não foi possível/i)).not.toBeInTheDocument());
  });

  it("mostra uma mensagem de erro para expressão bloqueada pela whitelist", async () => {
    render(<GraphsWorkspace />);

    fireEvent.change(screen.getByLabelText(/adicionar função/i), { target: { value: "f(x) = x^2" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(await screen.findByText(/não permitid[ao]/i)).toBeInTheDocument();
  });

  it("adiciona um exemplo pré-definido ao clicar", async () => {
    render(<GraphsWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: /adicionar exemplo linear/i }));

    const list = screen.getByRole("list");
    await screen.findByLabelText(/ocultar função 2x \+ 1/i);
    await waitFor(() => expect(list.querySelector(".katex")).not.toBeNull(), { timeout: 2000 });
  });

  describe("menu expansível de Trigonométrica", () => {
    it("abre o menu e mostra as funções trigonométricas, fechado por padrão", () => {
      render(<GraphsWorkspace />);

      const toggle = screen.getByRole("button", { name: /ver funções de trigonométrica/i });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("group", { name: /funções de trigonométrica/i })).not.toBeInTheDocument();

      fireEvent.click(toggle);

      expect(toggle).toHaveAttribute("aria-expanded", "true");
      const panel = screen.getByRole("group", { name: /funções de trigonométrica/i });
      expect(panel).toBeInTheDocument();
    });

    it("insere sen, cos, tan, cot, sec e csc a partir do menu, sem fechar entre cliques", async () => {
      render(<GraphsWorkspace />);

      fireEvent.click(screen.getByRole("button", { name: /ver funções de trigonométrica/i }));
      const panel = screen.getByRole("group", { name: /funções de trigonométrica/i });

      fireEvent.click(within(panel).getByRole("button", { name: /trigonométrica — sen\(x\)/i }));
      fireEvent.click(within(panel).getByRole("button", { name: /trigonométrica — cos\(x\)/i }));
      fireEvent.click(within(panel).getByRole("button", { name: /trigonométrica — tg\(x\)/i }));
      fireEvent.click(within(panel).getByRole("button", { name: /trigonométrica — cotg\(x\)/i }));
      fireEvent.click(within(panel).getByRole("button", { name: /trigonométrica — sec\(x\)/i }));
      fireEvent.click(within(panel).getByRole("button", { name: /trigonométrica — cossec\(x\)/i }));

      await screen.findByLabelText(/ocultar função sin\(x\)/i);
      await screen.findByLabelText(/ocultar função cos\(x\)/i);
      await screen.findByLabelText(/ocultar função tan\(x\)/i);
      await screen.findByLabelText(/ocultar função cot\(x\)/i);
      await screen.findByLabelText(/ocultar função sec\(x\)/i);
      await screen.findByLabelText(/ocultar função csc\(x\)/i);

      await waitFor(() =>
        expect(screen.queryByText(/não foi possível|não permitid[ao]/i)).not.toBeInTheDocument()
      );
    });

    it("fecha ao clicar de novo no botão da categoria", () => {
      render(<GraphsWorkspace />);
      const toggle = screen.getByRole("button", { name: /ver funções de trigonométrica/i });

      fireEvent.click(toggle);
      expect(screen.getByRole("group", { name: /funções de trigonométrica/i })).toBeInTheDocument();

      fireEvent.click(toggle);
      expect(screen.queryByRole("group", { name: /funções de trigonométrica/i })).not.toBeInTheDocument();
    });

    it("abrir outra categoria fecha a anterior — só um painel por vez", () => {
      render(<GraphsWorkspace />);

      fireEvent.click(screen.getByRole("button", { name: /ver funções de trigonométrica/i }));
      expect(screen.getByRole("group", { name: /funções de trigonométrica/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /ver funções de exponencial/i }));
      expect(screen.queryByRole("group", { name: /funções de trigonométrica/i })).not.toBeInTheDocument();
      expect(screen.getByRole("group", { name: /funções de exponencial/i })).toBeInTheDocument();
    });
  });

  it("alterna a visibilidade de uma função", async () => {
    render(<GraphsWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: /adicionar exemplo linear/i }));

    const checkbox = await screen.findByLabelText(/ocultar função 2x \+ 1/i);
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("remove uma função da lista", async () => {
    render(<GraphsWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: /adicionar exemplo linear/i }));
    await screen.findByLabelText(/ocultar função 2x \+ 1/i);

    fireEvent.click(screen.getByRole("button", { name: /remover função 2x \+ 1/i }));

    await waitFor(() =>
      expect(screen.queryByLabelText(/ocultar função 2x \+ 1/i)).not.toBeInTheDocument()
    );
  });

  describe("entrada natural — mesmo resultado da sintaxe técnica", () => {
    it("x² compila e plota sem erro, igual a x^2", async () => {
      render(<GraphsWorkspace />);

      fireEvent.change(screen.getByLabelText(/adicionar função/i), { target: { value: "x² - 4" } });
      fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

      await screen.findByLabelText(/ocultar função x² - 4/i);
      await waitFor(() =>
        expect(screen.queryByText(/não foi possível|não permitid[ao]/i)).not.toBeInTheDocument()
      );
    });

    it("sen(x) compila e plota sem erro, igual a sin(x)", async () => {
      render(<GraphsWorkspace />);

      fireEvent.change(screen.getByLabelText(/adicionar função/i), { target: { value: "sen(x)" } });
      fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

      await screen.findByLabelText(/ocultar função sen\(x\)/i);
      await waitFor(() =>
        expect(screen.queryByText(/não foi possível|não permitid[ao]/i)).not.toBeInTheDocument()
      );
    });

    it("x(x+1) compila e plota sem erro (ambíguo com chamada de função sem normalização)", async () => {
      render(<GraphsWorkspace />);

      fireEvent.change(screen.getByLabelText(/adicionar função/i), { target: { value: "x(x+1)" } });
      fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

      await screen.findByLabelText(/ocultar função x\(x\+1\)/i);
      await waitFor(() =>
        expect(screen.queryByText(/não foi possível|não permitid[ao]/i)).not.toBeInTheDocument()
      );
    });
  });

  describe("biblioteca expandida de funções", () => {
    it.each([
      ["polinomial", "x³", "x^3"],
      ["exponencial", "eˣ", "e^x"],
      ["exponencial", "2ˣ", "2^x"],
      ["logarítmica", "ln\\(x\\)", "ln(x)"],
      ["logarítmica", "log\\(x\\)", "log10(x)"],
      ["especiais", "√x", "sqrt(x)"],
      ["especiais", "\\|x\\|", "abs(x)"],
      ["interessantes", "sigmoide", "1/(1 + e^(-x))"],
    ])("adiciona e plota %s: %s (%s) sem erro", async (groupLabel, itemLabelPattern, expression) => {
      render(<GraphsWorkspace />);

      fireEvent.click(screen.getByRole("button", { name: new RegExp(`ver funções de ${groupLabel}`, "i") }));
      fireEvent.click(
        // "$" ancora no fim do rótulo (antes do ":") pra "x³" não casar com "x³ − 3x".
        screen.getByRole("button", { name: new RegExp(`${groupLabel} — ${itemLabelPattern}:`, "i") })
      );

      await screen.findByLabelText(new RegExp(`ocultar função ${expression.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"));
      await waitFor(() =>
        expect(screen.queryByText(/não foi possível|não permitid[ao]/i)).not.toBeInTheDocument()
      );
    });

    it("combina múltiplas funções trigonométricas no mesmo gráfico", async () => {
      render(<GraphsWorkspace />);

      fireEvent.click(screen.getByRole("button", { name: /ver funções de trigonométrica/i }));
      const panel = screen.getByRole("group", { name: /funções de trigonométrica/i });
      fireEvent.click(within(panel).getByRole("button", { name: /trigonométrica — sen\(x\)/i }));
      fireEvent.click(within(panel).getByRole("button", { name: /trigonométrica — cos\(x\)/i }));
      fireEvent.click(within(panel).getByRole("button", { name: /trigonométrica — tg\(x\)/i }));

      await screen.findByLabelText(/ocultar função sin\(x\)/i);
      await screen.findByLabelText(/ocultar função cos\(x\)/i);
      await screen.findByLabelText(/ocultar função tan\(x\)/i);

      const list = screen.getByRole("list");
      expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    });

    it("remove uma função inserida pelo menu de Trigonométrica", async () => {
      render(<GraphsWorkspace />);

      fireEvent.click(screen.getByRole("button", { name: /ver funções de trigonométrica/i }));
      fireEvent.click(screen.getByRole("button", { name: /trigonométrica — cotg\(x\)/i }));
      await screen.findByLabelText(/ocultar função cot\(x\)/i);

      fireEvent.click(screen.getByRole("button", { name: /remover função cot\(x\)/i }));

      await waitFor(() => expect(screen.queryByLabelText(/ocultar função cot\(x\)/i)).not.toBeInTheDocument());
    });

    it("modelo pronto a·sen(bx+c)+d é sintaticamente válido e plota sem erro", async () => {
      render(<GraphsWorkspace />);

      fireEvent.click(screen.getByRole("button", { name: /ver funções de trigonométrica/i }));
      fireEvent.click(screen.getByRole("button", { name: /trigonométrica — a·sen\(bx\+c\)\+d/i }));

      await screen.findByLabelText(/ocultar função 2\*sin\(3\*x \+ 1\) - 1/i);
      await waitFor(() =>
        expect(screen.queryByText(/não foi possível|não permitid[ao]/i)).not.toBeInTheDocument()
      );
    });
  });

  it("não regride os exemplos simples existentes (Linear, Quadrática, Racional)", async () => {
    render(<GraphsWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: /adicionar exemplo linear/i }));
    fireEvent.click(screen.getByRole("button", { name: /adicionar exemplo quadrática/i }));
    fireEvent.click(screen.getByRole("button", { name: /adicionar exemplo racional/i }));

    await screen.findByLabelText(/ocultar função 2x \+ 1/i);
    await screen.findByLabelText(/ocultar função x\^2 - 4/i);
    await screen.findByLabelText(/ocultar função 1\/x/i);
    await waitFor(() =>
      expect(screen.queryByText(/não foi possível|não permitid[ao]/i)).not.toBeInTheDocument()
    );
  });
});
