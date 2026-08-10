"use client";

import dynamic from "next/dynamic";

import type { StructuredMathInputApi } from "./StructuredMathInput";

/**
 * `import "mathlive"` (dentro de `StructuredMathInput.tsx`) registra o
 * custom element `<math-field>` como efeito colateral — quebra em SSR
 * (não existe `customElements`/`document` no server). `ssr: false` só é
 * permitido dentro de um Client Component; `CalculatorWorkspace.tsx` já é
 * `"use client"`, então este loader existe só para isolar o boundary numa
 * unidade própria (mesmo padrão de `GraphsWorkspaceLoader.tsx` para
 * `mathjs`/o plano cartesiano) em vez de espalhar `dynamic()` pelo
 * workspace inteiro.
 */
export const StructuredMathInputLoader = dynamic(
  () => import("./StructuredMathInput").then((mod) => mod.StructuredMathInput),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[3.25rem] w-full rounded-lg border border-border bg-surface px-4 py-3 text-lg text-text-muted">
        Carregando editor...
      </div>
    ),
  }
);

export type { StructuredMathInputApi };
