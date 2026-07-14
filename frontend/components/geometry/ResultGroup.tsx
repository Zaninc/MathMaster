interface ResultGroupProps {
  label: string;
  children: React.ReactNode;
}

/**
 * Primitivo compartilhado do painel de resultados de Geometria (Triângulo
 * e Círculo) — rótulo pequeno em maiúsculas + conteúdo, um por grupo
 * (Área/Perímetro/Lados/Classificação). Puramente de apresentação: não
 * calcula nada, só organiza o que já foi calculado.
 */
export function ResultGroup({ label, children }: ResultGroupProps) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</span>
      <div className="text-sm leading-relaxed text-text-primary [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}
