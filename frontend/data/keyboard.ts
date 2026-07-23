export interface KeyboardKey {
  /** Texto exibido no botão (fallback quando não há `latex`). */
  label: string;
  /** Texto inserido na posição do cursor. */
  insert: string;
  /** Deslocamento do cursor a partir do início do texto inserido (não do fim) — permite posicionar dentro de parênteses/templates. */
  cursorOffset: number;
  /** Rótulo acessível quando o glifo do botão não é autoexplicativo para leitor de tela. */
  ariaLabel?: string;
  /**
   * Rótulo visual em LaTeX (renderizado via `MathFormula`) — APRESENTAÇÃO
   * apenas: `insert` continua sendo a única string que entra no input.
   * Toda tecla com `latex` DEVE ter `ariaLabel` (o KaTeX visual fica
   * `aria-hidden`; o nome acessível vem do botão) — invariante garantido
   * por teste. Só usado onde há ganho tipográfico real (frações,
   * raízes, expoentes); glifo/texto simples fica sem.
   */
  latex?: string;
  /**
   * Comportamento alternativo quando há texto SELECIONADO no input: a
   * seleção é preservada e envolvida (`before` + seleção + `after` — ex.
   * uma tecla de raiz poderia envolver "x" selecionado em "√(x)"), com o
   * cursor posicionado a `cursorFromEnd` caracteres do fim do texto
   * inserido. Sem este campo, a seleção é substituída por `insert`
   * (comportamento padrão de qualquer input de texto) — nenhuma tecla usa
   * este campo hoje (xⁿ usava, removido para ficar igual a x²/x³), mas a
   * capacidade continua disponível para uma tecla futura que precise.
   */
  selection?: { before: string; after: string; cursorFromEnd: number };
}

export interface KeyboardCategory {
  id: string;
  label: string;
  keys: KeyboardKey[];
}

/**
 * Regra central: o usuário enxerga no campo praticamente o mesmo símbolo
 * que clicou. Quase toda tecla gera texto na MESMA sintaxe que o backend
 * já aceita (Unicode nativo via Sprint Parser/Sprint 12.1, ou sintaxe
 * técnica de geometria/cálculo). As DUAS únicas exceções são os
 * marcadores visuais "ⁿ" (xⁿ) e "eˣ(" (exponencial), não digitáveis em
 * teclado físico, traduzidos para "**n"/"exp(" por
 * `lib/math/backend-normalize.ts` exclusivamente na fronteira de envio
 * (`apiClient.solve()`). Todas as strings abaixo foram validadas contra o
 * backend real (mesma disciplina da Etapa 1).
 */
export const KEYBOARD_CATEGORIES: KeyboardCategory[] = [
  {
    id: "basico",
    label: "Básico",
    keys: [
      { label: "( )", insert: "()", cursorOffset: 1, ariaLabel: "Inserir parênteses" },
      { label: "x²", insert: "²", cursorOffset: 1, ariaLabel: "Inserir expoente 2", latex: "x^2" },
      { label: "x³", insert: "³", cursorOffset: 1, ariaLabel: "Inserir expoente 3", latex: "x^3" },
      {
        // Mesmo padrão VISUAL de x²/x³: insere só o expoente na posição do
        // cursor, sem parênteses automáticos e sem envolver seleção — o
        // campo mostra o glifo sobrescrito "ⁿ" (U+207F, não digitável em
        // teclado físico) diretamente, igual a "²"/"³". Só na fronteira de
        // envio (`normalizeForBackend`) "ⁿ" vira "**n"; internamente
        // continua sendo tratado como potência normalmente.
        label: "xⁿ",
        insert: "ⁿ",
        cursorOffset: 1,
        ariaLabel: "Inserir expoente n",
        latex: "x^n",
      },
      { label: "a/b", insert: "()/()", cursorOffset: 1, ariaLabel: "Inserir fração", latex: "\\dfrac{a}{b}" },
      // Raízes em Unicode visual — o usuário enxerga no campo o mesmo
      // símbolo do botão. O backend aceita √()/∛() NATIVAMENTE (Sprint
      // Parser dele; validado em 2026-07-18: √(9)->3, ∛(8)->2), então
      // não há normalização no envio — reescrever aqui duplicaria o
      // parser do backend.
      { label: "√", insert: "√()", cursorOffset: 2, ariaLabel: "Inserir raiz quadrada", latex: "\\sqrt{x}" },
      { label: "∛", insert: "∛()", cursorOffset: 2, ariaLabel: "Inserir raiz cúbica", latex: "\\sqrt[3]{x}" },
      { label: "=", insert: "=", cursorOffset: 1, ariaLabel: "Inserir igual" },
    ],
  },
  {
    id: "algebra",
    label: "Álgebra",
    keys: [
      { label: "x", insert: "x", cursorOffset: 1 },
      { label: "y", insert: "y", cursorOffset: 1 },
      { label: "≤", insert: "≤", cursorOffset: 1, ariaLabel: "Inserir menor ou igual" },
      { label: "≥", insert: "≥", cursorOffset: 1, ariaLabel: "Inserir maior ou igual" },
      { label: "≠", insert: "≠", cursorOffset: 1, ariaLabel: "Inserir diferente" },
    ],
  },
  {
    id: "funcoes",
    label: "Funções",
    // Convenção oficial do backend (log_convention.py): log = base 10,
    // ln = natural. Base arbitrária NÃO tem sintaxe própria (log(x, a) é
    // rejeitado) — "logₐ" insere o template de mudança de base
    // log(x)/log(a), matematicamente equivalente e aceito nativamente.
    // "eˣ" insere exp(): "e" solto é tratado como VARIÁVEL pelo backend
    // (e**x não é exponencial), confirmado empiricamente em 2026-07-18.
    // Os rótulos usam Unicode tipográfico (ₐ/ˣ) só no visual do botão; o
    // texto inserido é sempre ASCII que o parser aceita.
    keys: [
      { label: "f(x) =", insert: "f(x) = ", cursorOffset: 7, ariaLabel: "Inserir definição de função" },
      { label: "f( )", insert: "f()", cursorOffset: 2, ariaLabel: "Inserir avaliação de função" },
      { label: "log", insert: "log()", cursorOffset: 4, ariaLabel: "Inserir logaritmo de base 10", latex: "\\log" },
      { label: "ln", insert: "ln()", cursorOffset: 3, ariaLabel: "Inserir logaritmo natural", latex: "\\ln" },
      {
        label: "logₐ",
        insert: "log()/log()",
        cursorOffset: 4,
        ariaLabel: "Inserir logaritmo de base arbitrária (mudança de base: log do argumento dividido por log da base)",
        latex: "\\log_a",
      },
      {
        label: "eˣ",
        // Template visual oficial: "eˣ(" é um token único (ˣ = U+02E3,
        // não digitável) e o parêntese é o slot do expoente —
        // `normalizeForBackend` traduz "eˣ(" -> "exp(" só no envio.
        insert: "eˣ()",
        cursorOffset: 3,
        ariaLabel: "Inserir exponencial de base e",
        latex: "e^x",
      },
    ],
  },
  {
    id: "trigonometria",
    label: "Trigonometria",
    keys: [
      { label: "sen", insert: "sen()", cursorOffset: 4, ariaLabel: "Inserir seno" },
      { label: "cos", insert: "cos()", cursorOffset: 4, ariaLabel: "Inserir cosseno" },
      { label: "tg", insert: "tg()", cursorOffset: 3, ariaLabel: "Inserir tangente" },
      { label: "π", insert: "π", cursorOffset: 1, ariaLabel: "Inserir pi", latex: "\\pi" },
    ],
  },
  {
    id: "calculo",
    label: "Cálculo",
    keys: [
      { label: "d/dx", insert: "d/dx()", cursorOffset: 5, ariaLabel: "Inserir derivada", latex: "\\dfrac{d}{dx}" },
      { label: "∫ dx", insert: "∫() dx", cursorOffset: 2, ariaLabel: "Inserir integral indefinida", latex: "\\int dx" },
      { label: "lim", insert: "lim x→0 ", cursorOffset: 8, ariaLabel: "Inserir limite", latex: "\\lim" },
      { label: "∞", insert: "∞", cursorOffset: 1, ariaLabel: "Inserir infinito", latex: "\\infty" },
    ],
  },
  {
    id: "geometria",
    label: "Geometria",
    keys: [
      {
        label: "circunferência",
        insert: "circunferencia((), )",
        cursorOffset: 16,
        ariaLabel: "Inserir circunferência",
      },
      { label: "reta", insert: "reta((), ())", cursorOffset: 6, ariaLabel: "Inserir reta por dois pontos" },
      {
        label: "distância",
        insert: "distancia((), ())",
        cursorOffset: 11,
        ariaLabel: "Inserir distância entre pontos",
      },
      {
        label: "ponto médio",
        insert: "ponto_medio((), ())",
        cursorOffset: 13,
        ariaLabel: "Inserir ponto médio",
      },
    ],
  },
  {
    id: "simbolos",
    label: "Símbolos",
    keys: [
      { label: "π", insert: "π", cursorOffset: 1, ariaLabel: "Inserir pi", latex: "\\pi" },
      { label: "e", insert: "e", cursorOffset: 1, ariaLabel: "Inserir número de Euler" },
      { label: "∞", insert: "∞", cursorOffset: 1, ariaLabel: "Inserir infinito", latex: "\\infty" },
      { label: "→", insert: "→", cursorOffset: 1, ariaLabel: "Inserir seta (usada em limites)" },
      { label: "≤", insert: "≤", cursorOffset: 1, ariaLabel: "Inserir menor ou igual" },
      { label: "≥", insert: "≥", cursorOffset: 1, ariaLabel: "Inserir maior ou igual" },
      { label: "≠", insert: "≠", cursorOffset: 1, ariaLabel: "Inserir diferente" },
      { label: "∫", insert: "∫", cursorOffset: 1, ariaLabel: "Inserir integral", latex: "\\int" },
      {
        // Sprint V2.1 — sintaxe principal do somatório (Σ(var=inf..sup)
        // expr). Insere um exemplo completo e válido (não um template vazio
        // com parênteses, diferente de d/dx()/∫() dx): os limites/variável
        // já preenchidos são o ponto de partida mais rápido para editar,
        // mesmo raciocínio do resto do teclado ("o usuário enxerga no campo
        // praticamente o mesmo símbolo que clicou").
        label: "Σ",
        insert: "Σ(i=1..10) i",
        cursorOffset: "Σ(i=1..10) i".length,
        ariaLabel: "Inserir somatório",
        latex: "\\sum_{i=1}^{n}",
      },
    ],
  },
];
