export interface KeyboardKey {
  /** Texto exibido no botão. */
  label: string;
  /** Texto inserido na posição do cursor. */
  insert: string;
  /** Deslocamento do cursor a partir do início do texto inserido (não do fim) — permite posicionar dentro de parênteses/templates. */
  cursorOffset: number;
  /** Rótulo acessível quando o glifo do botão não é autoexplicativo para leitor de tela. */
  ariaLabel?: string;
}

export interface KeyboardCategory {
  id: string;
  label: string;
  keys: KeyboardKey[];
}

/**
 * Toda entrada aqui gera texto na MESMA sintaxe que o backend já aceita
 * (Unicode nativo via Sprint Parser/Sprint 12.1, ou sintaxe técnica de
 * geometria/cálculo) — nenhuma tradução acontece depois, o texto inserido
 * é literalmente o que vai para `apiClient.solve()`. Todas as strings
 * abaixo foram validadas manualmente contra o backend real antes desta
 * etapa ser considerada pronta (mesma disciplina da Etapa 1).
 */
export const KEYBOARD_CATEGORIES: KeyboardCategory[] = [
  {
    id: "basico",
    label: "Básico",
    keys: [
      { label: "( )", insert: "()", cursorOffset: 1, ariaLabel: "Inserir parênteses" },
      { label: "x²", insert: "²", cursorOffset: 1, ariaLabel: "Inserir expoente 2" },
      { label: "x³", insert: "³", cursorOffset: 1, ariaLabel: "Inserir expoente 3" },
      { label: "xⁿ", insert: "**", cursorOffset: 2, ariaLabel: "Inserir potência" },
      { label: "a/b", insert: "()/()", cursorOffset: 1, ariaLabel: "Inserir fração" },
      { label: "√", insert: "√()", cursorOffset: 2, ariaLabel: "Inserir raiz quadrada" },
      { label: "∛", insert: "∛()", cursorOffset: 2, ariaLabel: "Inserir raiz cúbica" },
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
      { label: "log", insert: "log()", cursorOffset: 4, ariaLabel: "Inserir logaritmo de base 10" },
      { label: "ln", insert: "ln()", cursorOffset: 3, ariaLabel: "Inserir logaritmo natural" },
      {
        label: "logₐ",
        insert: "log()/log()",
        cursorOffset: 4,
        ariaLabel: "Inserir logaritmo de base arbitrária (mudança de base: log do argumento dividido por log da base)",
      },
      { label: "eˣ", insert: "exp()", cursorOffset: 4, ariaLabel: "Inserir exponencial de base e" },
    ],
  },
  {
    id: "trigonometria",
    label: "Trigonometria",
    keys: [
      { label: "sen", insert: "sen()", cursorOffset: 4, ariaLabel: "Inserir seno" },
      { label: "cos", insert: "cos()", cursorOffset: 4, ariaLabel: "Inserir cosseno" },
      { label: "tg", insert: "tg()", cursorOffset: 3, ariaLabel: "Inserir tangente" },
      { label: "π", insert: "π", cursorOffset: 1, ariaLabel: "Inserir pi" },
    ],
  },
  {
    id: "calculo",
    label: "Cálculo",
    keys: [
      { label: "d/dx", insert: "d/dx()", cursorOffset: 5, ariaLabel: "Inserir derivada" },
      { label: "∫ dx", insert: "∫() dx", cursorOffset: 2, ariaLabel: "Inserir integral indefinida" },
      { label: "lim", insert: "lim x→0 ", cursorOffset: 8, ariaLabel: "Inserir limite" },
      { label: "∞", insert: "∞", cursorOffset: 1, ariaLabel: "Inserir infinito" },
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
      { label: "π", insert: "π", cursorOffset: 1, ariaLabel: "Inserir pi" },
      { label: "e", insert: "e", cursorOffset: 1, ariaLabel: "Inserir número de Euler" },
      { label: "∞", insert: "∞", cursorOffset: 1, ariaLabel: "Inserir infinito" },
      { label: "→", insert: "→", cursorOffset: 1, ariaLabel: "Inserir seta (usada em limites)" },
      { label: "≤", insert: "≤", cursorOffset: 1, ariaLabel: "Inserir menor ou igual" },
      { label: "≥", insert: "≥", cursorOffset: 1, ariaLabel: "Inserir maior ou igual" },
      { label: "≠", insert: "≠", cursorOffset: 1, ariaLabel: "Inserir diferente" },
      { label: "∫", insert: "∫", cursorOffset: 1, ariaLabel: "Inserir integral" },
    ],
  },
];
