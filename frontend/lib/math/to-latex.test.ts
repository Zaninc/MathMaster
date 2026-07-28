import katex from "katex";
import { describe, expect, it } from "vitest";

import {
  expressionToLatex,
  inputToLatex,
  previewLatex,
  resultEchoesExpression,
  resultToLatex,
  safeExpressionLatex,
  valueToLatex,
} from "./to-latex";

/** A pré-visualização real usa `throwOnError:false`; aqui usamos `true` de propósito — qualquer caso que lance aqui exporia o glifo de erro vermelho em produção. */
function assertRendersSafely(latex: string, label: string): void {
  expect(() => katex.renderToString(latex, { throwOnError: true, strict: "ignore" }), label).not.toThrow();
}

/**
 * O espaçamento fino do `toTex` do mathjs ("~", espaços) é detalhe de
 * implementação — os testes asseram a ESTRUTURA LaTeX com espaços
 * removidos, para não quebrarem num upgrade de versão do mathjs.
 */
function normalized(latex: string | null): string {
  expect(latex).not.toBeNull();
  return (latex as string).replace(/[\s~]|\\[,;:!]/g, "");
}

describe("expressionToLatex", () => {
  it("converte raízes com argumento composto", async () => {
    expect(normalized(await expressionToLatex("sqrt(x + 1)"))).toContain("\\sqrt{x+1}");
    expect(normalized(await expressionToLatex("√(x + 1)"))).toContain("\\sqrt{x+1}");
  });

  it("converte divisão para fração", async () => {
    const latex = normalized(await expressionToLatex("(x + 1)/(x - 1)"));
    expect(latex).toContain("\\frac");
    expect(latex).toContain("x+1");
    expect(latex).toContain("x-1");
  });

  it("converte potências Unicode e ASCII, incluindo expoente negativo", async () => {
    expect(normalized(await expressionToLatex("x² + y² = 25"))).toContain("^{2}");
    expect(normalized(await expressionToLatex("x**2 - 4"))).toContain("^{2}");
    expect(normalized(await expressionToLatex("2⁻³"))).toContain("^{-3}");
  });

  it("converte coeficiente implícito com raiz (2√2)", async () => {
    expect(normalized(await expressionToLatex("2√2"))).toContain("\\sqrt{2}");
  });

  it("respeita a convenção do produto para log/ln (log NUNCA vira \\ln)", async () => {
    expect(await expressionToLatex("log(100)")).toContain("\\log");
    expect(await expressionToLatex("log(100)")).not.toContain("\\ln");
    expect(await expressionToLatex("1/(x*ln(10))")).toContain("\\ln");
  });

  it("preserva a notação pt-BR sen/tg via operatorname", async () => {
    expect(await expressionToLatex("sen(x)")).toContain("\\operatorname{sen}");
    expect(await expressionToLatex("tg(x)")).toContain("\\operatorname{tg}");
  });

  // --- Sprint V2.2 (Motor de Matrizes) — mathjs já entende "[[...]]"
  // nativamente como matriz; só os aliases PT-BR de função precisam de um
  // caso dedicado (ver `MATRIX_ALIAS_LATEX`).

  it("converte um literal de matriz para \\begin{bmatrix}", async () => {
    const latex = normalized(await expressionToLatex("[[1,2],[3,4]]"));
    expect(latex).toContain("\\begin{bmatrix}");
    expect(latex).toContain("\\end{bmatrix}");
    expect(latex).toContain("1&2");
    expect(latex).toContain("3&4");
  });

  it("converte operações entre matrizes (soma, escalar, potência)", async () => {
    expect(normalized(await expressionToLatex("[[1,2],[3,4]] + [[5,6],[7,8]]"))).toContain(
      "\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}+\\begin{bmatrix}5&6\\\\7&8\\end{bmatrix}"
    );
    expect(normalized(await expressionToLatex("2 * [[1,2],[3,4]]"))).toContain(
      "2\\cdot\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}"
    );
    expect(normalized(await expressionToLatex("[[1,2],[3,4]] ^ 2"))).toContain("^{2}");
  });

  it("converte det/inv/transpose/trace com a notação nativa do mathjs", async () => {
    expect(await expressionToLatex("det([[1,2],[3,4]])")).toContain("\\det");
    expect(normalized(await expressionToLatex("inv([[1,2],[3,4]])"))).toContain("^{-1}");
    expect(normalized(await expressionToLatex("transpose([[1,2],[3,4]])"))).toContain(
      "^\\top"
    );
    expect(await expressionToLatex("trace([[1,2],[3,4]])")).toContain("\\mathrm{tr}");
  });

  it("converte os aliases PT-BR de matriz com a MESMA notação dos nomes canônicos", async () => {
    expect(await expressionToLatex("determinante([[1,2],[3,4]])")).toBe(
      await expressionToLatex("det([[1,2],[3,4]])")
    );
    expect(await expressionToLatex("inversa([[1,2],[3,4]])")).toBe(
      await expressionToLatex("inv([[1,2],[3,4]])")
    );
    expect(await expressionToLatex("transposta([[1,2],[3,4]])")).toBe(
      await expressionToLatex("transpose([[1,2],[3,4]])")
    );
    expect(await expressionToLatex("traço([[1,2],[3,4]])")).toBe(
      await expressionToLatex("trace([[1,2],[3,4]])")
    );
  });

  it("converte equações lado a lado, incluindo subscritos de solução", async () => {
    expect(normalized(await expressionToLatex("x = 100"))).toBe("x=100");
    expect(normalized(await expressionToLatex("x₁ = -2"))).toContain("x_{1}");
    expect(normalized(await expressionToLatex("f(2) = 10"))).toContain("=10");
  });

  it("converte as formas SymPy dos wrappers de cálculo", async () => {
    const integral = normalized(await expressionToLatex("Integral(x**2, x)"));
    expect(integral).toContain("\\int");
    expect(integral).toContain("^{2}");
    expect(integral).toContain("dx");

    const limit = normalized(await expressionToLatex("Limit(sin(x)/x, x, 0)"));
    expect(limit).toContain("\\lim_{x\\to0}");
    expect(limit).toContain("\\frac");
    expect(limit).toContain("\\sin");
  });

  it("converte os aliases sum(...)/somatorio(...) (ordem: variável, inferior, superior, expressão)", async () => {
    const sum = normalized(await expressionToLatex("sum(i,1,10,i)"));
    expect(sum).toContain("\\sum_{i=1}^{10}");

    const somatorio = normalized(await expressionToLatex("somatorio(i,1,10,i)"));
    expect(somatorio).toContain("\\sum_{i=1}^{10}");
  });

  it("falha fechado para símbolos fora do catálogo e palavras puras", async () => {
    expect(await expressionToLatex("Perpendiculares ⊥")).toBeNull();
    expect(await expressionToLatex("crescente")).toBeNull();
    expect(await expressionToLatex("")).toBeNull();
  });

  it("chamada de função vazia (template em digitação) nunca converte — cai no fallback", async () => {
    expect(await expressionToLatex("sqrt()")).toBeNull();
    expect(await expressionToLatex("√()")).toBeNull();
    expect(await expressionToLatex("∛()")).toBeNull();
    expect(await expressionToLatex("eˣ()")).toBeNull();
    expect(await expressionToLatex("log()")).toBeNull();
    expect(await expressionToLatex("log()/log()")).toBeNull();
  });

  it("converte a raiz cúbica (Unicode e ASCII) como radical com índice", async () => {
    expect(normalized(await expressionToLatex("∛(8)"))).toContain("\\sqrt[3]{8}");
    expect(normalized(await expressionToLatex("cbrt(8)"))).toContain("\\sqrt[3]{8}");
  });

  it("renderiza os templates visuais do teclado: eˣ( como e elevado e ⁿ como expoente n", async () => {
    expect(normalized(await expressionToLatex("eˣ(2)"))).toContain("e^{2}");
    expect(normalized(await expressionToLatex("exp(2)"))).toContain("e^{2}");
    expect(normalized(await expressionToLatex("(2)ⁿ"))).toContain("^{n}");
    expect(normalized(await expressionToLatex("xⁿ"))).toContain("^{n}");
    // "²ⁿ" não é template oficial — fail-closed.
    expect(await expressionToLatex("x²ⁿ")).toBeNull();
  });

  // --- Sprint V2.2.1 (Variáveis Locais para Matrizes) ---------------------

  it("converte um programa de matriz multi-linha (atribuições + expressão final)", async () => {
    const latex = normalized(
      await expressionToLatex("A=[[1,2],[3,4]]\nB=[[5,6],[7,8]]\nA*B")
    );
    expect(latex).toContain("\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}");
    expect(latex).toContain("\\begin{bmatrix}5&6\\\\7&8\\end{bmatrix}");
    expect(latex).toContain("\\cdot");
  });

  it("converte um programa de matriz separado por ';' com o mesmo conteúdo de um separado por quebra de linha", async () => {
    // O mathjs preserva o ";" como token literal no LaTeX (separador
    // visível), então a string não é byte-idêntica à versão com "\n" — só
    // o CONTEÚDO (as duas matrizes + o det) precisa ser o mesmo.
    const withSemicolon = normalized(await expressionToLatex("A=[[1,2],[3,4]]; det(A)"));
    const withNewline = normalized(await expressionToLatex("A=[[1,2],[3,4]]\ndet(A)"));
    expect(withSemicolon.replace(/;/g, "")).toBe(withNewline.replace(/;/g, ""));
  });

  it("uma equação simples de UMA linha continua indo pelo split de '=' de sempre (regressão)", async () => {
    // Sem "[[" nem "\n"/";" — não deve entrar no atalho de programa de
    // matriz; continua reconhecendo "x = 2" via EQUATION_SPLIT.
    const latex = normalized(await expressionToLatex("x = 2"));
    expect(latex).toBe("x=2");
  });

  it("uma matriz de duas linhas SEM atribuição (só formatação visual) continua funcionando (regressão da colisão com pairToLatex)", async () => {
    const latex = normalized(await expressionToLatex("[[1, 2],\n [3, 4]]"));
    expect(latex).toContain("\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}");
    expect(latex).not.toContain("\\right)");
  });

  // --- Sprint V2.3 (Motor de Números Complexos) — o mathjs já reconhece
  // "i" nativamente como unidade imaginária; só os aliases PT-BR/EN de
  // função (conjugado/conj/modulo/abs/argumento/arg) precisam de um caso
  // dedicado (ver `COMPLEX_ALIAS_LATEX`).

  it("converte a unidade imaginária e aritmética retangular", async () => {
    expect(normalized(await expressionToLatex("3+4i"))).toContain("i");
    expect(normalized(await expressionToLatex("(2+i)*(3-i)"))).toContain(
      "\\left(2+i\\right)\\cdot\\left(3-i\\right)"
    );
  });

  it("converte conjugado/conj com a notação de barra superior", async () => {
    expect(normalized(await expressionToLatex("conjugado(3+4i)"))).toContain("\\overline{3+4i}");
    expect(await expressionToLatex("conj(3+4i)")).toBe(await expressionToLatex("conjugado(3+4i)"));
  });

  it("converte modulo/abs com a notação de módulo (barras)", async () => {
    expect(normalized(await expressionToLatex("modulo(3+4i)"))).toContain("\\left|3+4i\\right|");
    expect(await expressionToLatex("abs(3+4i)")).toBe(await expressionToLatex("modulo(3+4i)"));
  });

  it("converte argumento/arg com \\arg", async () => {
    expect(normalized(await expressionToLatex("argumento(1+i)"))).toContain("\\arg\\left(1+i\\right)");
    expect(await expressionToLatex("arg(1+i)")).toBe(await expressionToLatex("argumento(1+i)"));
  });

  // --- Sprint V2.6 (Motor de Polinômios Avançados) — as sete operações não
  // têm notação dedicada, só `\operatorname{}` com o nome em português (ver
  // `POLYNOMIAL_OPERATION_LATEX`); `coeficientes(...)` precisa de um caso
  // à parte para não virar uma matriz coluna (comportamento default do
  // mathjs para QUALQUER array).

  it("converte fatorar/expandir/simplificar/grau com \\operatorname", async () => {
    expect(normalized(await expressionToLatex("fatorar(x^2-9)"))).toBe(
      "\\operatorname{fatorar}\\left({x}^{2}-9\\right)"
    );
    expect(normalized(await expressionToLatex("expandir((x+2)^3)"))).toBe(
      "\\operatorname{expandir}\\left({\\left(x+2\\right)}^{3}\\right)"
    );
    expect(normalized(await expressionToLatex("simplificar((x^2-1)/(x-1))"))).toContain(
      "\\operatorname{simplificar}"
    );
    expect(normalized(await expressionToLatex("grau(x^5+1)"))).toBe(
      "\\operatorname{grau}\\left({x}^{5}+1\\right)"
    );
  });

  it("converte raizes/divisao (ASCII) com o rótulo acentuado correto", async () => {
    expect(normalized(await expressionToLatex("raizes(x^2-9)"))).toBe(
      "\\operatorname{raízes}\\left({x}^{2}-9\\right)"
    );
    expect(normalized(await expressionToLatex("divisao(x^3-1,x-1)"))).toBe(
      "\\operatorname{divisão}\\left({x}^{3}-1,x-1\\right)"
    );
  });

  it("converte coeficientes(...) como lista horizontal, nunca como matriz coluna", async () => {
    expect(normalized(await expressionToLatex("coeficientes(x^3+2x^2-5)"))).toBe(
      "\\operatorname{coeficientes}\\left({x}^{3}+2{x}^{2}-5\\right)"
    );
  });

  it("renderiza a LISTA RESULTADO de coeficientes ([1, 2, 0, -5]) na horizontal", async () => {
    const latex = normalized(await valueToLatex("[1, 2, 0, -5]"));
    expect(latex).toBe("\\left[1,2,0,-5\\right]");
    expect(latex).not.toContain("bmatrix");
  });

  it("não regride a renderização de matriz literal (array de arrays)", async () => {
    const latex = normalized(await expressionToLatex("[[1,2],[3,4]]"));
    expect(latex).toContain("\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}");
  });

  // --- Sprint V2.7 (Motor de Combinatória) — notação de livro didático
  // dedicada (C_{n,k}, A_{n,k}, P_n, n!), dependente da posição dos
  // argumentos (ver `COMBINATORICS_LATEX`). "6!" e frações de fatoriais o
  // mathjs já renderiza nativamente — só os NOMES precisam de handler.

  // Sprint V2.7.1 — combinação renderiza como coeficiente binomial
  // \binom{n}{k} (notação internacional); arranjo/permutação/fatorial
  // mantêm a notação da V2.7.
  it("converte combinacao/arranjo/permutacao/fatorial para a notação de livro didático", async () => {
    expect(normalized(await expressionToLatex("combinacao(10,3)"))).toBe("\\binom{10}{3}");
    expect(normalized(await expressionToLatex("combinacao(5,2)"))).toBe("\\binom{5}{2}");
    expect(normalized(await expressionToLatex("arranjo(8,3)"))).toBe("A_{8,3}");
    expect(normalized(await expressionToLatex("permutacao(5)"))).toBe("P_{5}");
    expect(normalized(await expressionToLatex("fatorial(6)"))).toBe("6!");
    expect(normalized(await expressionToLatex("fat(5)"))).toBe("5!");
  });

  it("converte permutacao_repeticao(n, a, b, ...) para P com sobrescrito", async () => {
    expect(normalized(await expressionToLatex("permutacao_repeticao(8,3,2,2)"))).toBe(
      "P_{8}^{3,2,2}"
    );
  });

  it("parentesiza o fatorial de argumento composto ((x+1)!), nunca de átomo (6!)", async () => {
    expect(normalized(await expressionToLatex("fatorial(x+1)"))).toBe("\\left(x+1\\right)!");
    expect(normalized(await expressionToLatex("fatorial(n)"))).toBe("n!");
  });

  it("converte os aliases de livro didático C(...)/A(...)/P(...) com argumentos numéricos", async () => {
    expect(normalized(await expressionToLatex("C(10,3)"))).toBe("\\binom{10}{3}");
    expect(normalized(await expressionToLatex("A(8,3)"))).toBe("A_{8,3}");
    expect(normalized(await expressionToLatex("P(5)"))).toBe("P_{5}");
  });

  it("combinação(20,10) grande também vira \\binom (Sprint V2.7.1)", async () => {
    expect(normalized(await previewLatex("combinação(20,10)"))).toContain("\\binom{20}{10}");
  });

  it("NÃO reinterpreta C/A/P com argumento simbólico (fica o fallback genérico do mathjs)", async () => {
    const latex = normalized(await expressionToLatex("A(x,3)"));
    expect(latex).not.toContain("A_{");
  });

  it("aridade errada de combinatória não vira notação dedicada (fail-closed p/ o genérico)", async () => {
    const latex = normalized(await expressionToLatex("combinacao(10,3,2)"));
    expect(latex).not.toContain("\\binom");
  });

  it("inteiro grande renderiza por extenso, nunca em notação científica (hotfix pós-V2.7.1)", async () => {
    expect(normalized(await expressionToLatex("27907200"))).toBe("27907200");
    expect(normalized(await valueToLatex("27907200"))).toBe("27907200");
    // Decimais continuam com a formatação default do mathjs.
    expect(normalized(await expressionToLatex("2.5"))).toBe("2.5");
  });

  // --- Sprint V2.8.1 (Preview Contextual de Probabilidade) —
  // probabilidade/condicional/binomial mostram a expressão já instanciada
  // com os argumentos reais, SEM resolver (mesmo padrão de combinatória);
  // complementar/uniao/intersecao_independente permanecem ABSTRATAS
  // (fora do escopo desta sprint, ver `PROBABILITY_LATEX`).

  it("converte probabilidade(a,b)/condicional(pa,pb) para P(A)/P(A|B) com os argumentos reais, sem simplificar", async () => {
    expect(normalized(await expressionToLatex("probabilidade(3,10)"))).toBe("P(A)=\\frac{3}{10}");
    expect(normalized(await expressionToLatex("probabilidade(7,20)"))).toBe("P(A)=\\frac{7}{20}");
    expect(normalized(await expressionToLatex("condicional(0.2,0.5)"))).toBe(
      "P(A\\midB)=\\frac{0.2}{0.5}"
    );
    expect(normalized(await expressionToLatex("condicional(3,8)"))).toBe("P(A\\midB)=\\frac{3}{8}");
  });

  it("mantém complementar/uniao/intersecao_independente na notação abstrata P(Aᶜ)/P(A∪B)/P(A∩B) (fora do escopo da V2.8.1)", async () => {
    expect(normalized(await expressionToLatex("complementar(0.3)"))).toBe("P(A^{c})");
    expect(normalized(await expressionToLatex("uniao(0.4,0.5,0.2)"))).toBe("P(A\\cupB)");
    expect(normalized(await expressionToLatex("intersecao_independente(0.5,0.3)"))).toBe(
      "P(A\\capB)"
    );
  });

  it("converte binomial(n,k,p) para P(X=k)=\\binom{n}{k}(p)^k(1-p)^{n-k} com os valores reais, sem calcular", async () => {
    expect(normalized(await expressionToLatex("binomial(10,3,0.5)"))).toBe(
      "P(X=3)=\\binom{10}{3}(0.5)^{3}(1-0.5)^{7}"
    );
    expect(normalized(await expressionToLatex("binomial(20,10,0.25)"))).toBe(
      "P(X=10)=\\binom{20}{10}(0.25)^{10}(1-0.25)^{10}"
    );
  });

  it("aridade errada de probabilidade não vira notação dedicada (fail-closed p/ o genérico)", async () => {
    const latex = normalized(await expressionToLatex("probabilidade(3,10,5)"));
    expect(latex).not.toBe("P(A)");
    expect(latex).not.toContain("P(A)=");
  });

  // --- Sprint V2.4 (Sistemas Lineares) ------------------------------------

  it("converte um sistema linear (quebra de linha) em \\begin{cases}...\\end{cases}", async () => {
    const latex = normalized(await expressionToLatex("x+y=5\nx-y=1"));
    expect(latex).toBe("\\begin{cases}x+y=5\\\\x-y=1\\end{cases}");
  });

  it("';' produz o MESMO \\begin{cases}...\\end{cases} que '\\n'", async () => {
    const withSemicolon = await expressionToLatex("x+y=5; x-y=1");
    const withNewline = await expressionToLatex("x+y=5\nx-y=1");
    expect(withSemicolon).toBe(withNewline);
  });

  it("sistema com três incógnitas gera três linhas dentro de cases", async () => {
    const latex = normalized(await expressionToLatex("x+y+z=6\nx-y=0\ny-z=1"));
    expect(latex).toBe("\\begin{cases}x+y+z=6\\\\x-y=0\\\\y-z=1\\end{cases}");
  });

  it("uma única equação de UMA linha continua indo pelo split de '=' de sempre (regressão, nunca vira cases)", async () => {
    const latex = normalized(await expressionToLatex("x+y=5"));
    expect(latex).toBe("x+y=5");
    expect(latex).not.toContain("cases");
  });

  it("um programa de matriz com várias atribuições não é confundido com sistema (matriz tem prioridade)", async () => {
    const latex = normalized(await expressionToLatex("A=[[1,2],[3,4]]\nB=[[5,6],[7,8]]\nA+B"));
    expect(latex).toContain("\\begin{bmatrix}");
    expect(latex).not.toContain("cases");
  });

  it("';' separando expressões que não são equações não vira sistema (fica com o comportamento antigo, nunca cases)", async () => {
    const latex = await expressionToLatex("2+2; 3+3");
    expect(latex).not.toBeNull();
    expect(latex).not.toContain("cases");
  });

  // --- Sprint V2.5 (Motor de Sistemas Polinomiais Não Lineares) — o
  // backend agora resolve sistemas polinomiais de qualquer grau
  // (`nonlinsolve`), não só lineares. Potência/produto entre incógnitas
  // ATIVAM o \begin{cases} normalmente (regressão do comportamento
  // conservador da Sprint V2.4, superado por esta sprint); só função
  // transcendental continua fora de escopo.

  it("potência (** ou ^) em qualquer equação do sistema ATIVA o cases (sistema polinomial não linear, suportado desde a Sprint V2.5)", async () => {
    for (const input of ["x**2+y=5\nx-y=1", "x^2+y=5\nx-y=1", "x+y=5\ny^2-x=1"]) {
      const latex = normalized(await expressionToLatex(input));
      expect(latex, input).toContain("\\begin{cases}");
    }
  });

  it("expoente Unicode (x²) em qualquer equação do sistema ATIVA o cases", async () => {
    const latex = normalized(await expressionToLatex("x²+y=5\nx-y=1"));
    expect(latex).toContain("\\begin{cases}");
  });

  it("produto entre duas incógnitas (x*y) ATIVA o cases (sistema polinomial não linear)", async () => {
    const product = normalized(await expressionToLatex("x*y=2\nx+y=3"));
    expect(product).toContain("\\begin{cases}");

    const withCoefficient = normalized(await expressionToLatex("2*x+3*y=5\nx-y=1"));
    expect(withCoefficient).toContain("\\begin{cases}");
  });

  it("multiplicação implícita (2x+3y=5) continua reconhecida como sistema válido (regressão)", async () => {
    const latex = normalized(await expressionToLatex("2x+3y=5\nx-y=1"));
    expect(latex).toContain("\\begin{cases}");
  });

  it("função transcendental (sen/cos/log/exp/módulo) em qualquer equação do sistema desativa o cases (continua fora de escopo)", async () => {
    for (const input of ["sen(x)+y=1\nx-y=0", "x+y=5\nlog(y)-x=1", "exp(x)+y=5\nx-y=1"]) {
      const latex = await expressionToLatex(input);
      expect(latex, input).not.toBeNull();
      expect(latex, input).not.toContain("cases");
    }
  });
});

describe("valueToLatex", () => {
  it("converte intervalos com infinito e colchete misto", async () => {
    const latex = normalized(await valueToLatex("(-∞, 2]"));
    expect(latex).toContain("\\infty");
    expect(latex).toContain("\\right]");
  });

  it("converte união de intervalos", async () => {
    const latex = normalized(await valueToLatex("(-∞, -2) ∪ (2, ∞)"));
    expect(latex).toContain("\\cup");
    expect(latex.match(/\\infty/g)?.length).toBe(2);
  });

  it("converte tuplas de coordenadas", async () => {
    expect(normalized(await valueToLatex("(-3/2, -9/4)"))).toContain("\\frac");
  });

  it("converte listas de soluções com subscritos", async () => {
    const latex = normalized(await valueToLatex("x₁ = -2, x₂ = 2"));
    expect(latex).toContain("x_{1}");
    expect(latex).toContain("x_{2}");
  });

  it("converte soluções periódicas com 'ou' e 'k ∈ ℤ'", async () => {
    const latex = normalized(
      await valueToLatex("x = 2π*k + π/6 ou x = 2π*k + 5π/6, k ∈ ℤ")
    );
    expect(latex).toContain("\\text{ou}");
    expect(latex).toContain("k\\in\\mathbb{Z}");
    expect(latex).toContain("\\pi");
  });

  it("converte pares ligados por 'e' (focos)", async () => {
    const latex = normalized(await valueToLatex("(-4, 0) e (4, 0)"));
    expect(latex).toContain("\\text{e}");
  });

  it("mapeia conjuntos numéricos", async () => {
    expect(await valueToLatex("ℝ")).toBe("\\mathbb{R}");
    expect(await valueToLatex("ℤ")).toBe("\\mathbb{Z}");
  });

  // --- Sprint V2.2 (Motor de Matrizes) ---------------------------------

  it("converte um resultado de matriz literal para \\begin{bmatrix}", async () => {
    const latex = normalized(await valueToLatex("[[1, 2], [3, 4]]"));
    expect(latex).toContain("\\begin{bmatrix}");
    expect(latex).toContain("1&2");
    expect(latex).toContain("3&4");
  });

  it("REGRESSÃO: uma matriz de exatamente DUAS linhas não é lida como tupla de dois vetores-linha", async () => {
    // `pairToLatex` (tupla/intervalo) casa "[...]" com exatamente duas
    // partes separadas por vírgula de nível mais alto — sem o guard de
    // "[[" em `valueToLatex`, "[[1, 2], [3, 4]]" colidiria com essa forma
    // (2 partes: "[1, 2]" e "[3, 4]") e viraria "(vetor, vetor)" em vez de
    // uma matriz 2x2 de verdade.
    const latex = normalized(await valueToLatex("[[1, 2], [3, 4]]"));
    expect(latex).not.toContain("\\right)");
    expect(latex).not.toContain(",\\;");
    expect(latex).toContain("\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}");
  });

  it("converte uma matriz resultado de mais de duas linhas (nunca colidiu, mas continua correto)", async () => {
    const latex = normalized(await valueToLatex("[[1, 0, 0], [0, 1, 0], [0, 0, 1]]"));
    expect(latex).toContain("\\begin{bmatrix}");
    expect(latex).toContain("1&0&0");
  });

  it("um intervalo genuíno de colchete simples continua funcionando (sem colisão com o guard de matriz)", async () => {
    const latex = normalized(await valueToLatex("[0, 5]"));
    expect(latex).toContain("\\left[");
    expect(latex).toContain("\\right]");
  });

  // --- Sprint V2.3 (Motor de Números Complexos) — forma polar. O "·" e a
  // justaposição "r(" (sem "*") tornam essa string ilegível para o
  // pipeline genérico do mathjs (confirmado empiricamente) — precisa do
  // reconhecimento estrutural dedicado de `polarFormToLatex`.

  it("converte a forma polar do resultado (√r + cos/sin + i·sin)", async () => {
    const latex = normalized(await valueToLatex("√2(cos(π/4)+i·sin(π/4))"));
    expect(latex).toContain("\\sqrt{2}");
    expect(latex).toContain("\\cos\\left(\\frac{\\pi}{4}\\right)");
    expect(latex).toContain("\\sin\\left(\\frac{\\pi}{4}\\right)");
  });

  it("converte a forma polar com ângulo sem fração de π (fica simbólico)", async () => {
    const latex = normalized(await valueToLatex("5(cos(atan(4/3))+i·sin(atan(4/3)))"));
    expect(latex).toContain("\\cos");
    expect(latex).toContain("\\sin");
  });

  it("forma polar malformada (θ diferente em cos/sin) não é reconhecida (fail-closed)", async () => {
    expect(await valueToLatex("√2(cos(π/4)+i·sin(π/3))")).toBeNull();
  });
});

describe("resultToLatex", () => {
  it("segmenta resultado rotulado preservando rótulos como texto", async () => {
    const segments = await resultToLatex(
      "Tipo: circunferência; Centro: (0, 0); Raio: 5; Equação: x² + y² = 25"
    );
    expect(segments).toHaveLength(4);
    expect(segments![0]).toMatchObject({ label: "Tipo", text: "circunferência", latex: null });
    expect(segments![1].label).toBe("Centro");
    expect(segments![1].latex).not.toBeNull();
    expect(normalized(segments![3].latex)).toContain("{x}^{2}+{y}^{2}=25");
  });

  it("converte resultado puro em segmento único sem rótulo", async () => {
    const segments = await resultToLatex("x₁ = -2, x₂ = 2");
    expect(segments).toHaveLength(1);
    expect(segments![0].label).toBeNull();
    expect(normalized(segments![0].latex)).toContain("x_{1}");
  });

  it("converte resultado rotulado único (Derivada)", async () => {
    const segments = await resultToLatex("Derivada: 1/(x*ln(10))");
    expect(segments).toHaveLength(1);
    expect(segments![0].label).toBe("Derivada");
    expect(normalized(segments![0].latex)).toContain("\\frac{1}");
  });

  it("devolve null quando nada é conversível (fallback total)", async () => {
    expect(await resultToLatex("Relação entre as retas: Perpendiculares ⊥")).toBeNull();
  });

  // --- Sprint V2.6 (Motor de Polinômios Avançados) — nenhuma mudança de
  // código foi necessária para estas três formas: "Expandido: ..."/
  // "Quociente: ...; Resto: ..." já são reconhecidos pelo padrão "Rótulo:
  // valor" existente (mesmo usado por "Derivada: ..."); "x = -3, x = 3" já
  // é a forma de lista de igualdades existente (mesma de uma equação).

  it("converte resultado rotulado de expandir (Expandido)", async () => {
    const segments = await resultToLatex("Expandido: x**3 + 6*x**2 + 12*x + 8");
    expect(segments).toHaveLength(1);
    expect(segments![0].label).toBe("Expandido");
    expect(normalized(segments![0].latex)).toContain("{x}^{3}+6\\cdot{x}^{2}+12\\cdotx+8");
  });

  it("converte resultado de divisão em dois segmentos rotulados (Quociente/Resto)", async () => {
    const segments = await resultToLatex("Quociente: x**2 + x + 1; Resto: 0");
    expect(segments).toHaveLength(2);
    expect(segments![0].label).toBe("Quociente");
    expect(normalized(segments![0].latex)).toContain("{x}^{2}+x+1");
    expect(segments![1]).toMatchObject({ label: "Resto", text: "0" });
  });

  it("converte raízes de polinômio (lista de igualdades, sem rótulo)", async () => {
    const segments = await resultToLatex("x₁ = -3, x₂ = 3");
    expect(segments).toHaveLength(1);
    expect(segments![0].label).toBeNull();
    expect(normalized(segments![0].latex)).toContain("x_{1}=-3");
  });

  // --- Sprint V2.7 (Motor de Combinatória) — o backend devolve a dedução
  // simbólica como CADEIA de igualdades ("C(10,3) = 10!/(3!*7!) = 120",
  // ver `combinatorics/formatter.py`); cada pedaço é mathjs válido e o
  // split por "=" de `expressionToLatex` junta tudo numa linha só.

  it("converte a dedução de combinação em cadeia única (\\binom{10}{3} = fração de fatoriais = 120)", async () => {
    const segments = await resultToLatex("C(10,3) = 10!/(3!*7!) = 120");
    expect(segments).toHaveLength(1);
    expect(segments![0].label).toBeNull();
    const latex = normalized(segments![0].latex);
    expect(latex).toContain("\\binom{10}{3}");
    expect(latex).toContain("\\frac{10!}");
    expect(latex).toContain("=120");
    assertRendersSafely(segments![0].latex!, "dedução de combinação");
  });

  it("cadeia curta 'combinacao(10,3) = 120' também vira \\binom (Sprint V2.7.1)", async () => {
    const segments = await resultToLatex("combinacao(10,3) = 120");
    expect(segments).toHaveLength(1);
    const latex = normalized(segments![0].latex);
    expect(latex).toContain("\\binom{10}{3}");
    expect(latex).toContain("=120");
  });

  it("converte a dedução de arranjo com o passo intermediário (8-3)!", async () => {
    const segments = await resultToLatex("A(8,3) = 8!/(8-3)! = 8!/5! = 336");
    expect(segments).toHaveLength(1);
    const latex = normalized(segments![0].latex);
    expect(latex).toContain("A_{8,3}");
    expect(latex).toContain("=336");
    assertRendersSafely(segments![0].latex!, "dedução de arranjo");
  });

  it("converte a dedução de permutação (P_6 = 6! = 720)", async () => {
    const segments = await resultToLatex("P(6) = 6! = 720");
    expect(segments).toHaveLength(1);
    const latex = normalized(segments![0].latex);
    expect(latex).toContain("P_{6}");
    expect(latex).toContain("6!");
    expect(latex).toContain("=720");
  });

  it("converte a dedução de fatorial (6! = 720) e de permutação com repetição", async () => {
    const factorial = await resultToLatex("6! = 720");
    expect(normalized(factorial![0].latex)).toBe("6!=720");

    const repetition = await resultToLatex("8!/(3!*2!*2!) = 1680");
    expect(repetition).toHaveLength(1);
    const latex = normalized(repetition![0].latex);
    expect(latex).toContain("\\frac{8!}");
    expect(latex).toContain("=1680");
    assertRendersSafely(repetition![0].latex!, "permutação com repetição");
  });

  it("converte a notação Σ compacta como RESULTADO (Sprint V2.1 — somatório que não expande)", async () => {
    // O "=" dentro de "i=1..30" não pode ser confundido com o separador de
    // equação — regressão do bug real encontrado na validação manual desta
    // sprint (resultToLatex caía pro fallback de texto puro).
    const segments = await resultToLatex("Σ(i=1..30) sin(i)");
    expect(segments).toHaveLength(1);
    expect(segments![0].label).toBeNull();
    expect(normalized(segments![0].latex)).toContain("\\sum_{i=1}^{30}");
  });

  it("mantém segmentos textuais no meio de segmentos matemáticos", async () => {
    const segments = await resultToLatex(
      "Tipo: função logarítmica; Domínio: (0, +∞); Monotonicidade: crescente"
    );
    expect(segments).toHaveLength(3);
    expect(segments![1].latex).toContain("\\infty");
    expect(segments![2].latex).toBeNull();
    expect(segments![2].text).toBe("crescente");
  });

  it("converte um resultado de matriz (Sprint V2.2) como segmento único sem rótulo, sem duplicar", async () => {
    const segments = await resultToLatex("[[1, 2], [3, 4]]");
    expect(segments).toHaveLength(1);
    expect(segments![0].label).toBeNull();
    expect(normalized(segments![0].latex)).toContain("\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}");
  });

  it("converte um resultado de aritmética complexa (Sprint V2.3) como segmento único", async () => {
    const segments = await resultToLatex("7 + i");
    expect(segments).toHaveLength(1);
    expect(segments![0].label).toBeNull();
    expect(normalized(segments![0].latex)).toContain("i");
  });

  it("converte um resultado em forma polar (Sprint V2.3) — nunca cai pro texto cru", async () => {
    const segments = await resultToLatex("√2(cos(π/4)+i·sin(π/4))");
    expect(segments).toHaveLength(1);
    expect(segments![0].label).toBeNull();
    expect(segments![0].latex).not.toBeNull();
    expect(normalized(segments![0].latex)).toContain("\\sqrt{2}");
  });

  it("converte um resultado escalar de det(...) normalmente (não é reconhecido como matriz)", async () => {
    const segments = await resultToLatex("-2");
    expect(segments).toHaveLength(1);
    expect(segments![0].latex).not.toBeNull();
    expect(segments![0].latex).not.toContain("bmatrix");
  });

  // --- Sprint V2.4 (Sistemas Lineares) — o RESULTADO de um sistema
  // ("x = 3, y = 2") já era reconhecido de graça pela lista de igualdades
  // existente (`valueToLatex`: `,` separando partes que casam com
  // `EQUATION_SPLIT` cada uma) — nenhuma mudança de código precisou ser
  // feita para o resultado, só para o ECO da entrada digitada (ver
  // `expressionToLatex`/`inputToLatex` acima). Testes aqui são de
  // REGRESSÃO/documentação, não de uma feature nova.

  it("converte o resultado de um sistema linear (solução única) como lista de igualdades", async () => {
    const segments = await resultToLatex("x = 3, y = 2");
    expect(segments).toHaveLength(1);
    expect(segments![0].label).toBeNull();
    expect(normalized(segments![0].latex)).toBe("x=3,y=2");
  });

  it("converte o resultado de um sistema 3x3 com frações", async () => {
    const segments = await resultToLatex("x = 7/3, y = 7/3, z = 4/3");
    expect(segments).toHaveLength(1);
    expect(normalized(segments![0].latex)).toContain("\\frac{7}{3}");
    expect(normalized(segments![0].latex)).toContain("\\frac{4}{3}");
  });

  it("sistema impossível ('Sistema sem solução') cai no fallback de texto puro, sem lançar", async () => {
    expect(await resultToLatex("Sistema sem solução")).toBeNull();
  });

  it("sistema indeterminado (solução paramétrica, ex. 'x = 2 - y, y = y') ainda renderiza em KaTeX", async () => {
    const segments = await resultToLatex("x = 2 - y, y = y");
    expect(segments).toHaveLength(1);
    expect(normalized(segments![0].latex)).toBe("x=2-y,y=y");
  });

  // --- Sprint V2.5 (Motor de Sistemas Polinomiais Não Lineares) — o
  // RESULTADO de múltiplas soluções ("x = a, y = b ou x = c, y = d") já é
  // reconhecido de graça pela combinação de duas formas existentes: " ou "
  // (alternativas, já usada por soluções trigonométricas periódicas) e
  // lista de igualdades (já usada pelo resultado de um sistema linear) —
  // nenhuma mudança de código precisou ser feita aqui, só o eco da
  // ENTRADA (`expressionToLatex`, testes acima) ganhou o \begin{cases}
  // para sistemas não lineares.

  it("converte o resultado de múltiplas soluções de um sistema não linear (' ou ' entre tuplos)", async () => {
    const segments = await resultToLatex("x = -3, y = -4 ou x = 2, y = 1");
    expect(segments).toHaveLength(1);
    expect(normalized(segments![0].latex)).toBe("x=-3,y=-4\\text{ou}x=2,y=1");
  });

  it("converte múltiplas soluções complexas de um sistema não linear (cúbico)", async () => {
    const segments = await resultToLatex(
      "x = -1 - √2*i, y = 4 + √2*i ou x = -1 + √2*i, y = 4 - √2*i ou x = 2, y = 1"
    );
    expect(segments).toHaveLength(1);
    const latex = normalized(segments![0].latex);
    expect(latex).toContain("\\sqrt{2}\\cdoti");
    expect(latex.split("ou").length).toBe(3);
  });

  it("sistema não linear indeterminado ('Sistema com infinitas soluções (indeterminado).') cai no fallback de texto puro, sem lançar", async () => {
    expect(await resultToLatex("Sistema com infinitas soluções (indeterminado).")).toBeNull();
  });

  // --- Sprint V2.8 (Motor de Probabilidade) — a cabeça "P(...)" da cadeia
  // do backend usa caracteres fora do que o mathjs tokeniza como uma
  // única expressão ("Aᶜ", "∪", "∩", "|", e o "=" DENTRO de "P(X=3)") —
  // reconhecimento estrutural dedicado (`probabilityResultHeadToLatex`),
  // não conversão genérica via mathjs. Ver docstring da função.

  it("converte a dedução de probabilidade clássica (P(A) = 3/10 = 0.3)", async () => {
    const segments = await resultToLatex("P(A) = 3/10 = 0.3");
    expect(segments).toHaveLength(1);
    const latex = normalized(segments![0].latex);
    expect(latex).toContain("P(A)=");
    expect(latex).toContain("\\frac{3}{10}");
    expect(latex).toContain("=0.3");
    assertRendersSafely(segments![0].latex!, "dedução de probabilidade clássica");
  });

  it("converte a dedução do complementar, com o sobrescrito 'c' (P(Aᶜ) = 1-0.3 = 0.7)", async () => {
    const segments = await resultToLatex("P(Aᶜ) = 1-0.3 = 0.7");
    expect(segments).toHaveLength(1);
    const latex = normalized(segments![0].latex);
    expect(latex).toContain("P(A^{c})=");
    expect(latex).toContain("=0.7");
    assertRendersSafely(segments![0].latex!, "dedução de complementar");
  });

  it("converte a dedução de união com \\cup (P(A∪B) = 0.4+0.5-0.2 = 0.7)", async () => {
    const segments = await resultToLatex("P(A∪B) = 0.4+0.5-0.2 = 0.7");
    expect(segments).toHaveLength(1);
    const latex = normalized(segments![0].latex);
    expect(latex).toContain("P(A\\cupB)=");
    expect(latex).toContain("=0.7");
    assertRendersSafely(segments![0].latex!, "dedução de união");
  });

  it("converte a dedução de interseção independente com \\cap (P(A∩B) = 0.5*0.3 = 0.15)", async () => {
    const segments = await resultToLatex("P(A∩B) = 0.5*0.3 = 0.15");
    expect(segments).toHaveLength(1);
    const latex = normalized(segments![0].latex);
    expect(latex).toContain("P(A\\capB)=");
    expect(latex).toContain("=0.15");
    assertRendersSafely(segments![0].latex!, "dedução de interseção independente");
  });

  it("converte a dedução condicional com \\mid, nunca '|' bruto (P(A|B) = 0.2/0.5 = 0.4)", async () => {
    const segments = await resultToLatex("P(A|B) = 0.2/0.5 = 0.4");
    expect(segments).toHaveLength(1);
    const latex = normalized(segments![0].latex);
    expect(latex).toContain("P(A\\midB)=");
    expect(latex).not.toContain("|");
    expect(latex).toContain("=0.4");
    assertRendersSafely(segments![0].latex!, "dedução condicional");
  });

  it("converte a dedução binomial completa, incluindo o '=' interno da cabeça P(X=3)", async () => {
    const segments = await resultToLatex(
      "P(X=3) = C(10,3)*0.5³*0.5⁷ = 120*0.125*0.0078125 = 0.1171875"
    );
    expect(segments).toHaveLength(1);
    const latex = normalized(segments![0].latex);
    expect(latex).toContain("P(X=3)=");
    expect(latex).toContain("\\binom{10}{3}");
    expect(latex).toContain("=0.1171875");
    assertRendersSafely(segments![0].latex!, "dedução binomial");
  });

  it("independentes(...) cai no fallback de texto puro (sem notação KaTeX dedicada), sem lançar", async () => {
    expect(
      await resultToLatex("P(A)*P(B) = 0.5*0.2 = 0.1, P(A∩B) = 0.1 -> Eventos independentes")
    ).toBeNull();
  });
});

describe("resultEchoesExpression (hotfix pós-V2.7.1 — Histórico)", () => {
  async function echoes(expression: string, result: string): Promise<boolean> {
    const [expressionLatex, segments] = await Promise.all([
      previewLatex(expression),
      resultToLatex(result),
    ]);
    return resultEchoesExpression(expressionLatex, segments);
  }

  it("detecta a cadeia de dedução que começa pela própria expressão (todas as grafias)", async () => {
    expect(await echoes("arranjo(20,6)", "A(20,6) = 20!/(20-6)! = 20!/14! = 27907200")).toBe(true);
    expect(await echoes("A(20,6)", "A(20,6) = 20!/(20-6)! = 20!/14! = 27907200")).toBe(true);
    expect(await echoes("combinacao(10,3)", "C(10,3) = 10!/(3!*7!) = 120")).toBe(true);
    expect(await echoes("C(10,3)", "C(10,3) = 10!/(3!*7!) = 120")).toBe(true);
    expect(await echoes("permutacao(6)", "P(6) = 6! = 720")).toBe(true);
    expect(await echoes("fatorial(7)", "7! = 5040")).toBe(true);
    expect(await echoes("fat(7)", "7! = 5040")).toBe(true);
  });

  it("detecta resultado idêntico à expressão (nunca compor 'A = A')", async () => {
    expect(await echoes("[[1,2],[3,4]]", "[[1, 2], [3, 4]]")).toBe(true);
    expect(await echoes("x/2", "x/2")).toBe(true);
  });

  it("NUNCA casa com lista de soluções, valor simples, segmento rotulado ou cadeia sem cabeça", async () => {
    expect(await echoes("x² - 4 = 0", "x₁ = -2, x₂ = 2")).toBe(false);
    expect(await echoes("2+2", "4")).toBe(false);
    expect(await echoes("det([[1,2],[3,4]])", "-2")).toBe(false);
    expect(await echoes("Σ(i=1..10) i", "55")).toBe(false);
    expect(await echoes("expandir((x+2)³)", "Expandido: x**3 + 6*x**2 + 12*x + 8")).toBe(false);
    expect(await echoes("divisao(x³-1,x-1)", "Quociente: x**2 + x + 1; Resto: 0")).toBe(false);
    // permutação com repetição: a cadeia NÃO começa pela expressão — a
    // composição "expressão = resultado" continua correta e desejada.
    expect(await echoes("permutacao_repeticao(8,3,2,2)", "8!/(3!*2!*2!) = 1680")).toBe(false);
  });

  it("é null-safe (conversões pendentes/nulas nunca disparam a regra)", () => {
    expect(resultEchoesExpression(null, [{ label: null, text: "x", latex: "x" }])).toBe(false);
    expect(resultEchoesExpression("x", null)).toBe(false);
    expect(resultEchoesExpression("x", [{ label: null, text: "x", latex: null }])).toBe(false);
  });
});

describe("inputToLatex (echo da expressão digitada)", () => {
  it("converte d/dx", async () => {
    const latex = normalized(await inputToLatex("d/dx(x² + 3x)"));
    expect(latex).toContain("\\frac{d}{dx}");
    expect(latex).toContain("^{2}");
  });

  it("converte integral definida Unicode e ASCII", async () => {
    for (const input of ["∫₀¹ x² dx", "∫_0^1 x² dx"]) {
      const latex = normalized(await inputToLatex(input));
      expect(latex, input).toContain("\\int_{0}^{1}");
      expect(latex, input).toContain("dx");
    }
  });

  it("converte integral indefinida", async () => {
    const latex = normalized(await inputToLatex("∫x² dx"));
    expect(latex).toContain("\\int");
    expect(latex).toContain("^{2}");
  });

  it("converte limite em notação natural", async () => {
    const latex = normalized(await inputToLatex("lim x→0 sen(x)/x"));
    expect(latex).toContain("\\lim_{x\\to0}");
    expect(latex).toContain("\\operatorname{sen}");
  });

  it("aceita a seta ASCII '->' em limites, como o backend", async () => {
    const latex = normalized(await inputToLatex("lim x->0 sin(x)/x"));
    expect(latex).toContain("\\lim_{x\\to0}");
    expect(latex).toContain("\\sin");
  });

  it("converte a sintaxe técnica de cálculo", async () => {
    expect(normalized(await inputToLatex("derivada(x**2, x)"))).toContain("\\frac{d}{dx}");
    expect(normalized(await inputToLatex("integral(x**2, x, 0, 1)"))).toContain("\\int_{0}^{1}");
    expect(normalized(await inputToLatex("limite(sen(x)/x, x, 0)"))).toContain("\\lim_{x\\to0}");
  });

  it("falha fechado para sintaxe de geometria (tuplas)", async () => {
    expect(await inputToLatex("circunferencia((0,0),5)")).toBeNull();
    expect(await inputToLatex("distancia((0,0),(3,4))")).toBeNull();
  });

  // --- Sprint V2.1: sintaxe principal do somatório Σ(var=inf..sup) expr ---

  it("converte a sintaxe principal do somatório", async () => {
    const latex = normalized(await inputToLatex("Σ(i=1..10) i"));
    expect(latex).toContain("\\sum_{i=1}^{10}");
  });

  it("converte o corpo do somatório com fidelidade real (fração, não texto com '/')", async () => {
    const latex = normalized(await inputToLatex("Σ(i=1..5) ((i²+1)/(2*i))"));
    expect(latex).toContain("\\sum_{i=1}^{5}");
    expect(latex).toContain("\\frac");
    expect(latex).toContain("{i}^{2}+1");
  });

  it("preserva um corpo com mais de uma função (parênteses próprios)", async () => {
    const latex = normalized(await inputToLatex("Σ(i=1..5) sin(i)^2 + cos(i)^2"));
    expect(latex).toContain("\\sum_{i=1}^{5}");
    expect(latex).toContain("\\sin");
    expect(latex).toContain("\\cos");
  });

  it("aceita limite inferior negativo", async () => {
    const latex = normalized(await inputToLatex("Σ(i=-3..3) (2*i+1)"));
    expect(latex).toContain("\\sum_{i=-3}^{3}");
  });

  it("cabeçalho incompleto (ainda digitando) devolve null — Tier 2 assume o preview", async () => {
    expect(await inputToLatex("Σ(i=1..")).toBeNull();
    expect(await inputToLatex("Σ(i=1..10)")).toBeNull();
  });

  // --- Sprint V2.2 (Motor de Matrizes) ---------------------------------

  it("converte o echo de um literal de matriz digitado", async () => {
    const latex = normalized(await inputToLatex("[[1,2],[3,4]]"));
    expect(latex).toContain("\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}");
  });

  it("converte o echo de uma expressão de matriz com escalar à esquerda", async () => {
    const latex = normalized(await inputToLatex("2 * [[1,2],[3,4]]"));
    expect(latex).toContain("\\begin{bmatrix}");
  });

  // --- Sprint V2.2.1 (Variáveis Locais para Matrizes) ---------------------

  it("converte o echo de um programa de matriz com atribuições, preservando a expressão digitada", async () => {
    const latex = normalized(
      await inputToLatex("A=[[1,2],[3,4]]\nB=[[5,6],[7,8]]\nA*B")
    );
    expect(latex).toContain("\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}");
    expect(latex).toContain("\\begin{bmatrix}5&6\\\\7&8\\end{bmatrix}");
  });
});

/**
 * Tier 2 — pipeline tolerante da pré-visualização (Sprint KaTeX Fase 6).
 * Ao contrário de `expressionToLatex`/`inputToLatex` (Tier 1, fail-closed:
 * `null` para qualquer coisa não 100% reconhecida), `safeExpressionLatex`
 * NUNCA devolve null para entrada não vazia e o resultado é sempre
 * verificado contra o KaTeX real com `throwOnError:true` — mais rígido do
 * que a produção (`throwOnError:false`), então qualquer caso que passasse
 * aqui só por "não lançar por acidente" já teria sido pego.
 */
describe("safeExpressionLatex (Tier 2 — nunca falha)", () => {
  it("símbolo isolado", () => {
    const latex = safeExpressionLatex("π");
    expect(latex).toBe("\\pi");
    assertRendersSafely(latex, "π");
  });

  it("vários símbolos consecutivos sem estrutura matemática — todos viram comando LaTeX", () => {
    const latex = safeExpressionLatex("π ≠ ∫ e ∞ → ≤ ≥");
    const normalized = latex.replace(/\s+/g, " ").trim();
    expect(normalized).toContain("\\pi");
    expect(normalized).toContain("\\neq");
    expect(normalized).toContain("\\int");
    expect(normalized).toContain("\\infty");
    expect(normalized).toContain("\\to");
    expect(normalized).toContain("\\le");
    expect(normalized).toContain("\\ge");
    // ordem preservada, "e" solto continua literal (não é comando).
    expect(normalized.indexOf("\\pi")).toBeLessThan(normalized.indexOf("\\neq"));
    expect(normalized.indexOf("\\neq")).toBeLessThan(normalized.indexOf("\\int"));
    expect(normalized).toMatch(/\be\b/);
    assertRendersSafely(latex, "π ≠ ∫ e ∞ → ≤ ≥");
  });

  it("potência", () => {
    const latex = safeExpressionLatex("x^2");
    expect(latex.replace(/\s+/g, "")).toContain("^{2}");
    assertRendersSafely(latex, "x^2");
  });

  it("raiz — com parênteses e em forma solta", () => {
    expect(safeExpressionLatex("sqrt(x)")).toBe("\\sqrt{x}");
    expect(safeExpressionLatex("√(x)")).toBe("\\sqrt{x}");
    expect(safeExpressionLatex("√x")).toBe("\\sqrt{x}");
    for (const input of ["sqrt(x)", "√(x)", "√x"]) assertRendersSafely(safeExpressionLatex(input), input);
  });

  it("log e ln aninhados", () => {
    const latex = safeExpressionLatex("log(ln(x))");
    expect(latex).toBe("\\log\\left(\\ln\\left(x\\right)\\right)");
    assertRendersSafely(latex, "log(ln(x))");
  });

  it("derivada", () => {
    const latex = safeExpressionLatex("derivative(x^2, x)");
    expect(latex).toContain("\\frac{d}{dx}");
    assertRendersSafely(latex, "derivative(x^2, x)");
  });

  it("integral", () => {
    const latex = safeExpressionLatex("integral(x^2, x)");
    expect(latex).toContain("\\int");
    expect(latex).toContain("\\,dx");
    assertRendersSafely(latex, "integral(x^2, x)");
  });

  it("limite", () => {
    const latex = safeExpressionLatex("limit(sin(x)/x, x, 0)");
    expect(latex).toContain("\\lim_{x \\to 0}");
    expect(latex).toContain("\\sin");
    assertRendersSafely(latex, "limit(sin(x)/x, x, 0)");
  });

  it("derivada contendo limite (aninhamento de cálculo)", () => {
    const latex = safeExpressionLatex("derivative(limit(sin(x)/x, x, 0), x)");
    expect(latex).toContain("\\frac{d}{dx}");
    expect(latex).toContain("\\lim_{x \\to 0}");
    assertRendersSafely(latex, "derivative(limit(sin(x)/x, x, 0), x)");
  });

  it("integral contendo função", () => {
    const latex = safeExpressionLatex("integral(log(x), x)");
    expect(latex).toContain("\\int");
    expect(latex).toContain("\\log\\left(x\\right)");
    assertRendersSafely(latex, "integral(log(x), x)");
  });

  it("funções aninhadas (múltiplos níveis)", () => {
    const latex = safeExpressionLatex("f(log(ln(log(e^x))))");
    expect(latex).toContain("f\\left(");
    expect(latex).toContain("\\log\\left(\\ln\\left(\\log\\left(");
    assertRendersSafely(latex, "f(log(ln(log(e^x))))");
  });

  it("parênteses aninhados", () => {
    const latex = safeExpressionLatex("((()))");
    assertRendersSafely(latex, "((()))");
    expect(latex).toContain("\\left(");
  });

  it("expressão incompleta — nunca lança, nunca fica vazia, nunca usa \\left/\\right desbalanceado", () => {
    for (const input of ["log(", "ln()", "integral(", "x^", "sqrt(", "√(", "∛(", "d/dx(", "lim x→"]) {
      const latex = safeExpressionLatex(input);
      expect(latex.length, input).toBeGreaterThan(0);
      assertRendersSafely(latex, input);
    }
  });

  it("múltiplos símbolos/carets soltos não crasham nem geram 'double superscript'", () => {
    for (const input of ["^^^", "√√√", "≤≥≠→∞π∫Σ×÷−∪∈", ")))", "((("]) {
      assertRendersSafely(safeExpressionLatex(input), input);
    }
  });

  it("expressões geométricas — chamada desconhecida vira \\operatorname seguro", () => {
    const latex = safeExpressionLatex("circunferencia((0,0),5)");
    expect(latex).toContain("\\operatorname{circunferencia}");
    assertRendersSafely(latex, "circunferencia((0,0),5)");
  });

  it("nunca devolve string vazia para entrada não vazia", () => {
    for (const input of ["x", "1", "(", ")", "_", "%", "&", "#"]) {
      expect(safeExpressionLatex(input).length, input).toBeGreaterThan(0);
    }
  });

  it("somatório completo (rede de segurança, mesmo resultado do Tier 1)", () => {
    const latex = safeExpressionLatex("Σ(i=1..10) i");
    expect(latex).toContain("\\sum_{i=1}^{10}");
    assertRendersSafely(latex, "Σ(i=1..10) i");
  });

  it("somatório com cabeçalho incompleto (ainda digitando) nunca lança", () => {
    for (const input of ["Σ(i=1..", "Σ(i=1..10", "Σ("]) {
      assertRendersSafely(safeExpressionLatex(input), input);
    }
  });
});

describe("previewLatex (pipeline único da pré-visualização e do histórico)", () => {
  it("usa o Tier 1 quando a expressão é totalmente reconhecida (fração real, não texto com '/')", async () => {
    const latex = await previewLatex("(x+1)/(x-1)");
    expect(latex).not.toBeNull();
    expect(latex).toContain("\\frac");
  });

  it("cai pro Tier 2 quando o Tier 1 falha, sem nunca devolver null para símbolos/estruturas", async () => {
    const cases = [
      "π ≠ ∫ e ∞ → ≤ ≥",
      "d/dx((lim x→0 ∞) dx)",
      "derivative(limit(sin(x)/x, x, 0), x)",
      "circunferencia((0,0),5)",
      "log(",
      "x^",
    ];
    for (const input of cases) {
      const latex = await previewLatex(input);
      expect(latex, input).not.toBeNull();
      assertRendersSafely(latex as string, input);
    }
  });

  it("preserva a exceção de palavra pura sem matemática (rótulo continua texto)", async () => {
    expect(await previewLatex("crescente")).toBeNull();
    expect(await previewLatex("")).toBeNull();
    expect(await previewLatex("   ")).toBeNull();
  });

  it("continua reconhecendo a sintaxe técnica de cálculo do produto (derivada/integral/limite)", async () => {
    expect(normalized(await previewLatex("derivada(x**2, x)"))).toContain("\\frac{d}{dx}");
    expect(normalized(await previewLatex("integral(x**2, x, 0, 1)"))).toContain("\\int_{0}^{1}");
    expect(normalized(await previewLatex("limite(sen(x)/x, x, 0)"))).toContain("\\operatorname{sen}");
  });

  it("reconhece a sintaxe principal do somatório, completa ou ainda em digitação", async () => {
    expect(normalized(await previewLatex("Σ(i=1..10) i"))).toContain("\\sum_{i=1}^{10}");

    for (const input of ["Σ(i=1..", "Σ(i=1..10)", "Σ("]) {
      const latex = await previewLatex(input);
      expect(latex, input).not.toBeNull();
      assertRendersSafely(latex as string, input);
    }
  });

  // --- Sprint V2.2 (Motor de Matrizes) ---------------------------------

  it("mostra a matriz renderizada assim que o literal fica completo", async () => {
    const latex = await previewLatex("[[1,2],[3,4]]");
    expect(latex).not.toBeNull();
    expect(latex).toContain("\\begin{bmatrix}");
    assertRendersSafely(latex as string, "[[1,2],[3,4]]");
  });

  it("digitação incompleta de matriz nunca lança e sempre renderiza em segurança (Tier 2)", async () => {
    for (const input of ["[[1,2],[3,", "[[1,2],", "[["]) {
      const latex = await previewLatex(input);
      expect(latex, input).not.toBeNull();
      assertRendersSafely(latex as string, input);
    }
  });

  // --- Sprint V2.2.1 (Variáveis Locais para Matrizes) ---------------------

  it("mostra o programa de matriz completo (atribuições + expressão final) assim que fica válido", async () => {
    const latex = await previewLatex("A=[[1,2],[3,4]]\nB=[[5,6],[7,8]]\nA*B");
    expect(latex).not.toBeNull();
    expect(latex).toContain("\\begin{bmatrix}");
    assertRendersSafely(latex as string, "A=[[1,2],[3,4]]\nB=[[5,6],[7,8]]\nA*B");
  });

  it("digitação incompleta de um programa de matriz (ainda no meio de uma atribuição) nunca lança", async () => {
    for (const input of ["A=[[1,2],[3,4]]\nB=", "A=[[1,2],[3,4]]\nB=[[5,", "A=[[1,2],[3,4]]\n"]) {
      const latex = await previewLatex(input);
      expect(latex, input).not.toBeNull();
      assertRendersSafely(latex as string, input);
    }
  });

  // --- Sprint V2.3 (Motor de Números Complexos) ---------------------------

  it("mostra a unidade imaginária e aritmética retangular assim que digitadas", async () => {
    for (const input of ["i", "3-4i", "(2+i)*(3-i)"]) {
      const latex = await previewLatex(input);
      expect(latex, input).not.toBeNull();
      assertRendersSafely(latex as string, input);
    }
  });

  it("mostra conjugado/modulo/argumento renderizados assim que a chamada fica completa", async () => {
    expect(normalized(await previewLatex("conjugado(3+4i)"))).toContain("\\overline{3+4i}");
    expect(normalized(await previewLatex("modulo(3+4i)"))).toContain("\\left|3+4i\\right|");
    expect(normalized(await previewLatex("argumento(1+i)"))).toContain("\\arg\\left(1+i\\right)");
  });

  it("digitação incompleta de conjugado/modulo/argumento/polar nunca lança e sempre renderiza em segurança (Tier 2)", async () => {
    for (const input of ["conjugado(", "modulo(", "argumento(", "polar(", "polar(1+i"]) {
      const latex = await previewLatex(input);
      expect(latex, input).not.toBeNull();
      assertRendersSafely(latex as string, input);
    }
  });

  // --- Sprint V2.4 (Sistemas Lineares) ---------------------------------

  it("mostra o sistema linear renderizado em \\begin{cases}...\\end{cases} assim que a 2ª equação fica completa", async () => {
    const latex = await previewLatex("x+y=5\nx-y=1");
    expect(latex).not.toBeNull();
    expect(latex).toContain("\\begin{cases}");
    assertRendersSafely(latex as string, "x+y=5\nx-y=1");
  });

  it("';' produz o mesmo resultado de preview que '\\n'", async () => {
    const withSemicolon = await previewLatex("x+y=5; x-y=1");
    const withNewline = await previewLatex("x+y=5\nx-y=1");
    expect(withSemicolon).toBe(withNewline);
  });

  it("digitação incompleta de um sistema (2ª equação ainda não fechada) nunca lança e sempre renderiza em segurança (Tier 2)", async () => {
    for (const input of ["x+y=5\n", "x+y=5\nx-", "x+y=5\nx-y="]) {
      const latex = await previewLatex(input);
      expect(latex, input).not.toBeNull();
      assertRendersSafely(latex as string, input);
    }
  });

  // --- Sprint V2.5 (Motor de Sistemas Polinomiais Não Lineares) ----------

  it("mostra um sistema não linear (parábola + reta) renderizado em \\begin{cases}...\\end{cases}", async () => {
    const latex = await previewLatex("x**2+y=5\nx-y=1");
    expect(latex).not.toBeNull();
    expect(latex).toContain("\\begin{cases}");
    assertRendersSafely(latex as string, "x**2+y=5\nx-y=1");
  });

  it("mostra um sistema não linear com produto entre incógnitas (x*y) renderizado em cases", async () => {
    const latex = await previewLatex("x*y=6\nx+y=5");
    expect(latex).not.toBeNull();
    expect(latex).toContain("\\begin{cases}");
  });

  it("função transcendental (sen/log/exp) num sistema continua fora de escopo, mas nunca lança (Tier 2)", async () => {
    for (const input of ["sen(x)+y=1\nx-y=0", "x+y=5\nlog(y)-x=1"]) {
      const latex = await previewLatex(input);
      expect(latex, input).not.toBeNull();
      assertRendersSafely(latex as string, input);
    }
  });

  // --- Sprint V2.7 (Motor de Combinatória) -------------------------------

  it("mostra a notação de livro didático assim que a chamada de combinatória fica completa", async () => {
    expect(normalized(await previewLatex("combinacao(10,3)"))).toBe("\\binom{10}{3}");
    expect(normalized(await previewLatex("arranjo(8,3)"))).toBe("A_{8,3}");
    expect(normalized(await previewLatex("permutacao(5)"))).toBe("P_{5}");
    expect(normalized(await previewLatex("fatorial(6)"))).toBe("6!");
    expect(normalized(await previewLatex("permutacao_repeticao(8,3,2,2)"))).toBe("P_{8}^{3,2,2}");
  });

  it("as grafias ACENTUADAS (fora do Tier 1) ganham a mesma notação pelo Tier 2", async () => {
    expect(normalized(await previewLatex("combinação(10,3)"))).toContain("\\binom{10}{3}");
    expect(normalized(await previewLatex("permutação(5)"))).toContain("P_{5}");
    expect(normalized(await previewLatex("permutação_repetição(8,3,2,2)"))).toContain(
      "P_{8}^{3,2,2}"
    );
  });

  // --- Hotfix V2.7.1a — o PREVIEW (previewLatex, único ponto de entrada de
  // useInputLatex/useSolveLatex) produz \binom para TODAS as grafias de
  // combinação, e as demais operações ficam intocadas — espelho exato dos
  // casos do ticket. A divergência observada no navegador era artefato de
  // sessão dev (inputCache de módulo + HMR degradado por `next build`
  // concorrente), não um caminho de código: nenhum produtor de C_{n,k}
  // resta no fonte (grep) e estes testes provam o pipeline real.

  it("preview e resultado usam a MESMA notação \\binom para toda grafia de combinação (V2.7.1a)", async () => {
    expect(normalized(await previewLatex("combinacao(10,3)"))).toBe("\\binom{10}{3}");
    expect(normalized(await previewLatex("C(20,10)"))).toBe("\\binom{20}{10}");
    expect(normalized(await previewLatex("combinação(5,2)"))).toContain("\\binom{5}{2}");

    const solved = await resultToLatex("C(20,10) = 20!/(10!*10!) = 184756");
    expect(normalized(solved![0].latex)).toContain("\\binom{20}{10}");
  });

  it("A(8,3)/P(6)/fat(6) continuam com a notação da V2.7 no preview (V2.7.1a)", async () => {
    expect(normalized(await previewLatex("A(8,3)"))).toBe("A_{8,3}");
    expect(normalized(await previewLatex("P(6)"))).toBe("P_{6}");
    expect(normalized(await previewLatex("fat(6)"))).toBe("6!");
  });

  it("digitação incompleta de combinatória nunca lança e sempre renderiza em segurança (Tier 2)", async () => {
    for (const input of ["combinacao(", "combinacao(10,", "arranjo(8", "fatorial(", "permutacao_repeticao(8,3,"]) {
      const latex = await previewLatex(input);
      expect(latex, input).not.toBeNull();
      assertRendersSafely(latex as string, input);
    }
  });

  // --- Sprint V2.8 / V2.8.1 (Motor de Probabilidade) ----------------------

  it("mostra probabilidade/condicional/binomial já instanciados (com os argumentos reais) assim que a chamada fica completa", async () => {
    expect(normalized(await previewLatex("probabilidade(3,10)"))).toBe("P(A)=\\frac{3}{10}");
    expect(normalized(await previewLatex("condicional(0.2,0.5)"))).toBe(
      "P(A\\midB)=\\frac{0.2}{0.5}"
    );
    expect(normalized(await previewLatex("binomial(10,3,0.5)"))).toBe(
      "P(X=3)=\\binom{10}{3}(0.5)^{3}(1-0.5)^{7}"
    );
  });

  it("mantém complementar/uniao/intersecao_independente na notação abstrata na pré-visualização (fora do escopo da V2.8.1)", async () => {
    expect(normalized(await previewLatex("complementar(0.3)"))).toBe("P(A^{c})");
    expect(normalized(await previewLatex("uniao(0.4,0.5,0.2)"))).toBe("P(A\\cupB)");
    expect(normalized(await previewLatex("intersecao_independente(0.5,0.3)"))).toBe(
      "P(A\\capB)"
    );
  });

  it("digitação incompleta de probabilidade nunca lança e sempre renderiza em segurança (Tier 2)", async () => {
    for (const input of [
      "probabilidade(",
      "probabilidade(3,",
      "complementar(",
      "uniao(0.4,",
      "intersecao_independente(0.5,",
      "condicional(0.2,",
      "independentes(0.5,0.2,",
      "binomial(10,3,",
    ]) {
      const latex = await previewLatex(input);
      expect(latex, input).not.toBeNull();
      assertRendersSafely(latex as string, input);
    }
  });
});
