"use client";

import { forwardRef } from "react";

interface MathInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
}

/**
 * Input real (não um widget de composição matemática) — decisão da
 * auditoria da Sprint Frontend V1: como a sintaxe do MathMaster já é
 * Unicode nativo, o texto do input É literalmente o payload de
 * `apiClient.solve()`, sem camada de tradução. Isso garante teclado
 * normal, colar, Unicode e acessibilidade de graça.
 */
export const MathInput = forwardRef<HTMLInputElement, MathInputProps>(function MathInput(
  { id, value, onChange, placeholder, ariaDescribedBy, ariaInvalid },
  ref
) {
  return (
    <input
      ref={ref}
      id={id}
      type="text"
      autoComplete="off"
      spellCheck={false}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-lg text-text-primary outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
    />
  );
});
