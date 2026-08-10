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
 * Catálogo fechado, do tamanho exato do escopo da V3.0 (números,
 * variáveis, `+ - × ÷ =`, parênteses, potência, fração, raiz
 * quadrada/cúbica/n-ésima, π). Fail-closed: qualquer comando LaTeX fora
 * deste catálogo devolve `{ok:false}` em vez de adivinhar — o chamador
 * mostra uma mensagem amigável, nunca envia sintaxe potencialmente
 * quebrada ao backend. Integrais, derivadas, limites, somatórios,
 * matrizes, sistemas, combinatória e probabilidade ficam para V3.0.x
 * (fora do catálogo por construção, não por uma lista de exclusão).
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
      // `\pi`) sem operador entre eles.
      const next = this.peek();
      const startsFactor =
        /[0-9a-zA-Z({]/.test(next) || this.src.startsWith("\\frac", this.pos) || this.src.startsWith("\\sqrt", this.pos) || this.src.startsWith("\\pi", this.pos);
      if (!startsFactor) break;
      result += this.parseFactor();
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
      return `${this.wrap(numerator)}/${this.wrap(denominator)}`;
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
