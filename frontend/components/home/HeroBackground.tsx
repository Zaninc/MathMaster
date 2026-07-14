/**
 * Camada decorativa do Hero — puramente ilustrativa (curva, grid, símbolos
 * matemáticos em opacidade baixa), sem animação (evita "loops constantes"
 * e problemas de `prefers-reduced-motion` por construção, não por exceção).
 * `aria-hidden`: não faz parte do conteúdo, leitores de tela devem pulá-la.
 */
export function HeroBackground() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 800 400"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      <path d="M0 260 L800 260" stroke="var(--border)" strokeWidth="1" />
      <path d="M120 0 L120 400" stroke="var(--border)" strokeWidth="1" />
      <path
        d="M0 320 Q200 40 400 220 T800 120"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeOpacity="0.35"
        strokeLinecap="round"
      />
      <circle cx="400" cy="220" r="4" fill="var(--accent)" opacity="0.6" />
      <text x="620" y="90" fill="var(--accent-secondary)" fontSize="28" opacity="0.35">
        ∫
      </text>
      <text x="60" y="200" fill="var(--accent)" fontSize="22" opacity="0.3">
        π
      </text>
      <text x="680" y="300" fill="var(--text-secondary)" fontSize="20" opacity="0.25">
        √x
      </text>
    </svg>
  );
}
