import { describe, expect, it } from "vitest";

import {
  calculatorLink,
  exercisesLink,
  formulasLink,
  getCalculatorExplorations,
  getFormulaConnections,
  getGeometryConnections,
  graphsLink,
} from "./connections";

describe("URL helpers", () => {
  it("calculatorLink codifica a expressão", () => {
    expect(calculatorLink("x² - 4 = 0")).toBe("/calculadora?expression=x%C2%B2%20-%204%20%3D%200");
  });

  it("graphsLink codifica a função", () => {
    expect(graphsLink("x^2-4")).toBe("/graficos?fn=x%5E2-4");
  });

  it("exercisesLink codifica o slug", () => {
    expect(exercisesLink("equacoes")).toBe("/aprendizado?topico=equacoes");
  });

  it("formulasLink sem parâmetros aponta pra rota base", () => {
    expect(formulasLink({})).toBe("/formulas");
  });

  it("formulasLink com categoria e busca", () => {
    expect(formulasLink({ categoria: "algebra", q: "bhaskara" })).toBe("/formulas?categoria=algebra&q=bhaskara");
  });
});

describe("getFormulaConnections", () => {
  it("bhaskara tem calculadora, gráfico e exercícios", () => {
    const links = getFormulaConnections("bhaskara");
    expect(links).toHaveLength(3);
    expect(links.map((link) => link.label)).toEqual([
      "Abrir na calculadora",
      "Visualizar nos gráficos",
      "Exercícios relacionados",
    ]);
  });

  it("fórmula sem curadoria não tem nenhuma conexão (nunca um fallback genérico)", () => {
    expect(getFormulaConnections("area-trapezio")).toEqual([]);
    expect(getFormulaConnections("id-que-nao-existe")).toEqual([]);
  });
});

describe("getGeometryConnections", () => {
  it("triângulo tem fórmulas e exercícios", () => {
    expect(getGeometryConnections("triangle")).toHaveLength(2);
  });

  it("círculo tem só fórmulas (a ação de calculadora é dinâmica, montada no componente)", () => {
    expect(getGeometryConnections("circle")).toHaveLength(1);
  });

  it("elipse/hipérbole não têm conexão estática (sem fórmula própria no catálogo)", () => {
    expect(getGeometryConnections("ellipse")).toEqual([]);
    expect(getGeometryConnections("hyperbola")).toEqual([]);
  });
});

describe("getCalculatorExplorations", () => {
  it("equação quadrática sugere gráfico, fórmula e exercícios", () => {
    const links = getCalculatorExplorations("x² - 4 = 0");
    expect(links.map((link) => link.label)).toEqual([
      "Ver gráfico",
      "Ver fórmula relacionada",
      "Praticar exercícios semelhantes",
    ]);
    expect(links[0].href).toBe(graphsLink("x² - 4"));
  });

  it("equação quadrática com lado direito diferente de 0 não sugere gráfico (evita função errada)", () => {
    const links = getCalculatorExplorations("x² - 4 = 5");
    expect(links.map((link) => link.label)).not.toContain("Ver gráfico");
  });

  it("derivada sugere fórmula de cálculo", () => {
    const links = getCalculatorExplorations("d/dx(x² + 3x)");
    expect(links).toEqual([
      { icon: "📚", label: "Ver fórmula relacionada", href: formulasLink({ categoria: "calculo" }) },
    ]);
  });

  it("trigonometria sugere exercícios", () => {
    const links = getCalculatorExplorations("sen(π/6)");
    expect(links).toEqual([
      { icon: "📝", label: "Praticar exercícios semelhantes", href: exercisesLink("trigonometria") },
    ]);
  });

  it("expressão sem classificação não sugere nada", () => {
    expect(getCalculatorExplorations("2 + 2")).toEqual([]);
  });

  it("somatório (sintaxe principal Σ) sugere fórmula e exercícios de Somatórios", () => {
    const links = getCalculatorExplorations("Σ(i=1..10) i");
    expect(links).toEqual([
      { icon: "📚", label: "Ver fórmula relacionada", href: formulasLink({ categoria: "somatorios" }) },
      { icon: "📝", label: "Praticar exercícios semelhantes", href: exercisesLink("somatorios") },
    ]);
  });

  it("somatório via aliases sum(...)/somatorio(...) é reconhecido do mesmo jeito", () => {
    expect(getCalculatorExplorations("sum(i,1,10,i)")).toHaveLength(2);
    expect(getCalculatorExplorations("somatorio(i,1,10,i)")).toHaveLength(2);
  });

  it("corpo de somatório com '^2' e '=' no cabeçalho não é roubado pela heurística de equação do 2º grau", () => {
    const links = getCalculatorExplorations("Σ(i=1..5) sin(i)^2 + cos(i)^2");
    expect(links.map((link) => link.label)).toEqual(["Ver fórmula relacionada", "Praticar exercícios semelhantes"]);
  });

  // --- Sprint V2.2 (Motor de Matrizes) ---------------------------------

  it("literal de matriz sugere propriedades, fórmulas e exercícios de Álgebra Linear", () => {
    const links = getCalculatorExplorations("[[1,2],[3,4]]");
    expect(links).toEqual([
      { icon: "🧮", label: "Ver propriedades", href: calculatorLink("det([[1,2],[3,4]])") },
      { icon: "📚", label: "Ver fórmulas relacionadas", href: formulasLink({ categoria: "algebra-linear" }) },
      { icon: "📝", label: "Exercícios semelhantes", href: exercisesLink("algebra-linear") },
    ]);
  });

  it("operação entre matrizes também é reconhecida (não só o literal isolado)", () => {
    const links = getCalculatorExplorations("[[1,2],[3,4]] + [[5,6],[7,8]]");
    expect(links.map((link) => link.label)).toEqual(["Ver fórmulas relacionadas", "Exercícios semelhantes"]);
  });

  it("escalar antes da matriz também é reconhecido ('2 * [[...]]' não começa com '[[')", () => {
    const links = getCalculatorExplorations("2 * [[1,2],[3,4]]");
    expect(links.map((link) => link.label)).toEqual(["Ver fórmulas relacionadas", "Exercícios semelhantes"]);
  });

  it("det(...)/inv(...)/transpose(...)/trace(...) e aliases PT-BR são reconhecidos sem 'Ver propriedades' (expressão já não é um literal puro)", () => {
    for (const expression of [
      "det([[1,2],[3,4]])",
      "inv([[1,2],[3,4]])",
      "transpose([[1,2],[3,4]])",
      "trace([[1,2],[3,4]])",
      "determinante([[1,2],[3,4]])",
      "inversa([[1,2],[3,4]])",
      "transposta([[1,2],[3,4]])",
      "traço([[1,2],[3,4]])",
    ]) {
      const links = getCalculatorExplorations(expression);
      expect(links.map((link) => link.label), expression).toEqual([
        "Ver fórmulas relacionadas",
        "Exercícios semelhantes",
      ]);
    }
  });
});
