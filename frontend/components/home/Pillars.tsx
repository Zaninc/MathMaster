import { cn } from "@/lib/utils/cn";

const PILLARS = [
  { title: "Ensinar", description: "Entenda conceitos, relações e resultados." },
  { title: "Acompanhar", description: "Veja sua evolução e identifique onde precisa melhorar." },
  { title: "Motivar", description: "Transforme cada dificuldade em um próximo passo claro." },
] as const;

const ICON_PATHS = [
  <path key="ensinar" d="M4 6h16M4 12h10M4 18h16" />,
  <path key="acompanhar" d="M4 18l5-6 4 4 7-10" />,
  <path
    key="motivar"
    d="M12 3v4M12 17v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M3 12h4M17 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"
  />,
];

function PillarIcon({ index }: { index: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {ICON_PATHS[index]}
    </svg>
  );
}

/**
 * Composição conectada, não três cards idênticos: bordas ligando os
 * pilares e o do meio deslocado verticalmente, para que o conjunto se leia
 * como um fluxo único (Ensinar → Acompanhar → Motivar).
 */
export function Pillars() {
  return (
    <section id="pilares" className="border-b border-border py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:gap-0">
          {PILLARS.map((pillar, index) => (
            <div
              key={pillar.title}
              className={cn(
                "flex flex-1 flex-col gap-3 px-4",
                index > 0 && "sm:border-l sm:border-border",
                index === 1 && "sm:translate-y-6"
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border-hover text-accent">
                <PillarIcon index={index} />
              </span>
              <h3 className="text-lg font-semibold text-text-primary">{pillar.title}</h3>
              <p className="text-sm text-text-secondary">{pillar.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
