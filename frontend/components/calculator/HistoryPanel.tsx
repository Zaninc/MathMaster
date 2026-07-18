"use client";

import { MathFormula } from "@/components/shared/MathFormula";
import { useSolveLatex } from "@/hooks/useSolveLatex";
import type { HistoryItem } from "@/lib/api/types";

interface HistoryPanelProps {
  items: HistoryItem[];
  hiddenTimestamps: Set<string>;
  onSelect: (expression: string) => void;
  onHide: (timestamp: string) => void;
}

/**
 * Linha matemática de um item — mesma infraestrutura da Sprint KaTeX Fase
 * 2 (`useSolveLatex`/`MathFormula`): texto puro primeiro, promovido a
 * KaTeX quando a conversão resolve; conversão nula = exibição de antes.
 * Componente próprio para o hook rodar por item (e o cache do hook evitar
 * reconversão a cada refetch do histórico).
 */
function HistoryEntry({ expression, result }: { expression: string; result: string }) {
  const { expressionLatex, segments } = useSolveLatex(expression, result);

  return (
    <div className="flex flex-wrap items-baseline gap-x-1.5 [overflow-wrap:anywhere]">
      {expressionLatex !== null ? <MathFormula formula={expressionLatex} /> : <span>{expression}</span>}
      <span>=</span>
      {segments !== null ? (
        segments.map((segment) => (
          <span
            key={`${segment.label ?? ""}:${segment.text}`}
            className="inline-flex flex-wrap items-baseline gap-x-1"
          >
            {segment.label !== null && <span className="text-text-secondary">{segment.label}:</span>}
            {segment.latex !== null ? <MathFormula formula={segment.latex} /> : <span>{segment.text}</span>}
          </span>
        ))
      ) : (
        <span>{result}</span>
      )}
    </div>
  );
}

/**
 * "Ocultar" é só estado local (não existe endpoint de exclusão no
 * backend) — nunca chamado de "Limpar", que sugeriria apagar do servidor.
 * O histórico em si é global da instância (sem autenticação ainda), não
 * uma conta pessoal — a legenda deixa isso explícito.
 *
 * Acessibilidade: o `aria-label` do botão de reutilizar carrega o par
 * expressão/resultado em texto cru — o KaTeX visual não altera o nome
 * acessível nem o texto enviado por `onSelect`.
 */
export function HistoryPanel({ items, hiddenTimestamps, onSelect, onHide }: HistoryPanelProps) {
  const visibleItems = items.filter((item) => !hiddenTimestamps.has(item.timestamp));

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-medium text-text-secondary">Histórico recente</h2>
        <p className="text-xs text-text-muted">
          Compartilhado por quem está usando esta instância agora — ainda não é uma conta pessoal.
        </p>
      </div>

      {visibleItems.length === 0 ? (
        <p className="text-sm text-text-muted">Nenhuma expressão resolvida ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibleItems.map((item) => (
            <li
              key={item.timestamp}
              className="flex items-start justify-between gap-2 rounded-md border border-border bg-surface p-3 text-sm"
            >
              <button
                type="button"
                onClick={() => onSelect(item.expression)}
                aria-label={`Reutilizar expressão: ${item.expression} igual a ${item.result}`}
                className="flex-1 text-left text-text-primary hover:text-accent"
              >
                <HistoryEntry expression={item.expression} result={item.result} />
                <span className="text-xs text-text-muted">{new Date(item.timestamp).toLocaleString()}</span>
              </button>
              <button
                type="button"
                onClick={() => onHide(item.timestamp)}
                aria-label={`Ocultar da lista: ${item.expression}`}
                className="shrink-0 text-xs text-text-muted hover:text-text-secondary"
              >
                Ocultar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
