interface DomainMeterProps {
  subject: string;
  percentage: number;
  message: string;
}

/**
 * Medidor de domínio por área. Compartilhado entre a prévia da Home
 * (Etapa 1) e a página real de Aprendizado (Etapa 5) — mesmo componente,
 * fonte de dados diferente (demonstrativa vs. real, quando existir).
 *
 * Percentual sempre exibido como texto (não só a barra) e a barra tem um
 * `aria-label` com o resumo completo — nunca representa o estado só por
 * cor/largura.
 */
export function DomainMeter({ subject, percentage, message }: DomainMeterProps) {
  const clamped = Math.max(0, Math.min(100, percentage));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium text-text-primary">{subject}</span>
        <span className="text-sm text-text-secondary">{clamped}%</span>
      </div>
      <div
        role="img"
        aria-label={`${subject}: ${clamped}%. ${message}`}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-(--motion-slow)"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  );
}
