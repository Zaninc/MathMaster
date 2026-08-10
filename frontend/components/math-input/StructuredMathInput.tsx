"use client";

import { useEffect, useRef } from "react";

import "mathlive";
import type { MathfieldElement } from "mathlive";

export interface StructuredMathInputApi {
  /** Insere LaTeX na posição do cursor via a API real do MathLive (nunca concatenação de string). */
  insert(latex: string): void;
  focus(): void;
}

const VIRTUAL_KEYBOARD_STYLE_ID = "structured-math-input-hide-virtual-keyboard-toggle";

/**
 * Hotfix V3.0.1a — `mathVirtualKeyboardPolicy: "manual"` (abaixo) só evita
 * o teclado virtual do MathLive abrir SOZINHO no foco; o `<math-field>`
 * continua desenhando seu próprio ícone/botão de abrir o teclado (visível
 * mesmo em desktop), que o usuário pode clicar manualmente pra acessar
 * estruturas fora do escopo da V3.0 (matrizes, somatórios, integrais...).
 * A biblioteca não expõe uma policy "off" nesta versão — a forma
 * documentada de remover o botão por completo é CSS via `::part()`
 * (`math-field::part(virtual-keyboard-toggle)`), que só funciona como
 * regra de folha de estilo real (não como `style` inline no elemento).
 * Injetado uma única vez, globalmente (idempotente) — todo `<math-field>`
 * da página herda, nunca precisa repetir por instância.
 */
function ensureVirtualKeyboardToggleHidden(): void {
  if (document.getElementById(VIRTUAL_KEYBOARD_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = VIRTUAL_KEYBOARD_STYLE_ID;
  style.textContent = "math-field::part(virtual-keyboard-toggle) { display: none !important; }";
  document.head.appendChild(style);
}

interface StructuredMathInputProps {
  id: string;
  /** Valor em LaTeX — única fonte da verdade do editor. */
  value: string;
  onChange: (latex: string) => void;
  /** Expõe a API imperativa (`insert`/`focus`) assim que o elemento monta. */
  onReady?: (api: StructuredMathInputApi) => void;
  placeholder?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
}

/**
 * Encapsula o `<math-field>` do MathLive (Sprint V3.0) — só UI/foco/API de
 * inserção. Não conhece `normalizeForBackend` nem nenhuma regra do backend;
 * o valor exposto é sempre LaTeX cru, convertido em outro lugar
 * (`lib/math/mathfield-to-backend.ts`).
 *
 * `document.createElement("math-field")` imperativo (em vez de JSX
 * `<math-field>`) deliberadamente: evita qualquer incerteza sobre como o
 * React 19 reconcilia props/eventos num custom element através de um
 * boundary `next/dynamic({ssr:false})`, e dá controle explícito sobre
 * quando a API de inserção fica disponível (`onReady`, chamado uma única
 * vez por montagem, nunca a cada render).
 *
 * Este componente só é carregado no cliente — `import "mathlive"` registra
 * o custom element como efeito colateral do módulo, o que quebraria em SSR;
 * o consumidor (`CalculatorWorkspace`) importa este arquivo via
 * `next/dynamic(..., {ssr:false})`, mesmo padrão já usado por
 * `GraphsWorkspaceLoader.tsx` para `mathjs`/o plano cartesiano.
 */
export function StructuredMathInput({
  id,
  value,
  onChange,
  onReady,
  placeholder,
  ariaDescribedBy,
  ariaInvalid,
}: StructuredMathInputProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<MathfieldElement | null>(null);
  // Ref pro callback mais recente — o efeito de montagem roda uma única vez
  // (não deve recriar o elemento a cada mudança de `onChange`/`onReady`).
  // Atualizado em efeito próprio (não durante o render): mutar `ref.current`
  // no corpo do render é proibido pelas regras novas do React Compiler
  // (`react-hooks/refs`).
  const onChangeRef = useRef(onChange);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    ensureVirtualKeyboardToggleHidden();

    const field = document.createElement("math-field") as MathfieldElement;
    field.id = id;
    field.value = value;
    // Nunca mostra o teclado virtual próprio do MathLive — o MathMaster já
    // tem o seu (`MathKeyboard`). "manual" evita abrir sozinho no foco (ex.
    // touch); o ícone de abrir manualmente é ocultado por CSS acima
    // (`ensureVirtualKeyboardToggleHidden`) — as duas partes juntas
    // deixam o teclado virtual do MathLive inteiramente inacessível ao
    // usuário nesta sprint, sem tocar no teclado FÍSICO (digitação direta
    // continua funcionando normalmente).
    field.mathVirtualKeyboardPolicy = "manual";
    field.smartFence = true;
    field.smartSuperscript = true;
    if (placeholder !== undefined) field.setAttribute("placeholder", placeholder);
    if (ariaDescribedBy !== undefined) field.setAttribute("aria-describedby", ariaDescribedBy);
    field.setAttribute("aria-invalid", String(ariaInvalid ?? false));
    field.style.display = "block";
    field.style.width = "100%";
    field.style.minHeight = "1.75rem";
    field.style.border = "none";
    field.style.outline = "none";
    field.style.background = "transparent";
    field.style.fontSize = "1.125rem";
    field.style.padding = "0";

    function handleInput() {
      onChangeRef.current(field.value);
    }
    field.addEventListener("input", handleInput);

    // Mesmo atalho que o `<textarea>` legado (`MathInput.tsx`) já tinha:
    // Ctrl/Cmd+Enter resolve — o "Resolver" continua o caminho principal em
    // qualquer dispositivo (em especial mobile, sem Ctrl/Cmd). Enter puro
    // fica com o comportamento nativo do MathLive (navegação estrutural),
    // nunca envia o formulário sozinho.
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const form = field.closest("form");
      const submitButton = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (submitButton?.disabled) return;
      form?.requestSubmit();
    }
    field.addEventListener("keydown", handleKeyDown);

    container.appendChild(field);
    fieldRef.current = field;
    onReadyRef.current?.({
      insert(latex: string) {
        field.insert(latex, { focus: true, selectionMode: "placeholder" });
      },
      focus() {
        field.focus();
      },
    });

    return () => {
      field.removeEventListener("input", handleInput);
      field.removeEventListener("keydown", handleKeyDown);
      container.removeChild(field);
      fieldRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Sincroniza mudanças externas (exemplos, histórico, "Limpar") sem brigar
  // com a digitação do usuário: só escreve quando o valor externo diverge
  // do que o campo já tem (o próprio `handleInput` já manteve os dois
  // sincronizados durante digitação normal).
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    if (field.value !== value) field.value = value;
  }, [value]);

  useEffect(() => {
    fieldRef.current?.setAttribute("aria-invalid", String(ariaInvalid ?? false));
  }, [ariaInvalid]);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-x-auto rounded-lg border border-border bg-surface px-4 py-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent"
    />
  );
}
