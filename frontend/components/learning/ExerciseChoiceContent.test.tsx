import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExerciseChoiceContent } from "./ExerciseChoiceContent";

/**
 * Sprint "KaTeX em alternativas" — cobertura do componente centralizado
 * que decide texto puro vs. KaTeX por informação ESTRUTURAL
 * (`ExerciseChoice.format`), nunca por heurística sobre o conteúdo (ver
 * docstring do componente). `role="math"`/`aria-label` vêm de
 * `MathFormula` quando o KaTeX falha ao parsear (fallback `<code>`) —
 * quando o parse funciona, o HTML do KaTeX é injetado via
 * `dangerouslySetInnerHTML`, então as asserções abaixo checam o
 * `innerHTML` renderizado (presença de classes/comandos KaTeX) em vez de
 * `getByText`, que não enxerga texto dentro de HTML injetado.
 */
describe("ExerciseChoiceContent", () => {
  describe("matemática (format: math)", () => {
    it.each([
      ["x = 3", "x"],
      ["2^x", "2"],
      ["x^2 + 3x - 4", "x"],
      ["2/3", "2"],
      ["sqrt(5)", "5"],
      ["ln(x)", "ln"],
      ["e^x", "e"],
    ])("renderiza %s como KaTeX (nunca o texto cru sem processamento)", async (content) => {
      const { container } = render(<ExerciseChoiceContent choice={{ content, format: "math" }} />);

      await waitFor(() => {
        expect(container.querySelector(".katex")).toBeInTheDocument();
      });
    });

    it("não mostra a sintaxe interna crua (log/exp/sqrt) quando existe forma visual melhor", async () => {
      const { container } = render(
        <ExerciseChoiceContent choice={{ content: "sqrt(5)", format: "math" }} />
      );

      await waitFor(() => {
        expect(container.querySelector(".katex")).toBeInTheDocument();
      });
      // "sqrt(" nunca deveria sobreviver como texto cru — vira o símbolo de
      // raiz do KaTeX (mathml + html, nunca a string "sqrt").
      expect(container.textContent).not.toContain("sqrt(");
    });

    it("mostra o texto puro enquanto a conversão está pendente (nunca undefined/branco)", () => {
      render(<ExerciseChoiceContent choice={{ content: "x = 3", format: "math" }} />);
      // Antes do useEffect assíncrono resolver, o fallback síncrono é o
      // texto puro — nunca um flash vazio.
      expect(screen.getByText("x = 3")).toBeInTheDocument();
    });
  });

  describe("texto (format: text ou string bare)", () => {
    it.each([
      "Não possui solução real",
      "Duas raízes reais distintas",
      "Função crescente",
      "Nenhuma das anteriores",
    ])("mantém %s como texto puro, nunca tenta KaTeX", (content) => {
      const { container } = render(<ExerciseChoiceContent choice={{ content, format: "text" }} />);

      expect(screen.getByText(content)).toBeInTheDocument();
      expect(container.querySelector(".katex")).not.toBeInTheDocument();
    });

    it("uma string bare (formato legado) renderiza igual a format: text", () => {
      const { container } = render(<ExerciseChoiceContent choice="Não possui solução real" />);

      expect(screen.getByText("Não possui solução real")).toBeInTheDocument();
      expect(container.querySelector(".katex")).not.toBeInTheDocument();
    });

    it("uma string bare com sintaxe matemática NUNCA vira KaTeX sem o format explícito", () => {
      // A prioridade é a informação estrutural, nunca heurística sobre o
      // conteúdo — "x = 3" como string bare continua texto puro, mesmo
      // parecendo matemática, porque ninguém marcou format: "math".
      const { container } = render(<ExerciseChoiceContent choice="x = 3" />);

      expect(screen.getByText("x = 3")).toBeInTheDocument();
      expect(container.querySelector(".katex")).not.toBeInTheDocument();
    });
  });

  describe("compatibilidade", () => {
    it("string bare e {content, format: 'text'} produzem o mesmo resultado visual", () => {
      const { container: bare } = render(<ExerciseChoiceContent choice="Função crescente" />);
      const { container: explicit } = render(
        <ExerciseChoiceContent choice={{ content: "Função crescente", format: "text" }} />
      );
      expect(bare.textContent).toBe(explicit.textContent);
    });
  });
});
