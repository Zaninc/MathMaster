/**
 * Sprint V3.0 (Structured Math Input) — a ÚNICA ponte entre o LaTeX que o
 * `StructuredMathInput` (MathLive) produz e a sintaxe Unicode que o
 * MathMaster já aceita nativamente (a mesma que o `<textarea>` antigo
 * sempre enviou — ver `lib/math/backend-normalize.ts`). Este módulo faz
 * SÓ a parte que não existia (LaTeX → sintaxe do produto); a tradução dos
 * 2 templates visuais do teclado (`eˣ(`/`ⁿ`) continua inteiramente em
 * `normalizeForBackend`, chamado DEPOIS deste adapter — nunca duplicado
 * aqui.
 *
 * Catálogo fechado (números, variáveis, `+ - × ÷ =`, parênteses, potência,
 * fração, raiz quadrada/cúbica/n-ésima, π — Sprint V3.0; derivada, integral
 * indefinida/definida, limite, somatório, ∞ e sin/cos/tan mínimo — Sprint
 * V3.0.1). Fail-closed: qualquer comando LaTeX fora deste catálogo devolve
 * `{ok:false}` em vez de adivinhar — o chamador mostra uma mensagem
 * amigável, nunca envia sintaxe potencialmente quebrada ao backend.
 * Matrizes, sistemas, combinatória e probabilidade ficam para V3.0.x
 * seguintes (fora do catálogo por construção, não por uma lista de
 * exclusão).
 *
 * Sprint V3.0.1 (Structured Calculus Input) — as 5 operações de cálculo
 * emitem a sintaxe TÉCNICA CANÔNICA do backend diretamente (`derivada(expr,
 * var)`, `integral(expr, var[, inf, sup])`, `limite(expr, var, ponto)`,
 * `Σ(var=inf..sup) expr`) em vez da "notação natural" (`d/dx(...)`,
 * `∫...dx`, `lim x→p ...`) que `calculus/natural_notation.py` também
 * aceita — confirmado por `test_calculus_natural_notation.py` que a forma
 * canônica passa PELA MESMA função sem qualquer reescrita (idempotente),
 * então não há vantagem em emitir a forma natural e uma desvantagem real:
 * a forma natural exige que a estrutura ocupe a expressão INTEIRA e usa
 * regex mais frágil (limites com subscrito Unicode só aceitam inteiro,
 * por exemplo) — a canônica não tem essas restrições.
 *
 * Sprint V3.0.2 (Structured Algebra Input) — sistemas lineares
 * (`\begin{cases}...\end{cases}` → `"eq1;eq2"`, mesmo separador `;` que
 * `equations/dispatcher.py:_SPLIT_PATTERN` já aceita), matrizes
 * (`\begin{bmatrix|pmatrix|matrix}...\end{...}` → `"[[c,c],[c,c]]"`,
 * sintaxe literal exata de `matrix/parsing.py`), determinante
 * (`\begin{vmatrix}...\end{vmatrix}` → `"det([[c,c],[c,c]])"` — a
 * representação visual de barras do ticket, não uma segunda função),
 * `\det(...)` (a notação que `previewLatex` já produz para `det(...)`
 * digitado/histórico — mesma função, reconhecida só para os exemplos
 * rápidos carregarem e resolverem sem edição manual) e
 * `\operatorname{inv|transpose}(...)`. Cada CÉLULA/linha passa pelo MESMO
 * `parseSubExpression` (portanto pelo parser recursivo inteiro — potência,
 * fração, raiz, π — de graça) — nunca um parser de matriz/sistema
 * separado.
 */

export type MathfieldConversion =
  | { ok: true; expression: string }
  | {
      ok: false;
      /**
       * "incomplete": ainda há um `\placeholder{}` vazio (slot de
       * template — fração/raiz/potência — não preenchido).
       * "unsupported": comando LaTeX fora do catálogo desta sprint.
       */
      reason: "incomplete" | "unsupported";
    };

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};

class Unsupported extends Error {}
class Incomplete extends Error {}

class LatexParser {
  private readonly src: string;
  private pos = 0;

  constructor(src: string) {
    this.src = src;
  }

  private skipSpace(): void {
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos];
      if (ch === " " || ch === "~") {
        this.pos++;
        continue;
      }
      if (this.src.startsWith("\\,", this.pos) || this.src.startsWith("\\;", this.pos) || this.src.startsWith("\\!", this.pos)) {
        this.pos += 2;
        continue;
      }
      if (this.src.startsWith("\\left", this.pos)) {
        this.pos += 5;
        continue;
      }
      if (this.src.startsWith("\\right", this.pos)) {
        this.pos += 6;
        continue;
      }
      break;
    }
  }

  private peek(): string {
    this.skipSpace();
    return this.src[this.pos] ?? "";
  }

  private consume(str: string): boolean {
    this.skipSpace();
    if (this.src.startsWith(str, this.pos)) {
      this.pos += str.length;
      return true;
    }
    return false;
  }

  private expect(str: string): void {
    if (!this.consume(str)) throw new Unsupported(`esperava "${str}"`);
  }

  /** Lê o conteúdo de um grupo `{...}` já sabendo que o `{` está no cursor. */
  private readGroup(): string {
    this.expect("{");
    const inner = this.parseExpression();
    this.expect("}");
    return inner;
  }

  /** Envolve em parênteses só quando o texto não é já um único átomo. */
  private wrap(text: string): string {
    if (/^[0-9.]+$/.test(text)) return text;
    if (/^[a-zA-Zπ]$/.test(text)) return text;
    if (text.startsWith("(") && text.endsWith(")") && this.isBalanced(text)) return text;
    return `(${text})`;
  }

  private isBalanced(text: string): boolean {
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "(") depth++;
      else if (text[i] === ")") {
        depth--;
        if (depth === 0 && i !== text.length - 1) return false;
      }
    }
    return depth === 0;
  }

  /**
   * Sprint V3.0.1 — lê o PRÓXIMO átomo, mas sem re-envolver em parênteses
   * quando ele já vem entre `(...)`/`\left(...\right)` — usado pelo
   * argumento de derivada (`\frac{d}{dx}(expr)`, onde `(expr)` sempre
   * segue a fração) e por funções mínimas (`\sin`/`\cos`/`\tan`).
   * `parseAtom()` sozinho devolveria `(expr)` com parênteses de novo (a
   * marca de que "isto já era uma expressão agrupada"); aqui devolvemos só
   * o conteúdo, para `derivada(expr, x)`/`sin(expr)` não ficarem com
   * parênteses duplicados.
   */
  private parseParenthesizedOrAtom(): string {
    this.skipSpace();
    if (this.consume("(")) {
      const inner = this.parseExpression();
      this.expect(")");
      return inner;
    }
    return this.parseAtom();
  }

  /**
   * Sprint V3.0.1 — captura o restante do escopo ATUAL como texto CRU (sem
   * converter ainda), parando no fim da string ou num fechamento `)`/`}`
   * que pertence a um grupo MAIS EXTERNO (nunca aberto por este método) —
   * usado pelo corpo de limite/integral/somatório, que não têm delimitador
   * próprio (diferente da fração/raiz, que sempre fecham com `}`/`]`
   * conhecido). Move o cursor para o ponto de parada.
   */
  private captureRestOfScope(): string {
    let depth = 0;
    let end = this.src.length;
    for (let i = this.pos; i < this.src.length; i++) {
      const ch = this.src[i];
      if (ch === "(" || ch === "{") depth++;
      else if (ch === ")" || ch === "}") {
        if (depth === 0) {
          end = i;
          break;
        }
        depth--;
      }
    }
    const raw = this.src.slice(this.pos, end);
    this.pos = end;
    return raw;
  }

  /** Converte um fragmento de LaTeX capturado à parte (ex. corpo de integral/limite) como uma sub-expressão isolada e completa. */
  private parseSubExpression(raw: string): string {
    return new LatexParser(raw.trim()).parseEquation();
  }

  /**
   * Sprint V3.0.1 — encontra a ÚLTIMA ocorrência de um diferencial
   * (`d` seguido de exatamente uma letra, ex. "dx"/"dy", nunca "dog") no
   * texto cru do corpo de uma integral — a última porque o diferencial é
   * sempre o marcador final (`\int expr\,dx`), e "última" (não "primeira")
   * evita falso-positivo se o integrando tiver coincidentemente um "d"
   * solto antes do de verdade.
   */
  private findTrailingDifferential(text: string): { index: number; variable: string } | null {
    let last: { index: number; variable: string } | null = null;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "d" && /[a-zA-Z]/.test(text[i + 1] ?? "") && !/[a-zA-Z]/.test(text[i + 2] ?? "")) {
        last = { index: i, variable: text[i + 1] };
      }
    }
    return last;
  }

  /**
   * Sprint V3.0.2 — lê o corpo CRU (sem converter ainda) de um ambiente
   * `\begin{name}...\end{name}` já sabendo que `\begin{name}` acabou de
   * ser consumido pelo cursor. Não faz bracket-counting de `\begin`/`\end`
   * aninhados (matriz/sistema dentro de célula de matriz não é um caso
   * suportado nesta sprint) — procura a PRIMEIRA ocorrência do fechamento
   * correspondente, mesma disciplina fail-closed de sempre: se não achar,
   * vira `Unsupported`, nunca adivinha.
   */
  private readEnvironmentBody(name: string): string {
    const endToken = `\\end{${name}}`;
    const endIdx = this.src.indexOf(endToken, this.pos);
    if (endIdx === -1) throw new Unsupported(`ambiente ${name} sem fechamento`);
    const body = this.src.slice(this.pos, endIdx);
    this.pos = endIdx + endToken.length;
    return body;
  }

  /** Linhas cruas de um ambiente, separadas por `\\` (comando de quebra de linha do LaTeX). */
  private readRawRows(name: string): string[] {
    return this.readEnvironmentBody(name).split("\\\\");
  }

  /**
   * Sprint V3.0.2 — monta a sintaxe literal de matriz do backend
   * (`matrix/parsing.py`: `[[c,c],[c,c]]`) a partir das linhas cruas de um
   * ambiente `bmatrix`/`pmatrix`/`matrix`/`vmatrix` — cada CÉLULA passa
   * por `parseSubExpression` (o parser recursivo inteiro: potência,
   * fração, raiz, π, variável...), nunca um parser de célula à parte.
   * `\placeholder{}` vazio numa célula propaga `Incomplete` normalmente
   * (sem tratamento especial aqui) — mesmo mecanismo de sempre.
   */
  private buildMatrixLiteral(rawRows: string[]): string {
    const rows = rawRows.map((row) => row.split("&").map((cell) => this.parseSubExpression(cell)));
    const columnCount = rows[0]?.length ?? 0;
    if (rows.length === 0 || columnCount === 0 || rows.some((row) => row.length !== columnCount)) {
      throw new Unsupported("matriz malformada (linhas/colunas inconsistentes)");
    }
    return `[${rows.map((cells) => `[${cells.join(",")}]`).join(",")}]`;
  }

  parseEquation(): string {
    const lhs = this.parseExpression();
    this.skipSpace();
    if (this.consume("=")) {
      const rhs = this.parseExpression();
      this.skipSpace();
      if (this.pos < this.src.length) throw new Unsupported("sobrou conteúdo após a equação");
      return `${lhs}=${rhs}`;
    }
    this.skipSpace();
    if (this.pos < this.src.length) throw new Unsupported("sobrou conteúdo após a expressão");
    return lhs;
  }

  private parseExpression(): string {
    let result = "";
    this.skipSpace();
    if (this.consume("-")) result += "-";
    else if (this.consume("+")) result += "";
    result += this.parseTerm();
    for (;;) {
      this.skipSpace();
      if (this.consume("+")) {
        result += "+" + this.parseTerm();
      } else if (this.consume("-")) {
        result += "-" + this.parseTerm();
      } else {
        break;
      }
    }
    return result;
  }

  private parseTerm(): string {
    let result = this.parseFactor();
    for (;;) {
      this.skipSpace();
      if (this.consume("\\times") || this.consume("\\cdot") || this.consume("*")) {
        result += `*${this.parseFactor()}`;
        continue;
      }
      if (this.consume("\\div") || this.consume("/")) {
        result += `/${this.wrap(this.parseFactor())}`;
        continue;
      }
      // Multiplicação implícita: outro fator começa direto (número,
      // variável, `(`, `{...}` — mathjs envolve variáveis/bases em chaves
      // transparentes, ex. "6~{x}^{2}" para "6x²" — `\frac`, `\sqrt`,
      // `\pi`, uma função mínima `\sin`/`\cos`/`\tan` — Sprint V3.0.1,
      // necessário pra "x² sin(x)" — ou um ambiente de matriz — Sprint
      // V3.0.2, necessário pra "2A") sem operador entre eles.
      //
      // Matriz é uma EXCEÇÃO: diferente do parser geral (que aceita
      // `2x` sem "*" via `implicit_multiplication_application`),
      // `matrix/parsing.py:_parse_term` do backend só reconhece "*"
      // EXPLÍCITO — confirmado contra o backend real: "2[[1,2],[3,4]]"
      // (sem "*") é REJEITADO, "2*[[1,2],[3,4]]" funciona. Por isso
      // matriz sempre entra com "*" explícito aqui, mesmo quando o
      // usuário digitou/inseriu sem operador — as outras formas
      // continuam concatenando sem operador, como sempre.
      const next = this.peek();
      const matrixEnvironment = ["\\begin{bmatrix}", "\\begin{pmatrix}", "\\begin{matrix}", "\\begin{vmatrix}"].find(
        (token) => this.src.startsWith(token, this.pos)
      );
      const startsFactor =
        matrixEnvironment !== undefined ||
        /[0-9a-zA-Z({]/.test(next) ||
        ["\\frac", "\\sqrt", "\\pi", "\\sin", "\\cos", "\\tan"].some((token) => this.src.startsWith(token, this.pos));
      if (!startsFactor) break;
      result += matrixEnvironment !== undefined ? `*${this.parseFactor()}` : this.parseFactor();
    }
    return result;
  }

  private parseFactor(): string {
    let base = this.parseAtom();
    this.skipSpace();
    if (this.consume("^")) {
      const expText = this.peek() === "{" ? this.readGroup() : this.parseAtom();
      base = this.applyPower(base, expText);
    }
    return base;
  }

  private applyPower(base: string, exponent: string): string {
    // Sprint V3.0.2 — matriz é OUTRA exceção ao atalho de sobrescrito
    // Unicode (igual à multiplicação implícita em `parseTerm()`): o
    // `normalize_all` do backend reescreve "²"/"³"/... pra "**2"/"**3"
    // ANTES de rotear pro motor de matrizes, mas
    // `matrix/parsing.py:_parse_power` só reconhece "^" LITERAL, nunca
    // "**" — confirmado contra o backend real: "[[1,2],[3,4]]^2" funciona,
    // "[[1,2],[3,4]]²" é REJEITADO ("Não foi possível interpretar a
    // expressão de matriz"). Por isso matriz sempre usa "^" explícito
    // aqui, mesmo com expoente de um dígito só.
    if (/^\[\[.*\]\]$/.test(base)) {
      return `${base}^${exponent}`;
    }
    if (/^[0-9]$/.test(exponent)) {
      return `${base}${SUPERSCRIPT_DIGITS[exponent]}`;
    }
    return `${base}^${this.wrap(exponent)}`;
  }

  private parseAtom(): string {
    this.skipSpace();
    const ch = this.src[this.pos];
    // Fim da string ou grupo `{}` vazio sem `\placeholder` explícito (o
    // MathLive normalmente usa `\placeholder{}`, mas um grupo vazio "cru"
    // tem o mesmo significado prático: um slot ainda não preenchido).
    if (ch === undefined || ch === "}") throw new Incomplete("slot vazio");

    if (this.consume("\\placeholder")) {
      // `\placeholder{}` (vazio) ou `\placeholder{conteúdo}` (já digitado
      // dentro do slot) — se vazio, o template ainda não foi preenchido.
      if (this.peek() === "{") {
        const inner = this.readGroup();
        if (inner.trim() === "") throw new Incomplete("slot vazio");
        return inner;
      }
      throw new Incomplete("slot vazio");
    }

    if (this.consume("\\frac")) {
      const numerator = this.readGroup();
      const denominator = this.readGroup();
      // Sprint V3.0.1 — `\frac{d}{dx}(expr)` é o template de DERIVADA
      // (`d/dx` do teclado), não uma fração de verdade: numerador
      // convertido é exatamente "d" e denominador é "d" + UMA letra
      // (a variável — nunca fixo em "x", detecta qualquer letra, então
      // `d/dy(...)`/`d/dz(...)` etc. funcionam de graça, sem hardcode).
      // O argumento entre parênteses SEMPRE vem logo depois na fonte
      // (parte fixa do template `\left(\placeholder{}\right)`).
      const derivativeMatch = numerator === "d" ? /^d([a-zA-Z])$/.exec(denominator) : null;
      if (derivativeMatch) {
        const variable = derivativeMatch[1];
        const expr = this.parseParenthesizedOrAtom();
        return `derivada(${expr}, ${variable})`;
      }
      return `${this.wrap(numerator)}/${this.wrap(denominator)}`;
    }

    // --- Sprint V3.0.1 (Structured Calculus Input) ------------------------

    if (this.consume("\\int")) {
      let lower: string | null = null;
      let upper: string | null = null;
      if (this.consume("_")) {
        lower = this.peek() === "{" ? this.readGroup() : this.parseAtom();
        this.expect("^");
        upper = this.peek() === "{" ? this.readGroup() : this.parseAtom();
      }
      const raw = this.captureRestOfScope();
      const differential = this.findTrailingDifferential(raw);
      if (!differential) throw new Unsupported("integral sem diferencial (dx) reconhecível");
      const body = this.parseSubExpression(raw.slice(0, differential.index));
      const variable = differential.variable;
      if (lower !== null && upper !== null) {
        return `integral(${body}, ${variable}, ${lower}, ${upper})`;
      }
      return `integral(${body}, ${variable})`;
    }

    if (this.consume("\\lim")) {
      this.expect("_");
      this.expect("{");
      this.skipSpace();
      const variableChar = this.src[this.pos];
      if (variableChar === undefined || !/[a-zA-Z]/.test(variableChar)) {
        throw new Unsupported("limite sem variável reconhecível");
      }
      this.pos++;
      if (!this.consume("\\to")) throw new Unsupported("limite sem seta (\\to) reconhecível");
      const point = this.parseExpression();
      this.expect("}");
      const bodyRaw = this.captureRestOfScope();
      const body = this.parseSubExpression(bodyRaw);
      return `limite(${body}, ${variableChar}, ${point})`;
    }

    if (this.consume("\\sum")) {
      this.expect("_");
      this.expect("{");
      const variable = this.parseExpression();
      this.expect("=");
      const lower = this.parseExpression();
      this.expect("}");
      this.expect("^");
      const upper = this.peek() === "{" ? this.readGroup() : this.parseAtom();
      const bodyRaw = this.captureRestOfScope();
      const body = this.parseSubExpression(bodyRaw);
      // O somatório do backend (`Σ(var=inf..sup) expr`) só aceita limites
      // INTEIROS literais (`summation/parsing.py:_parse_bound`) — nunca
      // expressão/fração/variável. Validado aqui em vez de deixar o
      // backend rejeitar com um erro menos amigável.
      if (!/^-?[0-9]+$/.test(lower) || !/^-?[0-9]+$/.test(upper)) {
        throw new Unsupported("limites do somatório precisam ser números inteiros");
      }
      if (!/^[a-zA-Z_]\w*$/.test(variable)) {
        throw new Unsupported("índice do somatório inválido");
      }
      return `Σ(${variable}=${lower}..${upper}) ${body}`;
    }

    if (this.consume("\\infty")) return "∞";

    for (const [command, name] of [
      ["\\sin", "sin"],
      ["\\cos", "cos"],
      ["\\tan", "tan"],
    ] as const) {
      if (this.consume(command)) {
        const arg = this.parseParenthesizedOrAtom();
        return `${name}(${arg})`;
      }
    }

    // --- Sprint V3.0.2 (Structured Algebra Input) --------------------------

    if (this.consume("\\begin{cases}")) {
      // Sistema linear — cada linha é uma equação INTEIRA (nunca dividida
      // por "&"), unida por ";" — o mesmo separador que
      // `equations/dispatcher.py:_SPLIT_PATTERN` já aceita. Cada linha
      // passa por `parseSubExpression` (o mesmo `parseEquation()` de
      // sempre), nunca um "parser de equação de sistema" à parte.
      const rows = this.readRawRows("cases").map((row) => this.parseSubExpression(row));
      return rows.join(";");
    }

    for (const env of ["bmatrix", "pmatrix", "matrix"] as const) {
      if (this.consume(`\\begin{${env}}`)) {
        return this.buildMatrixLiteral(this.readRawRows(env));
      }
    }

    if (this.consume("\\begin{vmatrix}")) {
      // Representação visual de determinante (barras, pedida pelo ticket)
      // — nunca uma segunda função: envolve a MESMA sintaxe literal de
      // matriz em `det(...)`, a função que o backend já suporta.
      return `det(${this.buildMatrixLiteral(this.readRawRows("vmatrix"))})`;
    }

    for (const [command, name] of [
      // "\det(...)" — a notação que o PRÓPRIO `to-latex.ts` (`previewLatex`,
      // via o serializer nativo do mathjs) já produz para `det(...)`
      // digitado/histórico; reconhecida aqui para os exemplos rápidos
      // "carregarem visualmente" (`\det\left(\begin{bmatrix}...\end{bmatrix}
      // \right)`) e continuarem resolvíveis sem edição manual — mesma
      // função do backend que `\begin{vmatrix}...\end{vmatrix}` já cobre
      // (a representação de barras pedida pelo ticket), nunca uma segunda.
      ["\\det", "det"],
      ["\\operatorname{inv}", "inv"],
      ["\\operatorname{transpose}", "transpose"],
    ] as const) {
      if (this.consume(command)) {
        const arg = this.parseParenthesizedOrAtom();
        return `${name}(${arg})`;
      }
    }

    if (this.consume("\\sqrt")) {
      if (this.consume("[")) {
        const indexStart = this.pos;
        while (this.pos < this.src.length && this.src[this.pos] !== "]") this.pos++;
        const indexLatex = this.src.slice(indexStart, this.pos);
        this.expect("]");
        const radicand = this.readGroup();
        const index = new LatexParser(indexLatex).parseEquation();
        if (index === "2") return `√(${radicand})`;
        if (index === "3") return `∛(${radicand})`;
        return `(${radicand})**(1/(${index}))`;
      }
      const radicand = this.readGroup();
      return `√(${radicand})`;
    }

    if (this.consume("\\pi")) return "π";

    if (this.consume("(")) {
      const inner = this.parseExpression();
      this.expect(")");
      return `(${inner})`;
    }

    if (this.consume("{")) {
      const inner = this.parseExpression();
      this.expect("}");
      return inner;
    }

    if (/[0-9]/.test(ch)) {
      const start = this.pos;
      while (this.pos < this.src.length && /[0-9.]/.test(this.src[this.pos])) this.pos++;
      return this.src.slice(start, this.pos);
    }

    if (/[a-zA-Z]/.test(ch)) {
      this.pos++;
      return ch;
    }

    throw new Unsupported(`símbolo não suportado: "${ch}"`);
  }
}

export function mathFieldLatexToBackendExpression(latex: string): MathfieldConversion {
  try {
    const expression = new LatexParser(latex.trim()).parseEquation();
    return { ok: true, expression };
  } catch (error) {
    if (error instanceof Incomplete) return { ok: false, reason: "incomplete" };
    return { ok: false, reason: "unsupported" };
  }
}
