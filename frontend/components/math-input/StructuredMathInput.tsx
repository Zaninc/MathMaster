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
 * Hotfix P0 (3ª rodada — nesting de expoente confirmado) — LaTeX EXATO
 * inserido pelas teclas cujo `mathLiveInsert` é um placeholder de
 * SUPERSCRIPT sozinho no fim da string (nunca embutido num template
 * maior, ex. os limites de uma integral definida ou de um somatório, que
 * também usam `^{...}` mas nunca como a string inteira): "xⁿ" (`^{...}`
 * puro) e, desde a Sprint V3.0.3 (Structured Logs & Exponentials), "eˣ"
 * (`\exponentialE^{...}` — mesma assinatura de expoente fresco, só com a
 * base fixa da constante de Euler na frente). Usado como assinatura
 * estrutural pra saber quando um novo expoente "fresco" acabou de ser
 * criado — nunca amarrado a "e" (o caractere digitado DENTRO do
 * expoente) ou a qualquer caractere específico.
 */
const SIMPLE_EXPONENT_PLACEHOLDER_TEMPLATES = new Set(["^{\\placeholder{}}", "\\exponentialE^{\\placeholder{}}"]);

/** Dígito ou ponto decimal — o único conteúdo que continua ACUMULANDO
 * dentro de um expoente "fresco" sem forçar saída (permite `x^23`). */
const CONTINUES_SIMPLE_EXPONENT = /^[0-9.]$/;

/**
 * Hotfix P0 (2ª rodada — dump real do usuário) — abandona a heurística
 * caseira de "ponto-cursor por offset + distância euclidiana"
 * (`cursorPointForOffset`/`computeBestOffset`/`clampedRightEdgeDistanceSquared`,
 * removidas nesta revisão — 2 regressões reais nesta mesma hotfix) em
 * favor da API PÚBLICA e NATIVA do MathLive pra hit-testing:
 * `field.getOffsetFromPoint(x, y)` ("The offset closest to the location
 * (x,y) in viewport coordinate" — `mathlive/types/mathfield-element.d.ts`).
 * Ticket pediu explicitamente "investigar se existe API do MathLive pra
 * coordenada→posição, em vez de confiar só no comportamento interno do
 * clique" — investigação (`getOffsetFromPoint` chamada diretamente, fora
 * do handler automático do MathLive) confirmou que ela é MUITO mais
 * confiável que deixar o clique cru resolver sozinho (esse sim confirmado
 * errático num round anterior desta mesma sessão: mesmo campo `x^2`,
 * pontos a poucos pixels um do outro, resultado ora certo ora não).
 *
 * MAS: `getOffsetFromPoint` sozinha ainda devolve o último átomo REAL
 * (com `bounds` própria) mais próximo — nunca o marcador de SAÍDA de um
 * grupo (`bounds` indefinida, ex. offset logo depois de "x²" que
 * representa "nível pai, depois da potência inteira"), porque esse
 * marcador não tem hitbox própria pra competir. Confirmado no navegador
 * real: em `x^2+3`, clicar no ESPAÇO VAZIO entre o "2" (bounds terminam
 * em x≈70) e o "+" (começa em x≈76) — ex. x=72 — `getOffsetFromPoint`
 * devolve o offset do PRÓPRIO "2" (dentro do expoente), não o offset
 * seguinte (nível pai, depois da potência) que é visualmente idêntico
 * mas semanticamente o que o usuário quer ao clicar à direita de uma
 * estrutura já fechada. `preferGroupExitBeyondContent` (abaixo) cobre
 * exatamente essa lacuna, de forma estrutural (nunca um offset fixo):
 * só quando o clique cai VISUALMENTE à direita da bounding box própria
 * do átomo que a API devolveu, E o offset seguinte é um marcador de
 * saída (sem bounds própria) de profundidade MENOR (nível pai) — nunca
 * se o clique ainda está dentro da bounding box do átomo (cobre "clique
 * sobre o expoente"/"dentro do expoente" do item 5 do ticket) e nunca se
 * o próximo offset não for genuinamente uma saída de grupo mais rasa.
 * Cobre potência/fração/raiz/argumento de função/integral/limite/matriz
 * igualmente, já que a checagem é só depth+bounds, nunca amarrada a um
 * tipo de estrutura específico.
 */
function preferGroupExitBeyondContent(field: MathfieldElement, offset: number, x: number): number {
  const info = field.getElementInfo(offset);
  const bounds = info?.bounds;
  // Sem bounds própria (já é um marcador, ex. começo de célula vazia) ou
  // o clique ainda cai dentro/antes da própria bounding box do átomo —
  // nada a corrigir, a resposta da API já é a correta.
  if (!bounds || bounds.width < 0 || x <= bounds.x + bounds.width) return offset;
  const next = offset + 1;
  if (next > field.lastOffset) return offset;
  const nextInfo = field.getElementInfo(next);
  const nextDepth = nextInfo?.depth ?? 0;
  const currentDepth = info?.depth ?? 0;
  if (nextInfo && !nextInfo.bounds && nextDepth < currentDepth) {
    return next;
  }
  return offset;
}

function resolveClickOffset(field: MathfieldElement, x: number, y: number): number | null {
  const offset = field.getOffsetFromPoint(x, y);
  if (typeof offset !== "number" || !Number.isFinite(offset) || offset < 0 || offset > field.lastOffset) {
    return null;
  }
  return preferGroupExitBeyondContent(field, offset, x);
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

    // Hotfix P0 (3ª/4ª rodada — nesting de expoente confirmado no
    // navegador real, achado 2 confirmado ao testar "eˣ"): 3 estados, não
    // um booleano — "empty" (placeholder recém-criado pela tecla "xⁿ"/
    // "eˣ", NENHUM caractere digitado ainda), "digits" (só dígitos/ponto
    // digitados até agora), "off" (qualquer outra coisa: expirou). Achado
    // real (Sprint V3.0.3): a versão booleana original SÓ soltava a
    // primeira letra digitada — inaceitável pra "eˣ", cujo expoente
    // TIPICAMENTE começa com uma letra ("x" de eˣ), nunca um dígito;
    // clicar "eˣ" e digitar "x" imediatamente disparava a saída ANTES do
    // "x" ser inserido, deixando "x" cair FORA do expoente
    // (`\exponentialE^{}x` em vez de `\exponentialE^{x}`) — confirmado no
    // navegador real. A regra corrigida: o PRIMEIRO caractere digitado
    // (dígito OU letra) SEMPRE insere normalmente dentro do placeholder
    // fresco, nunca aciona saída — só a partir do SEGUNDO caractere em
    // diante, se o placeholder só tinha dígitos até agora ("digits") e o
    // novo caractere NÃO é dígito, a saída é acionada (ver `handleKeyDown`
    // abaixo). Qualquer clique (`handleFieldClick`) ou tecla de
    // controle/navegação (Backspace, setas, Tab...) desliga pra "off" sem
    // forçar saída.
    let freshExponentPlaceholder: "off" | "empty" | "digits" = "off";

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
      // Hotfix P0 (3ª/4ª rodada — nesting de expoente confirmado no
      // navegador real): complementa o `smartSuperscript` do MathLive
      // (que só cobre DÍGITO sozinho — confirmado lendo o código-fonte
      // da própria biblioteca, `atom.parentBranch === "superscript" &&
      // /\d/.test(c)` — nunca letras) sem tocar em `node_modules`. Regra
      // 100% estrutural (nunca amarrada a "e" ou a qualquer caractere
      // específico): enquanto `freshExponentPlaceholder` for "empty" ou
      // "digits" (só liga em `api.insert()` quando o LaTeX inserido é
      // EXATAMENTE um dos templates de "xⁿ"/"eˣ" —
      // `SIMPLE_EXPONENT_PLACEHOLDER_TEMPLATES` — nunca fração/raiz/
      // integral/matriz/log, cujos templates nunca batem essas strings
      // exatas):
      //
      //   - "empty" (placeholder ainda vazio, NENHUM caractere digitado
      //     ainda): o PRIMEIRO caractere — dígito OU letra — SEMPRE
      //     insere normalmente, NUNCA aciona saída. Achado real (Sprint
      //     V3.0.3, "eˣ"): a versão anterior (booleana) disparava a saída
      //     já no primeiro caractere, porque nunca distinguia "placeholder
      //     ainda vazio" de "placeholder já preenchido" — inaceitável pra
      //     "eˣ", cujo expoente TIPICAMENTE começa com uma LETRA ("x" de
      //     eˣ), nunca um dígito: clicar "eˣ" e digitar "x" imediatamente
      //     jogava o "x" pra FORA do expoente (`\exponentialE^{}x` em vez
      //     de `\exponentialE^{x}`), confirmado no navegador real. Se o
      //     primeiro caractere for dígito/ponto, transiciona pra
      //     "digits"; senão, pra "off" (uma vez que o conteúdo não é mais
      //     "numérico simples", nenhuma checagem a mais é necessária).
      //   - "digits" (só dígitos/ponto digitados até agora): o PRÓXIMO
      //     caractere, se NÃO for dígito/ponto, aciona `moveToNextChar`
      //     ANTES de deixar o MathLive inserir esse caractere — fazendo
      //     `x²` seguido de "e"/"y"/"+"/"(" etc. produzir
      //     `x²e`/`x²y`/`x²+`/`x²(` (nível pai) em vez de
      //     `x^(2e)`/`x^(2y)`/... (aninhado). Dígito/ponto continua
      //     acumulando, mantém "digits" — preserva `x^23` quando o
      //     usuário genuinamente quer um expoente de vários dígitos.
      //
      // Desligamento sem forçar saída: qualquer tecla de
      // controle/navegação (Backspace, Delete, setas, Escape,
      // Shift/Ctrl/Alt/Meta sozinhas, Tab, Enter, Espaço) só desliga pra
      // "off" — nunca chama `moveToNextChar` — porque essas são
      // justamente as ações que já representam uma decisão EXPLÍCITA do
      // usuário sobre onde o cursor deve estar (ex. Backspace pra apagar
      // o dígito, seta pra navegar manualmente); forçar uma saída por
      // cima delas seria o mesmo tipo de "correção que atropela a
      // intenção do usuário" que este hotfix inteiro existe pra
      // eliminar. `handleFieldClick` (abaixo) desliga pra "off" do mesmo
      // jeito pro caso de clique manual dentro do expoente — exatamente
      // o "clicar manualmente no expoente e digitar e → x^(2e)" pedido
      // explicitamente: depois de um clique a flag nunca mais liga
      // sozinha, então o próximo caractere fica DENTRO, como esperado.
      if (freshExponentPlaceholder !== "off") {
        // Espaço fica de fora deliberadamente (tratado por completo à
        // parte, mais abaixo, como no-op — Hotfix V3.0.2a): não muda
        // esse comportamento já validado, só desliga pra "off" como
        // qualquer outra tecla de controle.
        const isPlainCharacterKey =
          event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey;
        if (isPlainCharacterKey) {
          if (CONTINUES_SIMPLE_EXPONENT.test(event.key)) {
            freshExponentPlaceholder = "digits";
          } else if (freshExponentPlaceholder === "empty") {
            // Primeiro caractere do placeholder, não-dígito — insere
            // normalmente (nunca força saída no primeiro caractere).
            freshExponentPlaceholder = "off";
          } else {
            // Já tinha dígito(s)/ponto e agora veio um não-dígito — aciona a saída.
            const info = field.getElementInfo(field.position);
            if ((info?.depth ?? 0) > 0) {
              field.executeCommand("moveToNextChar");
            }
            freshExponentPlaceholder = "off";
          }
        } else {
          freshExponentPlaceholder = "off";
        }
      }

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
    // wrappers genéricos do MathLive, não o glifo em si) — e o CLIQUE
    // NATIVO do MathLive (o handler interno automático, dentro do shadow
    // DOM) nesses pontos era realmente ERRÁTICO, não só "impreciso": o
    // mesmo campo `x^2`, clicando em pontos a poucos pixels de distância
    // um do outro, pousava ora certo (offset 4, fim de "x²"), ora dentro
    // do expoente (offset 3), ora até no INÍCIO do campo inteiro (offset
    // 0) — confirmado com clique genuíno despachado (`PointerEvent`/
    // `MouseEvent` reais). Um gate por classe CSS nunca capturaria esse
    // caso (a classe está lá, só não é o glifo certo).
    //
    // Hotfix P0 (2ª rodada — dump real do usuário) — a correção anterior
    // (`computeBestOffset`, uma heurística própria de "offset mais
    // próximo por distância euclidiana" sobre `getElementInfo`/`bounds`)
    // sofreu 2 regressões reais nesta mesma hotfix e um dump capturado no
    // navegador real do próprio usuário confirmou uma 3ª: clicar à
    // direita de "x²" (dentro de `\int x^2e^2\,dx`) resolvia pro offset 2
    // (`latex:"x"`, o NÓ BASE — antes até de entrar no expoente), não pro
    // offset de saída da potência. Investigação (ver `resolveClickOffset`
    // acima) confirmou que `field.getOffsetFromPoint(x, y)` — a API
    // PÚBLICA do MathLive pra essa pergunta exata, chamada diretamente —
    // resolve esse caso e o de fração/matriz corretamente, sem nenhuma
    // heurística própria: é a implementação REAL de hit-test da árvore de
    // átomos, a mesma coisa que o handler interno automático do MathLive
    // deveria estar usando mas aparentemente não usa de forma consistente
    // (daí a diferença entre "clique cru, deixado pro MathLive resolver
    // sozinho" — ERRÁTICO, ver acima — e "clique interceptado aqui,
    // resolvido chamando a API pública explicitamente" — confiável nos
    // casos testados). Substitui `computeBestOffset` por completo — nunca
    // mais um offset fixo ou heurística específica de um tipo de
    // estrutura (potência/fração/etc.), a mesma chamada cobre todas.
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
      // Hotfix P0 (3ª rodada) — qualquer clique desliga
      // `freshExponentPlaceholder`, mesmo que resolva pra dentro do
      // MESMO expoente recém-criado: um clique é sempre uma decisão
      // EXPLÍCITA do usuário sobre onde o cursor deve ficar — exatamente
      // o "clicar manualmente no expoente e digitar e → x^(2e)" pedido
      // explicitamente. Desligado incondicionalmente, mesmo na saída
      // antecipada da seleção em andamento logo abaixo.
      freshExponentPlaceholder = "off";
      if (!field.selectionIsCollapsed) return;
      const resolved = resolveClickOffset(field, event.clientX, event.clientY);
      if (resolved !== null) field.position = resolved;
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
        // Hotfix P0 (3ª rodada) — liga `freshExponentPlaceholder` SÓ
        // quando o LaTeX inserido é EXATAMENTE o template da tecla "xⁿ"
        // ou "eˣ" (um expoente placeholder fresco, sozinho) — qualquer
        // outra tecla (fração, raiz, integral, matriz, log, parênteses,
        // x²/x³ com expoente FIXO, etc.) desliga, cobrindo o caso de
        // clicar outra tecla entre "xⁿ"/"eˣ" e o próximo caractere
        // digitado.
        freshExponentPlaceholder = SIMPLE_EXPONENT_PLACEHOLDER_TEMPLATES.has(latex) ? "empty" : "off";
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
