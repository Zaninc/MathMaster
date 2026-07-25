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
    // `pr-1`: o próprio HTML do KaTeX (delimitadores SVG do `\left`/`\right`,
    // ex. em matrizes) mede alguns px a mais de `scrollWidth` do que o
    // `clientWidth` do wrapper por arredondamento sub-pixel do layout do
    // KaTeX — mesmo quando o conteúdo cabe visualmente, o que fazia
    // `overflow-x-auto` mostrar uma barra permanente e falsa. A folga
    // absorve esse ruído sem mascarar overflow real (confirmado com uma
    // matriz 5x5 genuinamente larga, que continua rolando normalmente).
    //
    // Correção (card cortando o alto/baixo de matrizes/frações): este
    // wrapper NUNCA leva `overflow-y-hidden`/`overflow-y-*` — a
    // especificação CSS força os dois eixos de overflow a um valor
    // não-`visible` quando qualquer um dos dois é explicitamente definido
    // (ex. `overflow-x: auto` sozinho já basta para isso; confirmado com
    // Chrome real: `getComputedStyle(wrapper).overflowY` já vem "auto"
    // mesmo sem NUNCA declarar overflow-y aqui), então nem "esquecer"
    // overflow-y neste wrapper nem declará-lo `visible` explicitamente
    // evita esse cômputo forçado. A defesa real é estrutural: o HTML do
    // KaTeX nunca é filho DIRETO deste wrapper (que tem overflow-x-auto)
    // — vai num wrapper interno comum, sem NENHUMA propriedade de
    // overflow própria.
    //
    // `py-2` no wrapper interno (não `py-1`): mesmo raciocínio do `pr-1`
    // horizontal acima, só que no eixo vertical — confirmado empiricamente
    // (Chrome real, KaTeX renderizado de verdade) que o "vlist"/strut
    // interno do KaTeX para matrizes com fração ou 3+ linhas ultrapassa a
    // altura calculada em fluxo normal por ~2-3px; como o overflow-y deste
    // wrapper está forçado a "auto" (nunca "visible" de verdade, ver
    // acima), esses poucos pixels de sobra CONTAM como overflow real e
    // disparam uma barra de rolagem vertical falsa. `py-2` (8px de cada
    // lado) absorve essa folga de sobra sem mascarar overflow genuíno —
    // testado com `[[1,2,3],[4,5,6]]` transposta (3 linhas) e
    // `inv([[2,0],[0,2]])` (frações), `py-1` (4px) não bastava, `py-2`
    // zera a diferença entre `scrollHeight`/`clientHeight` nos dois casos.
    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        className={`max-w-full overflow-x-auto pr-1 [&_.katex-display]:my-0 ${className ?? ""}`.trim()}
      >
        <div className="py-2" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  }

  if (scrollable) {
    // `display:block` via classe (não a tag) continua HTML válido dentro
    // de um `<p>` — só a TAG importa para o modelo de conteúdo, não o
    // `display` computado. Mesma correção estrutural do `displayMode`
    // acima (wrapper interno sem overflow próprio, `py-2` absorvendo a
    // folga vertical de ~2-3px do KaTeX, ver comentário lá) —
    // `inline-block` no interno (em vez de `block`) porque este é o
    // caminho INLINE do componente: precisa continuar participando da
    // linha de texto ao redor (ex. o rótulo "Resultado:" antes dele), só
    // ganhando sua própria caixa de bloco para o `py-2` ter efeito visual
    // real.
    return (
      <span
        ref={ref as React.Ref<HTMLSpanElement>}
        className={`block max-w-full overflow-x-auto pr-1 align-middle [&_.katex-display]:my-0 ${className ?? ""}`.trim()}
      >
        <span className="inline-block py-2" dangerouslySetInnerHTML={{ __html: html }} />
      </span>
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
