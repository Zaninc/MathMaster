interface VisualTile {
  title: string;
  icon: React.ReactNode;
}

const ICON_PROPS = {
  viewBox: "0 0 64 64",
  className: "h-14 w-14",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": "true" as const,
};

const TILES: VisualTile[] = [
  {
    title: "Gráfico cartesiano",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M8 8v48h48" />
        <path d="M12 44c8-24 20-24 28-4s16 4 16-8" stroke="var(--accent)" />
      </svg>
    ),
  },
  {
    title: "Triângulo",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M32 10 L54 50 L10 50 Z" />
      </svg>
    ),
  },
  {
    title: "Círculo",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="32" cy="32" r="22" />
        <path d="M32 32 L32 10" strokeDasharray="2 3" />
      </svg>
    ),
  },
  {
    title: "Curva quadrática",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M8 44h48" stroke="var(--border)" />
        <path d="M8 12c8 20 16 20 24 20s16 0 24-20" stroke="var(--accent)" />
      </svg>
    ),
  },
];

/**
 * Tira ilustrativa, deliberadamente estática (o motor real de Gráficos e
 * Geometria chega nas Etapas 3/4) — a legenda deixa isso explícito para
 * não sugerir uma interatividade que ainda não existe.
 */
export function VisualizationPreview() {
  return (
    <section className="border-b border-border py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-xl font-semibold text-text-primary">Matemática, visualmente</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {TILES.map((tile) => (
            <div
              key={tile.title}
              className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-6 text-text-secondary"
            >
              {tile.icon}
              <span className="text-center text-sm text-text-secondary">{tile.title}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-text-muted">
          Prévia visual — os gráficos e figuras interativos chegam nas próximas etapas.
        </p>
      </div>
    </section>
  );
}
