import { forwardRef } from "react";

import katex from "katex";
import "katex/dist/katex.min.css";

export interface MathFormulaProps {
  /** Fórmula em LaTeX (sem delimitadores `$`/`\[`). */
  formula: string;
  /** `true` renderiza em bloco centralizável (display math); padrão é inline. */
  displayMode?: boolean;
  /** Classes extras aplicadas ao wrapper (espaçamento/cor de contexto). */
  className?: string;
  /**
   * Sprint V2.1 (BUG 1): quando `true` (e `displayMode` é `false`), envolve
   * o KaTeX inline num wrapper com rolagem horizontal própria — mesma
   * técnica do `displayMode`, adaptada para continuar um elemento de nível
   * inline (`<span>` com `display:block` via classe, nunca `<div>`, que
   * seria HTML inválido dentro de um `<p>`). Usar SÓ onde uma fórmula pode
   * legitimamente crescer sem limite (resultado de somatório, preview de
   * expressão livre) — ex. `ResultPanel`/`HistoryPanel`/`MathPreview`.
   * Deliberadamente OPT-IN, não o padrão: um rótulo pequeno de botão (ex.
   * `FunctionList.ExampleLabel`) precisa do oposto — crescer livremente e
   * deixar o `flex-wrap` do container decidir a quebra de linha, nunca
   * ganhar sua própria barra de rolagem interna (ver comentário lá).
   */
  scrollable?: boolean;
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
 *
 * `ref` (Sprint V2.1, apresentação progressiva) encaminha para o elemento
 * raiz de fato renderizado (`<code>`/`<div>`/`<span>`) — usado por
 * `ProgressiveMathResult` para medir overflow real via
 * `hooks/useIsOverflowing.ts`. Opcional; nenhum consumidor existente passa
 * `ref`, então isso não muda nada para eles.
 */
export const MathFormula = forwardRef<HTMLElement, MathFormulaProps>(function MathFormula(
  { formula, displayMode = false, className, scrollable = false },
  ref
) {
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
      <code ref={ref as React.Ref<HTMLElement>} role="math" aria-label={formula} className={className}>
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
        ref={ref as React.Ref<HTMLDivElement>}
        className={`max-w-full overflow-x-auto overflow-y-hidden [&_.katex-display]:my-0 ${className ?? ""}`.trim()}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  if (scrollable) {
    // `display:block` via classe (não a tag) continua HTML válido dentro
    // de um `<p>` — só a TAG importa para o modelo de conteúdo, não o
    // `display` computado. `overflow-y-hidden` só corta o que mesmo assim
    // sobrar de altura; a caixa cresce livremente para acomodar frações
    // altas, não há `max-height` fixo aqui — mesmo padrão do `displayMode`.
    return (
      <span
        ref={ref as React.Ref<HTMLSpanElement>}
        className={`block max-w-full overflow-x-auto overflow-y-hidden align-middle [&_.katex-display]:my-0 ${className ?? ""}`.trim()}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <span
      ref={ref as React.Ref<HTMLSpanElement>}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
