import katex from "katex";
import "katex/dist/katex.min.css";

export interface MathFormulaProps {
  /** Fórmula em LaTeX (sem delimitadores `$`/`\[`). */
  formula: string;
  /** `true` renderiza em bloco centralizável (display math); padrão é inline. */
  displayMode?: boolean;
  /** Classes extras aplicadas ao wrapper (espaçamento/cor de contexto). */
  className?: string;
}

/**
 * Fundação de renderização matemática da aplicação — todo LaTeX exibido
 * ao usuário passa por aqui (painéis de geometria hoje; calculadora,
 * histórico e editor no futuro).
 *
 * `renderToString` é uma função pura e determinística que roda igual em
 * Node e no browser: o HTML gerado no servidor é idêntico ao do cliente,
 * então o componente é SSR-safe sem `"use client"` e sem risco de
 * mismatch de hidratação. `output: "htmlAndMathml"` embute MathML oculto
 * que leitores de tela leem no lugar do HTML visual do KaTeX.
 *
 * Falhas nunca quebram a página: `throwOnError: false` faz o KaTeX
 * renderizar o próprio código-fonte em cor de erro para LaTeX inválido, e
 * o try/catch cobre erros não-parseáveis devolvendo a fórmula crua em
 * `<code>`. As cores do KaTeX herdam `currentColor`, então o tema escuro
 * (e qualquer cor de contexto via `className`) funciona sem CSS extra.
 */
export function MathFormula({ formula, displayMode = false, className }: MathFormulaProps) {
  let html: string | null = null;
  try {
    html = katex.renderToString(formula, {
      displayMode,
      throwOnError: false,
      errorColor: "var(--danger)",
      output: "htmlAndMathml",
      strict: "ignore",
    });
  } catch {
    html = null;
  }

  if (html === null) {
    return (
      <code role="math" aria-label={formula} className={className}>
        {formula}
      </code>
    );
  }

  if (displayMode) {
    // Bloco: fórmulas largas rolam dentro do próprio container em vez de
    // estourar a coluna lateral (280-340px) do painel de resultados.
    // `.katex-display` traz `margin: 1em 0` do CSS do KaTeX — zerado aqui
    // para que o espaçamento vertical fique a cargo do layout consumidor.
    return (
      <div
        className={`max-w-full overflow-x-auto overflow-y-hidden [&_.katex-display]:my-0 ${className ?? ""}`.trim()}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
