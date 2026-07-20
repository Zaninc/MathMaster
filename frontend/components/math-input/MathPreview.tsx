"use client";

import type { ReactNode } from "react";

import { MathFormula } from "@/components/shared/MathFormula";
import { useInputLatex } from "@/hooks/useSolveLatex";

const EXPONENT_PATTERN = /\*\*(\(([^()]*)\)|[A-Za-z0-9]+)/g;

/**
 * Fallback cosmético (pré-KaTeX, mantido): só trata o caso "**expoente"
 * (ASCII) — sobrescritos Unicode como "²"/"³" já aparecem elevados pelo
 * próprio glifo. Usado enquanto a conversão LaTeX não resolveu ou quando
 * o texto está fora do catálogo do `to-latex` (entrada incompleta,
 * sintaxe de geometria, palavra solta). Puramente de apresentação: nunca
 * altera o valor real do input, só o que é espelhado aqui.
 */
function renderSegments(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  EXPONENT_PATTERN.lastIndex = 0;
  while ((match = EXPONENT_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const exponent = match[2] ?? match[1];
    nodes.push(<sup key={key++}>{exponent}</sup>);
    lastIndex = EXPONENT_PATTERN.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

interface MathPreviewProps {
  value: string;
}

/**
 * Espelho somente-leitura do input, `aria-hidden`: o valor do input já é
 * lido nativamente por leitor de tela, esta é uma restatement puramente
 * visual (conveniência para usuário vidente), não uma segunda fonte de
 * informação. O input continua sendo a ÚNICA fonte da verdade — nada
 * aqui intercepta ou reescreve a digitação.
 *
 * Sprint KaTeX Fase 4: o conteúdo é promovido a KaTeX via `useInputLatex`
 * (debounce curto + cache + anti-flicker); texto fora do catálogo ou
 * incompleto cai no fallback cosmético de antes, sem erro visual.
 */
export function MathPreview({ value }: MathPreviewProps) {
  const { latex, source } = useInputLatex(value);

  if (!value.trim()) {
    return (
      <p aria-hidden="true" className="min-h-8 text-lg text-text-muted">
        Pré-visualização
      </p>
    );
  }

  // `data-latex-source` publica o contrato de consistência: o texto exato
  // que originou o KaTeX exibido (asserido em teste — deve convergir para
  // o value atual). O fallback textual usa SEMPRE o value atual, nunca um
  // estado paralelo.
  return (
    <p
      aria-hidden="true"
      data-latex-source={latex !== null && source !== null ? source : undefined}
      className="min-h-8 max-w-full break-words text-lg text-text-primary"
    >
      {latex !== null ? (
        // Fórmulas muito largas ou profundamente aninhadas (frações
        // aninhadas, integrais com limites, funções compostas) não devem
        // nunca vazar pro histórico ao lado (grid `lg:grid-cols-[minmax(0,
        // 1fr)_minmax(280px,340px)]`): scroll horizontal PRÓPRIO deste
        // wrapper, nunca reduz fonte nem quebra a fórmula no meio — mesmo
        // padrão que `MathFormula` já usa em `displayMode` (ResultPanel/
        // HistoryPanel, mesmo painel lateral). `display:block` porque um
        // `<span>` (elemento inline) ignora `overflow`; `overflow-y-hidden`
        // só corta o que MESMO ASSIM sobrar de altura — a caixa cresce
        // livremente pra acomodar frações/radicais altos, não há
        // `max-height` fixo aqui.
        <span className="block max-w-full overflow-x-auto overflow-y-hidden py-0.5 align-middle [&_.katex-display]:my-0">
          <MathFormula formula={latex} />
        </span>
      ) : (
        renderSegments(value)
      )}
    </p>
  );
}
