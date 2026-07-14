export interface CursorInsertion {
  value: string;
  cursorPosition: number;
}

/**
 * Insere `insertText` na posição do cursor (ou substitui a seleção atual,
 * quando `selectionStart !== selectionEnd`), e calcula onde o cursor deve
 * ficar depois — `cursorOffset` é relativo ao INÍCIO do texto inserido, não
 * ao fim, para que templates como "sen()" possam posicionar o cursor
 * DENTRO dos parênteses em vez de depois deles.
 *
 * Função pura, sem DOM — o chamador (`CalculatorWorkspace`) é responsável
 * por ler `selectionStart`/`selectionEnd` do input real e por reaplicar
 * `cursorPosition` via `setSelectionRange` depois do re-render.
 */
export function insertAtCursor(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  insertText: string,
  cursorOffset: number
): CursorInsertion {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  const nextValue = value.slice(0, start) + insertText + value.slice(end);
  const cursorPosition = start + cursorOffset;
  return { value: nextValue, cursorPosition };
}
