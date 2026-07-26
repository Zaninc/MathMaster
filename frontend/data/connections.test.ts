import { describe, expect, it } from "vitest";

import {
  calculatorLink,
  exercisesLink,
  formulasLink,
  getCalculatorExplorations,
  getFormulaConnections,
  getGeometryConnections,
  graphsLink,
  isComplex,
  isLinearSystem,
} from "./connections";

describe("URL helpers", () => {
  it("calculatorLink codifica a expressão", () => {
    expect(calculatorLink("x² - 4 = 0")).toBe("/calculadora?expression=x%C2%B2%20-%204%20%3D%200");
  });

  /**
   * Investigação "Ver propriedades" (pós-Sprint V2.3): `autoSolve` é
   * opt-in — omitido ou `false`, o href continua BYTE A BYTE igual a
   * antes (nenhum outro consumidor de `calculatorLink` no app hoje passa
   * essa opção). Só `true` acrescenta o marcador.
   */
  it("calculatorLink com autoSolve acrescenta o marcador, sem afetar chamadas sem a opção", () => {
    expect(calculatorLink("det([[1,2],[3,4]])", { autoSolve: true })).toBe(
      "/calculadora?expression=det(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)&autoSolve=1"
    );
    expect(calculatorLink("det([[1,2],[3,4]])", { autoSolve: false })).toBe(
      "/calculadora?expression=det(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)"
    );
    expect(calculatorLink("det([[1,2],[3,4]])")).toBe(
      "/calculadora?expression=det(%5B%5B1%2C2%5D%2C%5B3%2C4%5D%5D)"
    );
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

  it("Sprint V2.4: sistema-linear-2x2 tem calculadora e exercícios", () => {
    const links = getFormulaConnections("sistema-linear-2x2");
    expect(links).toEqual([
      { icon: "🧮", label: "Abrir na calculadora", href: calculatorLink("x+y=5\nx-y=1") },
      { icon: "📝", label: "Exercícios relacionados", href: exercisesLink("algebra-linear") },
    ]);
  });

  it("Sprint V2.4: fórmulas conceituais (forma matricial/condição/Cramer) não têm ação sem destino funcional", () => {
    expect(getFormulaConnections("sistema-linear-forma-matricial")).toEqual([]);
    expect(getFormulaConnections("sistema-linear-condicao-solucao-unica")).toEqual([]);
    expect(getFormulaConnections("regra-cramer")).toEqual([]);
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
      {
        icon: "🧮",
        label: "Ver propriedades",
        href: calculatorLink("det([[1,2],[3,4]])", { autoSolve: true }),
        requiresFreshRequest: true,
      },
      { icon: "📚", label: "Ver fórmulas relacionadas", href: formulasLink({ categoria: "algebra-linear" }) },
      { icon: "📝", label: "Exercícios semelhantes", href: exercisesLink("algebra-linear") },
    ]);
  });

  it("operação entre matrizes também é reconhecida e ganha 'Ver propriedades' (Sprint V2.2.1: resultado da operação é matriz)", () => {
    const links = getCalculatorExplorations("[[1,2],[3,4]] + [[5,6],[7,8]]");
    expect(links).toEqual([
      {
        icon: "🧮",
        label: "Ver propriedades",
        href: calculatorLink("det([[1,2],[3,4]] + [[5,6],[7,8]])", { autoSolve: true }),
        requiresFreshRequest: true,
      },
      { icon: "📚", label: "Ver fórmulas relacionadas", href: formulasLink({ categoria: "algebra-linear" }) },
      { icon: "📝", label: "Exercícios semelhantes", href: exercisesLink("algebra-linear") },
    ]);
  });

  it("escalar antes da matriz também é reconhecido ('2 * [[...]]' não começa com '[[') e ganha 'Ver propriedades'", () => {
    const links = getCalculatorExplorations("2 * [[1,2],[3,4]]");
    expect(links.map((link) => link.label)).toEqual([
      "Ver propriedades",
      "Ver fórmulas relacionadas",
      "Exercícios semelhantes",
    ]);
  });

  it("det(...)/trace(...) e aliases PT-BR são reconhecidos sem 'Ver propriedades' (resultado já é escalar, compor det(det(...)) não faz sentido)", () => {
    for (const expression of [
      "det([[1,2],[3,4]])",
      "trace([[1,2],[3,4]])",
      "determinante([[1,2],[3,4]])",
      "traço([[1,2],[3,4]])",
    ]) {
      const links = getCalculatorExplorations(expression);
      expect(links.map((link) => link.label), expression).toEqual([
        "Ver fórmulas relacionadas",
        "Exercícios semelhantes",
      ]);
    }
  });

  /**
   * Investigação "Ver propriedades" (pós-Sprint V2.3): diferente de
   * det(...)/trace(...) acima, `inv(...)`/`transpose(...)` PRODUZEM uma
   * matriz — "Ver propriedades" continua fazendo sentido para eles
   * (compor "det(inv(A))"/"det(transpose(A))" é um cálculo diferente e
   * útil, não uma composição redundante como "det(det(A))"). A versão
   * anterior desta regra tratava os quatro nomes igual, escondendo o
   * botão errado para estes dois — corrigido em
   * `SCALAR_MATRIX_PROPERTY_CALL_PATTERN`.
   */
  it("inv(...)/transpose(...) e aliases PT-BR CONTINUAM mostrando 'Ver propriedades' (resultado é matriz, não escalar)", () => {
    for (const expression of [
      "inv([[1,2],[3,4]])",
      "transpose([[1,2],[3,4]])",
      "inversa([[1,2],[3,4]])",
      "transposta([[1,2],[3,4]])",
    ]) {
      const links = getCalculatorExplorations(expression);
      expect(links.map((link) => link.label), expression).toEqual([
        "Ver propriedades",
        "Ver fórmulas relacionadas",
        "Exercícios semelhantes",
      ]);
      expect(links[0].href, expression).toBe(calculatorLink(`det(${expression})`, { autoSolve: true }));
      expect(links[0].requiresFreshRequest, expression).toBe(true);
    }
  });

  // --- Sprint V2.2.1 (Variáveis Locais para Matrizes) --------------------

  it("programa com atribuição e referência de variável na instrução final ganha 'Ver propriedades', preservando as atribuições no link", () => {
    const links = getCalculatorExplorations("A=[[1,2],[3,4]]\nA");
    expect(links).toEqual([
      {
        icon: "🧮",
        label: "Ver propriedades",
        href: calculatorLink("A=[[1,2],[3,4]]\ndet(A)", { autoSolve: true }),
        requiresFreshRequest: true,
      },
      { icon: "📚", label: "Ver fórmulas relacionadas", href: formulasLink({ categoria: "algebra-linear" }) },
      { icon: "📝", label: "Exercícios semelhantes", href: exercisesLink("algebra-linear") },
    ]);
  });

  it("programa com duas atribuições e uma operação na instrução final ganha 'Ver propriedades' com as DUAS atribuições preservadas", () => {
    const links = getCalculatorExplorations("A=[[1,2],[3,4]]\nB=[[5,6],[7,8]]\nA+B");
    expect(links[0]).toEqual({
      icon: "🧮",
      label: "Ver propriedades",
      href: calculatorLink("A=[[1,2],[3,4]]\nB=[[5,6],[7,8]]\ndet(A+B)", { autoSolve: true }),
      requiresFreshRequest: true,
    });
  });

  it("programa com atribuição e det(A) na instrução final NÃO mostra 'Ver propriedades' (já é uma chamada pronta)", () => {
    const links = getCalculatorExplorations("A=[[1,2],[3,4]]\ndet(A)");
    expect(links.map((link) => link.label)).toEqual(["Ver fórmulas relacionadas", "Exercícios semelhantes"]);
  });

  it("';' também separa instruções — mesmo resultado que '\\n'", () => {
    const withNewline = getCalculatorExplorations("A=[[1,2],[3,4]]\ndet(A)");
    const withSemicolon = getCalculatorExplorations("A=[[1,2],[3,4]]; det(A)");
    expect(withSemicolon).toEqual(withNewline);
  });

  it("uma matriz formatada em várias linhas (sem atribuição) continua tratada como UMA instrução só", () => {
    const links = getCalculatorExplorations("[[1, 2],\n [3, 4]]");
    expect(links[0]).toEqual({
      icon: "🧮",
      label: "Ver propriedades",
      href: calculatorLink("det([[1, 2],\n [3, 4]])", { autoSolve: true }),
      requiresFreshRequest: true,
    });
  });

  it("variável indefinida na instrução final (sem 'A' no gate) não é confundida com matriz por acaso", () => {
    // "5" sozinho não tem "[[" nem chamada de função — mesmo com uma
    // atribuição de matriz antes, o gate (`isMatrix` na expressão inteira)
    // ainda é true (tem "[["), então isto cai no ramo de matriz; não é o
    // uso pretendido, mas documentado aqui para não regredir em silêncio.
    const links = getCalculatorExplorations("A=[[1,2],[3,4]]\n5");
    expect(links.map((link) => link.label)).toContain("Ver fórmulas relacionadas");
  });

  // --- Sprint V2.3 (Motor de Números Complexos) --------------------------

  it("aritmética com i sugere fórmulas e exercícios de Números Complexos", () => {
    const links = getCalculatorExplorations("(2+i)*(3-i)");
    expect(links).toEqual([
      { icon: "📚", label: "Ver fórmulas relacionadas", href: formulasLink({ categoria: "numeros-complexos" }) },
      { icon: "📝", label: "Exercícios semelhantes", href: exercisesLink("numeros-complexos") },
    ]);
  });

  it("chamada de função complexa em qualquer posição (ex. 'i' colado a um dígito) é reconhecida", () => {
    expect(getCalculatorExplorations("3-4i")).toHaveLength(2);
    expect(getCalculatorExplorations("conjugado(3+4i)")).toHaveLength(2);
    expect(getCalculatorExplorations("modulo(3+4i)")).toHaveLength(2);
  });

  it("equação usando 'i' (ex. 'i^2 = -1') não é roubada pelo gate de números complexos", () => {
    expect(isComplex("i^2 = -1")).toBe(false);
  });

  // --- Sprint V2.4 (Sistemas Lineares) ------------------------------------

  it("sistema linear (quebra de linha) sugere fórmula e exercícios de Álgebra Linear, sem 'Ver propriedades'", () => {
    const links = getCalculatorExplorations("x+y=5\nx-y=1");
    expect(links).toEqual([
      { icon: "📚", label: "Ver fórmula relacionada", href: formulasLink({ categoria: "algebra-linear" }) },
      { icon: "📝", label: "Exercícios semelhantes", href: exercisesLink("algebra-linear") },
    ]);
  });

  it("sistema linear separado por ';' produz o mesmo resultado que separado por quebra de linha", () => {
    const withSemicolon = getCalculatorExplorations("x+y=5; x-y=1");
    const withNewline = getCalculatorExplorations("x+y=5\nx-y=1");
    expect(withSemicolon).toEqual(withNewline);
  });

  it("sistema com três incógnitas também é reconhecido", () => {
    expect(getCalculatorExplorations("x+y+z=6\nx-y=0\ny-z=1")).toHaveLength(2);
  });

  it("uma única equação (sem sistema) NÃO aciona o bloco de Álgebra Linear", () => {
    expect(getCalculatorExplorations("x+y=5")).toEqual([]);
  });

  it("um programa de matriz com várias atribuições não é confundido com sistema (matriz tem prioridade, mesma cascata do backend)", () => {
    const links = getCalculatorExplorations("A=[[1,2],[3,4]]\nB=[[5,6],[7,8]]\nA+B");
    expect(links.some((link) => link.label === "Ver fórmula relacionada")).toBe(false);
    expect(links.some((link) => link.href === formulasLink({ categoria: "algebra-linear" }))).toBe(true);
    // A entrada é classificada como matriz (não sistema): recebe o bloco de
    // matriz, que inclui "Ver propriedades" — sistema nunca inclui.
    expect(links.some((link) => link.label === "Ver propriedades")).toBe(true);
  });

  it("';' separando expressões que não são equações não vira sistema (mesmo comportamento de erro do backend)", () => {
    expect(getCalculatorExplorations("2+2; 3+3")).toEqual([]);
  });
});

describe("isLinearSystem", () => {
  it("reconhece 2+ equações separadas por quebra de linha ou ';'", () => {
    expect(isLinearSystem("x+y=5\nx-y=1")).toBe(true);
    expect(isLinearSystem("x+y=5; x-y=1")).toBe(true);
    expect(isLinearSystem("x+y+z=6\nx-y=0\ny-z=1")).toBe(true);
  });

  it("nunca reconhece uma única equação", () => {
    expect(isLinearSystem("x+y=5")).toBe(false);
    expect(isLinearSystem("x=2")).toBe(false);
  });

  it("nunca reconhece um programa de matriz com múltiplas linhas (matriz tem prioridade)", () => {
    expect(isLinearSystem("A=[[1,2],[3,4]]\nB=[[5,6],[7,8]]\nA+B")).toBe(false);
    expect(isLinearSystem("A=[[1,2],[3,4]]\ndet(A)")).toBe(false);
  });

  it("nunca reconhece instruções separadas por ';' que não sejam equações", () => {
    expect(isLinearSystem("2+2; 3+3")).toBe(false);
    expect(isLinearSystem("x=5; y+2")).toBe(false);
  });

  it("nunca reconhece uma expressão vazia ou sem separador", () => {
    expect(isLinearSystem("")).toBe(false);
    expect(isLinearSystem("2+2")).toBe(false);
  });
});

describe("isComplex", () => {
  it("reconhece a unidade imaginária isolada, mesmo colada a um dígito", () => {
    expect(isComplex("2+i")).toBe(true);
    expect(isComplex("3-4i")).toBe(true);
    expect(isComplex("-5+2i")).toBe(true);
    expect(isComplex("i")).toBe(true);
  });

  it("reconhece as quatro funções, canônicas e aliases PT-BR/EN", () => {
    for (const name of ["conjugado", "conj", "modulo", "abs", "argumento", "arg", "polar"]) {
      expect(isComplex(`${name}(1+i)`), name).toBe(true);
    }
  });

  it("não confunde 'i' dentro de um identificador maior com a unidade imaginária", () => {
    expect(isComplex("circunferencia((0,0),5)")).toBe(false);
    expect(isComplex("sin(x)")).toBe(false);
  });

  it("nunca reivindica uma expressão com '=' (preserva equações/definições existentes)", () => {
    expect(isComplex("modulo(x) = 5")).toBe(false);
    expect(isComplex("i = 5")).toBe(false);
  });

  it("expressão sem nenhuma referência a i não é reconhecida", () => {
    expect(isComplex("2 + 2")).toBe(false);
  });
});
