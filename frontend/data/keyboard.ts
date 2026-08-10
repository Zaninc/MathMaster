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
  /**
   * Sprint V3.0 (Structured Math Input) — comando LaTeX inserido via a API
   * real do `StructuredMathInput`/MathLive (`insert()`) quando o campo
   * estruturado está ativo, em vez de `insert`/`cursorOffset`/`selection`
   * (que continuam servindo o `<textarea>` legado, mantido intocado).
   * Slots editáveis usam `\placeholder{}` — o MathLive posiciona o cursor
   * no primeiro automaticamente. Só as teclas migradas nesta sprint (a
   * categoria `basico`) têm este campo; as demais ficam para V3.0.x.
   */
  mathLiveInsert?: string;
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
      {
        label: "( )",
        insert: "()",
        cursorOffset: 1,
        ariaLabel: "Inserir parênteses",
        mathLiveInsert: "\\left(\\placeholder{}\\right)",
      },
      {
        label: "x²",
        insert: "²",
        cursorOffset: 1,
        ariaLabel: "Inserir expoente 2",
        latex: "x^2",
        mathLiveInsert: "^{2}",
      },
      {
        label: "x³",
        insert: "³",
        cursorOffset: 1,
        ariaLabel: "Inserir expoente 3",
        latex: "x^3",
        mathLiveInsert: "^{3}",
      },
      {
        // Mesmo padrão VISUAL de x²/x³: insere só o expoente na posição do
        // cursor, sem parênteses automáticos e sem envolver seleção — o
        // campo mostra o glifo sobrescrito "ⁿ" (U+207F, não digitável em
        // teclado físico) diretamente, igual a "²"/"³". Só na fronteira de
        // envio (`normalizeForBackend`) "ⁿ" vira "**n"; internamente
        // continua sendo tratado como potência normalmente.
        //
        // No campo estruturado (`mathLiveInsert`), "n" simbólico vira um
        // slot de expoente REAL e editável (`^{\placeholder{}}`) — o
        // "x^□" genérico do ticket — em vez de um glifo fixo; estritamente
        // mais capaz que o "ⁿ" do textarea legado (que só é editável se o
        // usuário apagar e digitar outro número por cima).
        label: "xⁿ",
        insert: "ⁿ",
        cursorOffset: 1,
        ariaLabel: "Inserir expoente n",
        latex: "x^n",
        mathLiveInsert: "^{\\placeholder{}}",
      },
      {
        label: "a/b",
        insert: "()/()",
        cursorOffset: 1,
        ariaLabel: "Inserir fração",
        latex: "\\dfrac{a}{b}",
        mathLiveInsert: "\\frac{\\placeholder{}}{\\placeholder{}}",
      },
      // Raízes em Unicode visual — o usuário enxerga no campo o mesmo
      // símbolo do botão. O backend aceita √()/∛() NATIVAMENTE (Sprint
      // Parser dele; validado em 2026-07-18: √(9)->3, ∛(8)->2), então
      // não há normalização no envio — reescrever aqui duplicaria o
      // parser do backend.
      {
        label: "√",
        insert: "√()",
        cursorOffset: 2,
        ariaLabel: "Inserir raiz quadrada",
        latex: "\\sqrt{x}",
        mathLiveInsert: "\\sqrt{\\placeholder{}}",
      },
      {
        label: "∛",
        insert: "∛()",
        cursorOffset: 2,
        ariaLabel: "Inserir raiz cúbica",
        latex: "\\sqrt[3]{x}",
        mathLiveInsert: "\\sqrt[3]{\\placeholder{}}",
      },
      {
        // Nova nesta sprint — não existia no teclado do `<textarea>` legado
        // (que só tinha √/∛ fixos). Índice E radicando são slots
        // independentes; o MathLive posiciona o cursor no índice primeiro
        // (primeiro `\placeholder{}` da string, lido da esquerda pra
        // direita), pronto para o usuário digitar "4", "5" etc.
        label: "ⁿ√",
        // `insert`/`cursorOffset` (fallback do `<textarea>` legado) não tem
        // representação Unicode nativa pra raiz n-ésima genérica (só √/∛
        // são glifos aceitos pelo backend) — abre parênteses vazios como
        // ponto de partida razoável; na prática esta tecla só é exibida na
        // Calculadora, que usa exclusivamente `mathLiveInsert` agora.
        insert: "()",
        cursorOffset: 1,
        ariaLabel: "Inserir raiz n-ésima",
        latex: "\\sqrt[n]{x}",
        mathLiveInsert: "\\sqrt[\\placeholder{}]{\\placeholder{}}",
      },
      { label: "=", insert: "=", cursorOffset: 1, ariaLabel: "Inserir igual", mathLiveInsert: "=" },
      {
        // π já existe nas categorias Trigonometria/Símbolos (fora de
        // escopo nesta sprint, ocultas na Calculadora — ver
        // `MathKeyboard.tsx`); duplicada aqui porque o ticket pede π como
        // uma das 9 teclas básicas migradas, e o teclado desta página
        // mostra só a categoria `basico` por enquanto.
        label: "π",
        insert: "π",
        cursorOffset: 1,
        ariaLabel: "Inserir pi",
        latex: "\\pi",
        mathLiveInsert: "\\pi",
      },
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
      {
        // Sprint V2.2 (Motor de Matrizes) — insere o template de uma matriz
        // 2x2 vazia; cursorOffset=2 posiciona o cursor logo depois de "[[",
        // no primeiro elemento (mesma lógica de "a/b": cursor dentro do
        // primeiro slot vazio, nunca depois do template inteiro).
        label: "[[ ]]",
        insert: "[[,],[,]]",
        cursorOffset: 2,
        ariaLabel: "Inserir matriz 2x2",
        latex: "\\begin{bmatrix}\\square&\\square\\\\\\square&\\square\\end{bmatrix}",
      },
      // Fechamento da Sprint de Matrizes — det/inv/transpose já existiam no
      // backend e na Calculadora (Explorar), só faltavam no teclado. Label
      // visual usa a notação elegante (\det(A), A^{-1}, A^{T}), mas o texto
      // inserido é sempre a sintaxe de função que o parser aceita
      // (det()/inv()/transpose()) — "^-1"/"^T" NÃO são sintaxe suportada.
      {
        label: "det(A)",
        insert: "det()",
        cursorOffset: 4,
        ariaLabel: "Inserir determinante",
        latex: "\\det(A)",
      },
      {
        label: "A⁻¹",
        insert: "inv()",
        cursorOffset: 4,
        ariaLabel: "Inserir inversa",
        latex: "A^{-1}",
      },
      {
        label: "Aᵀ",
        insert: "transpose()",
        cursorOffset: 10,
        ariaLabel: "Inserir transposta",
        latex: "A^{T}",
      },
      {
        // Sprint V2.4 (Sistemas Lineares) — o backend já suporta sistemas
        // multi-linha nativamente (`equations/dispatcher.py` detecta "\n"/
        // ";" como separador de equação); o textarea multilinha da
        // Calculadora já lida com "\n" sem nenhuma mudança — só faltava a
        // tecla. Mesmo padrão da tecla Σ (Símbolos): insere um EXEMPLO
        // completo e válido (não um template vazio com parênteses),
        // cursorOffset no fim do texto para o usuário seguir editando os
        // números a partir dali.
        label: "Sistema linear",
        insert: "x+y=5\nx-y=1",
        cursorOffset: "x+y=5\nx-y=1".length,
        ariaLabel: "Inserir sistema linear de exemplo",
        latex: "\\begin{cases}x+y=5\\\\x-y=1\\end{cases}",
      },
      // Sprint V2.6 (Motor de Polinômios Avançados) — mesmo padrão de
      // det(A)/A⁻¹/Aᵀ acima: o rótulo/LaTeX mostra um placeholder ("x", ou
      // "a, b" para divisão) para deixar clara a operação, mas o texto
      // INSERIDO é sempre o template com parênteses vazios (cursor
      // posicionado dentro) — nunca o placeholder literal. `insert` usa
      // sempre a forma ASCII ("raizes"/"divisao", nunca "raízes"/"divisão")
      // porque é a única que sobrevive ao Tier 1 do pipeline de LaTeX do
      // preview (`lib/math/to-latex.ts` — a forma acentuada cai fora de
      // `SAFE_CHARSET`, mesmo motivo documentado ali); o backend aceita as
      // duas grafias igualmente.
      {
        label: "fatorar(x)",
        insert: "fatorar()",
        cursorOffset: "fatorar(".length,
        ariaLabel: "Inserir fatoração de polinômio",
        latex: "\\operatorname{fatorar}(x)",
      },
      {
        label: "expandir(x)",
        insert: "expandir()",
        cursorOffset: "expandir(".length,
        ariaLabel: "Inserir expansão de polinômio",
        latex: "\\operatorname{expandir}(x)",
      },
      {
        label: "simplificar(x)",
        insert: "simplificar()",
        cursorOffset: "simplificar(".length,
        ariaLabel: "Inserir simplificação de expressão racional",
        latex: "\\operatorname{simplificar}(x)",
      },
      {
        label: "grau(x)",
        insert: "grau()",
        cursorOffset: "grau(".length,
        ariaLabel: "Inserir grau de um polinômio",
        latex: "\\operatorname{grau}(x)",
      },
      {
        label: "raízes(x)",
        insert: "raizes()",
        cursorOffset: "raizes(".length,
        ariaLabel: "Inserir raízes de um polinômio",
        latex: "\\operatorname{raízes}(x)",
      },
      {
        label: "coeficientes(x)",
        insert: "coeficientes()",
        cursorOffset: "coeficientes(".length,
        ariaLabel: "Inserir coeficientes de um polinômio",
        latex: "\\operatorname{coeficientes}(x)",
      },
      {
        label: "divisão(a,b)",
        insert: "divisao(,)",
        cursorOffset: "divisao(".length,
        ariaLabel: "Inserir divisão de polinômios",
        latex: "\\operatorname{divisão}(a,\\,b)",
      },
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
    // Sprint V3.0.1 (Structured Calculus Input) — as 4 primeiras teclas
    // ganharam `mathLiveInsert` (estruturas reais do MathLive, com
    // `\placeholder{}` nos slots editáveis) e a categoria volta a
    // aparecer na Calculadora, ao lado de Básico. A variável ("x" em
    // "d/dx"/"lim") é texto literal, não um `\placeholder` — clicável e
    // editável diretamente (o adapter reconhece qualquer letra ali, ex.
    // "d/dy"), mas não ganha destaque de Tab: o fluxo mais comum (clicar
    // a tecla e já digitar a EXPRESSÃO) fica com o cursor pronto na
    // primeira tentativa, sem precisar Tab através da variável primeiro
    // (ver relatório da sprint — decisão de UX documentada). "∫ₐᵇ dx"
    // (integral definida) e "Σ" (somatório) são NOVAS nesta categoria —
    // "Σ" já existia isolada em Símbolos (categoria ainda oculta),
    // duplicada aqui com slots estruturados de verdade, mesmo padrão do
    // "π" duplicado em Básico na V3.0.
    id: "calculo",
    label: "Cálculo",
    keys: [
      {
        label: "d/dx",
        insert: "d/dx()",
        cursorOffset: 5,
        ariaLabel: "Inserir derivada",
        latex: "\\dfrac{d}{dx}",
        mathLiveInsert: "\\frac{d}{dx}\\left(\\placeholder{}\\right)",
      },
      {
        label: "∫ dx",
        insert: "∫() dx",
        cursorOffset: 2,
        ariaLabel: "Inserir integral indefinida",
        latex: "\\int dx",
        mathLiveInsert: "\\int \\placeholder{}\\,dx",
      },
      {
        // Nova nesta sprint — não existia no teclado legado (só a
        // indefinida). Ordem dos slots: inferior -> superior -> integrando
        // (pedida explicitamente pelo ticket) — cai naturalmente da ordem
        // dos `\placeholder{}` no LaTeX, o MathLive navega nessa ordem
        // sozinho via Tab/seleção do primeiro slot.
        label: "∫ₐᵇ dx",
        insert: "∫() dx",
        cursorOffset: 2,
        ariaLabel: "Inserir integral definida",
        latex: "\\int_a^b dx",
        mathLiveInsert: "\\int_{\\placeholder{}}^{\\placeholder{}}\\placeholder{}\\,dx",
      },
      {
        label: "lim",
        insert: "lim x→0 ",
        cursorOffset: 8,
        ariaLabel: "Inserir limite",
        latex: "\\lim",
        mathLiveInsert: "\\lim_{x\\to\\placeholder{}}\\placeholder{}",
      },
      {
        // Nova nesta sprint (categoria Cálculo) — a versão de Símbolos
        // (categoria ainda oculta) continua intocada. Índice É um
        // `\placeholder` pré-preenchido com "i" (diferente da variável de
        // derivada/limite): trocar o índice (ex. para "k") é um caso de
        // uso real e testado (`Σ k=1..5 k`), então vale o Tab dedicado.
        label: "Σ",
        insert: "Σ(i=1..10) i",
        cursorOffset: "Σ(i=1..10) i".length,
        ariaLabel: "Inserir somatório",
        latex: "\\sum_{i=1}^{n}",
        mathLiveInsert: "\\sum_{\\placeholder{i}=\\placeholder{}}^{\\placeholder{}}\\placeholder{}",
      },
      {
        label: "∞",
        insert: "∞",
        cursorOffset: 1,
        ariaLabel: "Inserir infinito",
        latex: "\\infty",
        mathLiveInsert: "\\infty",
      },
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
    // Sprint V2.7 (Motor de Combinatória) — aba própria (a de Álgebra já
    // tem 16 teclas). Mesmo contrato das teclas de polinômios da V2.6: o
    // rótulo/LaTeX mostra a notação de livro didático (C_{n,k}, A_{n,k},
    // P_n, n!) só como apresentação; o texto INSERIDO é sempre o template
    // ASCII com parênteses vazios e cursor posicionado dentro — a forma
    // acentuada ("combinação"/"permutação") continua aceita pelo backend
    // se digitada à mão, mas o teclado nunca a insere (mesmo motivo de
    // "raizes"/"divisao": só a forma ASCII sobrevive ao Tier 1 do preview,
    // ver `lib/math/to-latex.ts`).
    id: "combinatoria",
    label: "Combinatória",
    keys: [
      {
        label: "n!",
        insert: "fatorial()",
        cursorOffset: "fatorial(".length,
        ariaLabel: "Inserir fatorial",
        latex: "n!",
      },
      {
        label: "P(n)",
        insert: "permutacao()",
        cursorOffset: "permutacao(".length,
        ariaLabel: "Inserir permutação simples",
        latex: "P_{n}",
      },
      {
        label: "A(n,k)",
        insert: "arranjo(,)",
        cursorOffset: "arranjo(".length,
        ariaLabel: "Inserir arranjo simples",
        latex: "A_{n,k}",
      },
      {
        // Sprint V2.7.1 — label visual em \binom{n}{k} (notação
        // internacional); o texto inserido continua a chamada ASCII que o
        // backend entende, nunca "\binom{}{}".
        label: "C(n,k)",
        insert: "combinacao(,)",
        cursorOffset: "combinacao(".length,
        ariaLabel: "Inserir combinação simples",
        latex: "\\binom{n}{k}",
      },
      {
        label: "P(n; a,b)",
        insert: "permutacao_repeticao(,)",
        cursorOffset: "permutacao_repeticao(".length,
        ariaLabel: "Inserir permutação com repetição",
        latex: "P_{n}^{a,b}",
      },
    ],
  },
  {
    // Sprint V2.8 (Motor de Probabilidade) — mesmo contrato da aba de
    // Combinatória logo acima: o rótulo/LaTeX mostra a notação abstrata
    // (P(A), P(A∪B)...), mas o texto INSERIDO é sempre o template ASCII
    // com parênteses/vírgulas vazios e cursor posicionado logo após "(",
    // pronto para o primeiro argumento.
    id: "probabilidade",
    label: "Probabilidade",
    keys: [
      {
        label: "P(A)",
        insert: "probabilidade(,)",
        cursorOffset: "probabilidade(".length,
        ariaLabel: "Inserir probabilidade clássica",
        latex: "P(A)",
      },
      {
        label: "P(Aᶜ)",
        insert: "complementar()",
        cursorOffset: "complementar(".length,
        ariaLabel: "Inserir complementar",
        latex: "P(A^{c})",
      },
      {
        label: "P(A∪B)",
        insert: "uniao(,,)",
        cursorOffset: "uniao(".length,
        ariaLabel: "Inserir união de eventos",
        latex: "P(A\\cup B)",
      },
      {
        label: "P(A∩B)",
        insert: "intersecao_independente(,)",
        cursorOffset: "intersecao_independente(".length,
        ariaLabel: "Inserir interseção de eventos independentes",
        latex: "P(A\\cap B)",
      },
      {
        label: "P(A|B)",
        insert: "condicional(,)",
        cursorOffset: "condicional(".length,
        ariaLabel: "Inserir probabilidade condicional",
        latex: "P(A \\mid B)",
      },
      {
        label: "A⊥B?",
        insert: "independentes(,,)",
        cursorOffset: "independentes(".length,
        ariaLabel: "Verificar independência de eventos",
        latex: "P(A\\cap B)=P(A)\\cdot P(B)",
      },
      {
        label: "Binomial",
        insert: "binomial(,,)",
        cursorOffset: "binomial(".length,
        ariaLabel: "Inserir distribuição binomial",
        latex: "\\binom{n}{k}p^{k}(1-p)^{n-k}",
      },
    ],
  },
  {
    id: "simbolos",
    label: "Símbolos",
    keys: [
      { label: "π", insert: "π", cursorOffset: 1, ariaLabel: "Inserir pi", latex: "\\pi" },
      { label: "e", insert: "e", cursorOffset: 1, ariaLabel: "Inserir número de Euler" },
      {
        // Sprint V2.3 (Motor de Números Complexos) — "i" minúsculo é a
        // unidade imaginária em toda a área `complex/` do backend (ver
        // `math_engine/complex/evaluator.py`); inserção simples de um
        // caractere, mesmo padrão de "e" acima (cursor logo depois).
        label: "i",
        insert: "i",
        cursorOffset: 1,
        ariaLabel: "Inserir unidade imaginária i",
        latex: "i",
      },
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
