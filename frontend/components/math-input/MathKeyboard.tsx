"use client";

import { KeyboardEvent, useState } from "react";

import { MathFormula } from "@/components/shared/MathFormula";
import { KEYBOARD_CATEGORIES, type KeyboardKey } from "@/data/keyboard";
import { cn } from "@/lib/utils/cn";

interface MathKeyboardProps {
  /**
   * Recebe a TECLA inteira (não só insert/cursorOffset): o consumidor
   * decide o comportamento com seleção (`key.selection`) — o teclado só
   * apresenta e delega, nunca transforma texto.
   */
  onInsert: (key: KeyboardKey) => void;
}

/**
 * Padrão ARIA de abas (tablist/tab/tabpanel) com navegação por setas —
 * `aria-label` de cada tecla descreve a ação, não só repete o glifo bruto
 * (ex. "∫" sozinho não é autoexplicativo para leitor de tela).
 */
export function MathKeyboard({ onInsert }: MathKeyboardProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeCategory = KEYBOARD_CATEGORIES[activeIndex];

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % KEYBOARD_CATEGORIES.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + KEYBOARD_CATEGORIES.length) % KEYBOARD_CATEGORIES.length;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    setActiveIndex(nextIndex);
    document.getElementById(`keyboard-tab-${nextIndex}`)?.focus();
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div
        role="tablist"
        aria-label="Categorias do teclado matemático"
        className="flex overflow-x-auto border-b border-border"
      >
        {KEYBOARD_CATEGORIES.map((category, index) => (
          <button
            key={category.id}
            id={`keyboard-tab-${index}`}
            role="tab"
            type="button"
            aria-selected={index === activeIndex}
            aria-controls={`keyboard-panel-${category.id}`}
            tabIndex={index === activeIndex ? 0 : -1}
            onClick={() => setActiveIndex(index)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            className={cn(
              "shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors",
              index === activeIndex
                ? "border-b-2 border-accent text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {category.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`keyboard-panel-${activeCategory.id}`}
        aria-labelledby={`keyboard-tab-${activeIndex}`}
        className="grid grid-cols-4 gap-2 p-3 sm:grid-cols-6"
      >
        {activeCategory.keys.map((key) => (
          <button
            key={key.label}
            type="button"
            onClick={() => onInsert(key)}
            aria-label={key.ariaLabel ?? `Inserir ${key.label}`}
            className="min-h-11 overflow-hidden rounded-md border border-border bg-background px-2 py-2 text-sm text-text-primary transition-colors hover:border-border-hover hover:bg-surface-elevated"
          >
            {/* `latex` é só apresentação (Sprint KaTeX Fase 5): o clique
                continua inserindo `key.insert` intocado. `aria-hidden` no
                span porque o nome acessível já vem do aria-label do botão —
                o MathML interno do KaTeX não deve ser lido em duplicata. */}
            {key.latex !== undefined ? (
              <span aria-hidden="true">
                <MathFormula formula={key.latex} />
              </span>
            ) : (
              key.label
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
