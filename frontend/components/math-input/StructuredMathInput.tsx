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

interface OffsetPoint {
  x: number;
  y: number;
}

/**
 * Hotfix — Cursor e navegação estrutural: acha o "ponto-cursor" visual de
 * um offset — o ponto onde a linha do cursor apareceria se `field.position`
 * fosse esse offset. Investigação real no navegador (`getElementInfo`)
 * confirmou 2 formas: se o offset tem `bounds` e representa um átomo real
 * (`latex` não vazio), o ponto fica logo à DIREITA desse átomo (fim do que
 * já foi digitado); se `bounds` existe mas é um marcador vazio (`latex`
 * vazio, ex. começo de uma célula), o ponto é o próprio `bounds.x/y`. A
 * lacuna real: um offset de FIM-DE-GRUPO (ex. logo depois de todo um "x²"
 * dentro de `cases`/matriz) frequentemente tem `bounds: null` — sem
 * nenhuma hitbox própria — então herda recursivamente o ponto do offset
 * ANTERIOR (o último átomo real dentro do grupo). Sem essa herança, um
 * clique no espaço vazio à direita de "x²" nunca considera esse offset
 * como candidato, e cai só nos offsets REAIS mais próximos — que ficam
 * DENTRO do expoente, nunca no fim da linha (o bug relatado, confirmado
 * com clique genuíno: `\begin{cases}x^2\\ \placeholder{}\end{cases}`,
 * clique à direita de "x²" pousa no offset 4 — dentro do "2" — em vez do
 * offset 5, o fim de "x²").
 */
function cursorPointForOffset(
  field: MathfieldElement,
  offset: number,
  memo: Map<number, OffsetPoint | null>
): OffsetPoint | null {
  if (memo.has(offset)) return memo.get(offset) ?? null;
  const info = field.getElementInfo(offset);
  const bounds = info?.bounds;
  let point: OffsetPoint | null = null;
  if (bounds) {
    point =
      info?.latex && bounds.width >= 0
        ? { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }
        : { x: bounds.x, y: bounds.y + bounds.height / 2 };
  } else if (offset > 0) {
    point = cursorPointForOffset(field, offset - 1, memo);
  }
  memo.set(offset, point);
  return point;
}

/**
 * Hotfix — Cursor e navegação estrutural: escolhe, entre TODOS os offsets
 * do campo (0..`lastOffset`), o mais próximo do ponto clicado — usando o
 * ponto-cursor de `cursorPointForOffset` (que já inclui os offsets de
 * fim-de-grupo sem `bounds` próprio, via herança). Em caso de empate
 * (mesma distância — sempre acontece entre "dentro do grupo" e "fim do
 * grupo", já que o segundo herda o ponto do primeiro), o offset MAIOR
 * vence (`<=`, não `<`) — ou seja, o fim-de-grupo, nunca o interior —
 * confirmado no navegador real que essa é a interpretação que o usuário
 * espera ao clicar depois de uma expressão já completa.
 */
function computeBestOffset(field: MathfieldElement, x: number, y: number): number | null {
  const memo = new Map<number, OffsetPoint | null>();
  let best: number | null = null;
  let bestDistance = Infinity;
  for (let offset = 0; offset <= field.lastOffset; offset++) {
    const point = cursorPointForOffset(field, offset, memo);
    if (!point) continue;
    const dx = point.x - x;
    const dy = point.y - y;
    const distance = dx * dx + dy * dy;
    if (distance <= bestDistance) {
      bestDistance = distance;
      best = offset;
    }
  }
  return best;
}

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

    // Hotfix — Cursor e navegação estrutural (2ª rodada): a 1ª versão só
    // recalculava a posição quando o elemento clicado não tinha NENHUMA
    // classe CSS (`classList.length === 0`) — sinal de "espaço puramente
    // estrutural". Investigação mais funda (ticket "placeholders
    // opcionais + navegação estrutural") revelou que esse gate era
    // estreito DEMAIS: clicar perto (não só EM cima) de um expoente sem
    // mais nada depois (ex. campo só com "x²") ainda cai num elemento
    // COM classe própria (`ML__content`/`ML__caret`/`ML__container` —
    // wrappers genéricos do MathLive, não o glifo em si) — e o
    // `getOffsetFromPoint`/clique nativo do MathLive nesses pontos é
    // realmente ERRÁTICO, não só "impreciso": o mesmo campo `x^2`,
    // clicando em pontos a poucos pixels de distância um do outro,
    // pousava ora certo (offset 4, fim de "x²"), ora dentro do expoente
    // (offset 3), ora até no INÍCIO do campo inteiro (offset 0) —
    // confirmado com clique genuíno despachado (`PointerEvent`/
    // `MouseEvent` reais), não só chamando `getOffsetFromPoint` isolado.
    // Um gate por classe CSS nunca capturaria esse caso (a classe está
    // lá, só não é o glifo certo).
    //
    // Correção: SEMPRE recalcula via `computeBestOffset` pra todo clique
    // dentro do campo (nunca mais um gate por classe) — só usa APIs
    // públicas do MathLive (`getElementInfo`/`lastOffset`/`position`),
    // nunca mede pixel do DOM renderizado. Validado que isso NUNCA piora
    // um clique genuinamente normal: `computeBestOffset` já considera
    // TODOS os offsets reais (com `bounds` própria) como candidatos —
    // clicar em cima de "x"/"2"/qualquer glifo continua resolvendo pro
    // MESMO offset que o clique nativo daria (testado ponto a ponto no
    // navegador real, incluindo dentro de fração/matriz) — a única
    // diferença é que agora os offsets de FIM-DE-GRUPO (sem `bounds`
    // própria, ver `cursorPointForOffset`) também entram na disputa, o
    // que é exatamente o que faltava.
    //
    // Registrado no PRÓPRIO `field` (nunca no wrapper) — achado real no
    // navegador: o handler interno de clique do MathLive chama
    // `stopPropagation()` depois de processar o clique (confirmado
    // dispatachando um clique real e comparando um listener no `field`
    // contra um no `container`: o do `field` sempre dispara, o do
    // `container` nunca recebe nada quando o clique se origina dentro do
    // conteúdo do campo) — outros listeners registrados no MESMO nó
    // (`field`) ainda disparam normalmente (`stopPropagation` só
    // impede chegar no PRÓXIMO nó da árvore, nunca os do mesmo nó), só
    // não adianta esperar o evento subir até o wrapper.
    //
    // `!field.selectionIsCollapsed` sai cedo — nunca colapsa uma seleção
    // que o usuário acabou de arrastar OU obtida por duplo/triplo clique
    // (seleção de palavra/linha nativa do MathLive sempre deixa
    // `selectionIsCollapsed === false`, cobrindo o mesmo caso que checar
    // `event.detail` cobriria). `event.detail` NÃO é usado aqui
    // deliberadamente — achado real no navegador: o clique que chega
    // neste listener não é o evento original do usuário, é um evento
    // SINTETIZADO pelo próprio MathLive pra notificar listeners externos
    // (confirmado: o clique original, despachado fundo no shadow DOM com
    // `detail:1`, nunca chega aqui — o que chega é outro `click`,
    // composed, disparado pelo MathLive diretamente no host, sempre com
    // `detail:0`) — checar `=== 1` bloquearia SEMPRE, nunca deixando o
    // reparo acontecer.
    function handleFieldClick(event: MouseEvent) {
      if (!field.selectionIsCollapsed) return;
      const best = computeBestOffset(field, event.clientX, event.clientY);
      if (best !== null) field.position = best;
    }
    field.addEventListener("click", handleFieldClick);

    // Cenário B — clique no padding do wrapper (fora do retângulo real
    // do `<math-field>`, mas dentro da caixa com borda visível): o
    // wrapper nunca teve nenhum listener — confirmado no navegador real
    // que nada acontecia (nem foco, nem cursor). Um clique aqui nunca
    // atinge nenhum filho do `field` (nenhum cobre esse ponto), então
    // `event.target` chega como o PRÓPRIO wrapper — só nesse caso foca e
    // manda o cursor pro fim do campo via `moveToMathfieldEnd` (comando
    // NATIVO, nunca coordenada).
    function handleContainerClick(event: MouseEvent) {
      if (event.target !== container) return;
      field.focus();
      field.executeCommand("moveToMathfieldEnd");
    }
    container.addEventListener("click", handleContainerClick);

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
      field.removeEventListener("click", handleFieldClick);
      container.removeEventListener("click", handleContainerClick);
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
