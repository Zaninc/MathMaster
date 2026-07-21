interface VisualTile {
  title: string;
  description: string;
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
    title: "Funções",
    description: "Visualização interativa de funções matemáticas: gráficos polinomiais, trigonométricos, exponenciais e logarítmicos.",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M8 8v48h48" />
        <path d="M12 44c8-24 20-24 28-4s16 4 16-8" stroke="var(--accent)" />
      </svg>
    ),
  },
  {
    title: "Geometria",
    description: "Construções geométricas no plano cartesiano: triângulos, retas e medições dinâmicas.",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M14 50 L50 50 L32 14 Z" />
        <path d="M32 50 V14" strokeDasharray="2 3" stroke="var(--accent)" />
        <path d="M28 50 v-4 h4" stroke="var(--accent)" />
      </svg>
    ),
  },
  {
    title: "Cônicas",
    description: "Circunferências, parábolas, elipses e hipérboles — exploração visual e propriedades matemáticas.",
    icon: (
      <svg {...ICON_PROPS}>
        <ellipse cx="32" cy="24" rx="20" ry="10" />
        <path d="M14 50c6-14 30-14 36 0" stroke="var(--accent)" />
      </svg>
    ),
  },
  {
    title: "Exploração visual",
    description: "Ferramentas para compreender conceitos matemáticos de forma intuitiva.",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="28" cy="28" r="16" />
        <path d="M40 40 L54 54" />
        <path d="M20 30c3-8 6-8 8-3s5 5 8-3" stroke="var(--accent)" />
      </svg>
    ),
  },
];

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
              <div className="flex flex-col items-center gap-1">
                <span className="text-center text-sm font-medium text-text-primary">{tile.title}</span>
                <span className="text-center text-xs text-text-muted">{tile.description}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-text-muted">
          Matemática visual — experimente funções e figuras geométricas de forma interativa.
        </p>
      </div>
    </section>
  );
}
