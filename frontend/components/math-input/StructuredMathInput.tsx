"use client";

import { useEffect, useRef } from "react";

import "mathlive";
import type { MathfieldElement } from "mathlive";

import { repairMathLiveInput } from "@/lib/math/mathfield-to-backend";

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

    // Hotfix V3.0.2a — a barra de espaço, dentro do MathLive, faz o
    // cursor "pular" pra fora do `\begin{cases|bmatrix|pmatrix|matrix|
    // vmatrix}` INTEIRO em vez de só sair do nível mais interno (bug real
    // do MathLive, sem hook público pra impedir — ver docstring de
    // `mathfield-to-backend.ts`).
    //
    // Hotfix V3.0.2c — mais 2 padrões reais de corrupção do MathLive:
    // inserir uma estrutura com o cursor preso numa célula já preenchida
    // (aninha em vez de virar irmã) e digitar dentro de uma estrutura
    // recém-inserida num placeholder de `\left(...\right)` (corrompe a
    // cerca externa). `repairMathLiveInput` compõe os 3 reparos numa
    // ordem fixa — ver a docstring dela em `mathfield-to-backend.ts`.
    //
    // `field.setValue(repaired)` sozinho — nunca `field.value = repaired`
    // (o setter puro da propriedade, testado: deixa o `moveToNextPlaceholder`
    // SEGUINTE pousar na célula errada) e nunca acompanhado de um
    // `executeCommand("moveToNextPlaceholder")` explícito por cima (testado:
    // isso SIM fazia pular uma célula/linha a mais — ex. célula 1,2 vazia
    // pra sempre, "2" caindo direto na 2,1 — porque `setValue()` sozinho JÁ
    // reposiciona corretamente no próximo `\placeholder{}` restante por
    // padrão; chamar o comando de novo por cima avança um segundo passo,
    // sempre um a mais do que deveria). `setValue()` sem nenhuma opção
    // extra é a única forma testada que deixa a digitação seguinte (com ou
    // sem Tab físico no meio) pousar exatamente na próxima célula/linha
    // vazia, em ordem, sem pular nenhuma.
    // Extraída da SUBSCRIÇÃO de `input` (abaixo) porque `field.insert()`
    // — chamado por `api.insert()`, ou seja, TODO clique de tecla do
    // `MathKeyboard` — não dispara um evento `input` que este listener
    // veja (achado do navegador real: digitação física dispara `input`
    // normalmente, mas a chamada programática de `insert()` não — mesmo
    // com `{bubbles:true}` manual, confirmado que só um `dispatchEvent`
    // MANUAL depois recupera o reparo). Sem chamar isto também depois de
    // `field.insert()`, o Hotfix V3.0.2c (aninhamento de estrutura,
    // corrupção de cerca) só se autocorrigiria pra digitação física,
    // nunca pra cliques de tecla — exatamente o caminho mais comum pra
    // reproduzir os dois bugs (clicar Matriz/A⁻¹ duas vezes seguidas).
    function repairFieldIfNeeded(): string {
      const current = field.value;
      const repaired = repairMathLiveInput(current);
      if (repaired !== current) field.setValue(repaired);
      return field.value;
    }

    function handleInput() {
      onChangeRef.current(repairFieldIfNeeded());
    }
    field.addEventListener("input", handleInput);

    // Mesmo atalho que o `<textarea>` legado (`MathInput.tsx`) já tinha:
    // Ctrl/Cmd+Enter resolve — o "Resolver" continua o caminho principal em
    // qualquer dispositivo (em especial mobile, sem Ctrl/Cmd). Enter puro
    // fica com o comportamento nativo do MathLive (navegação estrutural),
    // nunca envia o formulário sozinho.
    //
    // Sprint V3.0.1 (Structured Calculus Input) — Tab/Shift+Tab chamam
    // explicitamente `moveToNextPlaceholder`/`moveToPreviousPlaceholder`
    // (comandos NATIVOS do MathLive, não navegação customizada) —
    // achado da validação no navegador real: depois de `insert()`
    // posicionar o cursor no primeiro `\placeholder{}` (`selectionMode:
    // "placeholder"`), a tecla Tab física nem sempre avança pro PRÓXIMO
    // placeholder sozinha em estruturas com vários slots (ex. integral
    // definida: inferior/superior/integrando) — mas o comando
    // `moveToNextPlaceholder` sempre funciona corretamente quando chamado
    // direto. Se não houver mais placeholder (`executeCommand` devolve
    // `false`), o Tab NÃO é interceptado — sai do campo normalmente
    // (acessibilidade padrão preservada).
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        const form = field.closest("form");
        const submitButton = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
        if (submitButton?.disabled) return;
        form?.requestSubmit();
        return;
      }
      if (event.key === "Tab") {
        const moved = field.executeCommand(event.shiftKey ? "moveToPreviousPlaceholder" : "moveToNextPlaceholder");
        if (moved) event.preventDefault();
        return;
      }
      // Hotfix V3.0.2a — a barra de espaço, dentro do MathLive, significa
      // "sair do grupo delimitador atual" (mesma tecla que fecha um
      // expoente/fração e volta pra base). Dentro de um
      // `\begin{cases}`/`\begin{bmatrix}`/`\begin{vmatrix}` (Álgebra,
      // V3.0.2) isso não sai só do nível mais interno — sai da ESTRUTURA
      // INTEIRA de uma vez (bug real do MathLive, reproduzido no
      // navegador real: digitar "x^2 -4=0", com espaço, produz
      // `\begin{cases}x^2\\ \placeholder{}\end{cases}-4=0` — o resto cai
      // FORA do ambiente, e o placeholder da próxima linha/célula fica
      // vazio pra sempre, gerando "incomplete" mesmo num sistema/matriz
      // que o usuário via como preenchido). `skipSpace()` no adapter
      // (`mathfield-to-backend.ts`) já trata qualquer espaço como
      // 100% insignificante, e a navegação oficial entre slots é o Tab
      // (não a barra de espaço) — suprimir a barra de espaço por
      // completo aqui (nunca insere nada, nunca navega) elimina esta
      // classe de bug de forma genérica, sem depender de estar dentro de
      // um ambiente `\begin{...}` especificamente: cobre sistemas,
      // matrizes, determinante e qualquer estrutura futura que reutilize
      // o mesmo mecanismo.
      if (event.key === " ") {
        event.preventDefault();
        return;
      }
    }
    // Fase de CAPTURA (não bubble): o MathLive tem seu próprio handler de
    // teclado interno (num nó dentro do shadow DOM, que recebe o foco de
    // verdade) que intercepta Tab ANTES de qualquer listener em fase de
    // bubble no elemento hospedeiro conseguir reagir — confirmado no
    // navegador real (sem `capture: true`, `moveToNextPlaceholder` nunca
    // era chamado por uma tecla Tab física, só quando disparado
    // programaticamente). Capturar aqui garante que este handler roda
    // ANTES do tratamento interno do MathLive ter a chance de agir.
    field.addEventListener("keydown", handleKeyDown, true);

    container.appendChild(field);
    fieldRef.current = field;
    onReadyRef.current?.({
      insert(latex: string) {
        field.insert(latex, { focus: true, selectionMode: "placeholder" });
        // `field.insert()` não passa pelo listener de `input` (ver
        // `repairFieldIfNeeded` acima) — chamado explicitamente aqui pra
        // cliques de tecla ficarem auto-corrigidos exatamente como
        // digitação física. `onChangeRef` também precisa ser avisado
        // manualmente pelo mesmo motivo (nunca dispara via `handleInput`
        // neste caminho).
        onChangeRef.current(repairFieldIfNeeded());
      },
      focus() {
        field.focus();
      },
    });

    return () => {
      field.removeEventListener("input", handleInput);
      field.removeEventListener("keydown", handleKeyDown, true);
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
