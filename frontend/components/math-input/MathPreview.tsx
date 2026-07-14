import type { ReactNode } from "react";

const EXPONENT_PATTERN = /\*\*(\(([^()]*)\)|[A-Za-z0-9]+)/g;

/**
 * Só trata cosmeticamente o caso "**expoente" (ASCII) — sobrescritos
 * Unicode como "²"/"³" já aparecem elevados pelo próprio glifo, não
 * precisam de tratamento. Puramente de apresentação: nunca altera o valor
 * real do input, só o que é espelhado aqui.
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
 * informação.
 */
export function MathPreview({ value }: MathPreviewProps) {
  if (!value.trim()) {
    return (
      <p aria-hidden="true" className="min-h-8 text-lg text-text-muted">
        Pré-visualização
      </p>
    );
  }

  return (
    <p aria-hidden="true" className="min-h-8 break-words text-lg text-text-primary">
      {renderSegments(value)}
    </p>
  );
}
