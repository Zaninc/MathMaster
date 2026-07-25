"use client";

import { forwardRef, KeyboardEvent, useLayoutEffect, useRef } from "react";

interface MathInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
}

/** Teto de crescimento automático — depois disso o campo rola internamente em vez de continuar crescendo. */
const MAX_HEIGHT_PX = 200;

/**
 * `<textarea>` auto-crescente (não um widget de composição matemática) —
 * decisão da auditoria da Sprint Frontend V1, mantida: como a sintaxe do
 * MathMaster já é Unicode nativo, o texto do campo É literalmente o
 * payload de `apiClient.solve()`, sem camada de tradução. Isso garante
 * teclado normal, colar, Unicode e acessibilidade de graça.
 *
 * Sprint V2.2.1 (Variáveis Locais para Matrizes): virou `<textarea>` (era
 * `<input type="text">`) para o programa multi-linha de matriz
 * ("A=[[1,2],[3,4]]\nB=...\nA*B") ser digitável/colável de verdade, não só
 * alcançável via botão de exemplo — 1 linha de altura inicial, cresce até
 * `MAX_HEIGHT_PX` e depois rola (`resize-none`: o usuário não redimensiona
 * manualmente, só o conteúdo dita a altura). Enter agora insere quebra de
 * linha (comportamento nativo de `<textarea>`, nunca envia o formulário
 * sozinho) — Ctrl+Enter (Windows/Linux) ou Cmd+Enter (macOS) resolve via
 * `form.requestSubmit()` no MESMO `<form>` que o botão "Resolver" já usa
 * (nenhuma lógica de submit duplicada; respeita o `disabled` do botão, ex.
 * campo vazio ou já resolvendo). O botão "Resolver" continua o caminho
 * principal em qualquer dispositivo — em especial mobile, sem Ctrl/Cmd.
 */
export const MathInput = forwardRef<HTMLTextAreaElement, MathInputProps>(function MathInput(
  { id, value, onChange, placeholder, ariaDescribedBy, ariaInvalid },
  forwardedRef
) {
  const internalRef = useRef<HTMLTextAreaElement | null>(null);

  // Recalcula a altura sempre que `value` muda — por digitação OU por
  // preenchimento programático (exemplos, teclado matemático, histórico),
  // que não passam pelo `onChange` do campo e por isso não disparariam um
  // ajuste feito só ali. `useLayoutEffect` (não `useEffect`) aplica antes
  // do navegador pintar o frame, sem flash de altura errada.
  useLayoutEffect(() => {
    const node = internalRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  function setRefs(node: HTMLTextAreaElement | null) {
    internalRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    const form = event.currentTarget.form;
    const submitButton = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submitButton?.disabled) return;
    form?.requestSubmit();
  }

  return (
    <textarea
      ref={setRefs}
      id={id}
      rows={1}
      autoComplete="off"
      spellCheck={false}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      className="w-full resize-none overflow-y-auto rounded-lg border border-border bg-surface px-4 py-3 text-lg text-text-primary outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
    />
  );
});
