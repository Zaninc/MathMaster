"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { MathKeyboard } from "@/components/math-input/MathKeyboard";
import { StructuredMathInputLoader, type StructuredMathInputApi } from "@/components/math-input/StructuredMathInputLoader";
import { Button } from "@/components/shared/Button";
import { ExampleButton } from "@/components/shared/ExampleButton";
import { CALCULATOR_QUICK_EXAMPLES } from "@/data/examples";
import { KEYBOARD_CATEGORIES, type KeyboardKey } from "@/data/keyboard";
import { apiClient } from "@/lib/api/client";
import type { HistoryItem } from "@/lib/api/types";
import { ApiError, friendlyMessage } from "@/lib/api/errors";
import { mathFieldLatexToBackendExpression } from "@/lib/math/mathfield-to-backend";
import { previewLatex } from "@/lib/math/to-latex";

import { HistoryPanel } from "./HistoryPanel";
import { ResultPanel, type ResultStatus } from "./ResultPanel";

/**
 * Sprint V3.0 (Structured Math Input) — só a categoria Básico (as 9 teclas
 * do ticket, com `mathLiveInsert`) era mostrada nesta página; as demais
 * ainda inseriam texto bruto que o `StructuredMathInput` não sabia
 * representar estruturalmente (decisão de escopo confirmada com o Theo).
 *
 * Sprint V3.0.1 (Structured Calculus Input) — Cálculo (derivada, integral
 * indefinida/definida, limite, somatório, todas com `mathLiveInsert`)
 * volta a aparecer, ao lado de Básico.
 *
 * Sprint V3.0.2 (Structured Algebra Input) — Álgebra volta a aparecer,
 * mas só o subconjunto migrado (x, y, sistemas 2x2/3x3, matrizes 2x2/3x3,
 * determinante 2x2/3x3, inversa, transposta — todos com `mathLiveInsert`);
 * as teclas de polinômio (fatorar/expandir/simplificar/grau/raízes/
 * coeficientes/divisão) ficam fora do escopo desta sprint e continuam sem
 * `mathLiveInsert` — por isso `structuredOnly` (abaixo, no `<MathKeyboard>`)
 * as esconde automaticamente, sem precisar de uma segunda lista de
 * categorias filtradas por dentro.
 *
 * Sprint V3.0.3 (Structured Logs & Exponentials) — Funções volta a
 * aparecer, mas só o subconjunto migrado (log, ln, logₐ, eˣ — todos com
 * `mathLiveInsert`); "f(x)="/"f( )" ficam fora do escopo desta sprint
 * (definição/avaliação de função genérica, não logaritmo/exponencial) e
 * continuam sem `mathLiveInsert`, escondidas por `structuredOnly` do mesmo
 * jeito. Trigonometria/Geometria/Combinatória/Probabilidade/Símbolos
 * continuam ocultas — voltam progressivamente nas próximas V3.0.x, sem
 * precisar mudar este arquivo de novo (só ampliar esta lista).
 */
const ENABLED_KEYBOARD_CATEGORIES = KEYBOARD_CATEGORIES.filter((category) =>
  ["basico", "calculo", "algebra", "funcoes"].includes(category.id)
);

/** Escapa `\`/`{`/`}` — o mínimo pra um texto cru não quebrar dentro de `\text{...}`. */
function escapeForLatexText(text: string): string {
  return text.replace(/\\/g, "\\textbackslash ").replace(/[{}]/g, (char) => `\\${char}`);
}

/**
 * Ordem visual controlada por `order-*`/`lg:order-*` (um único
 * `ResultPanel`, reposicionado por CSS) em vez de renderizar o painel
 * duas vezes: no mobile "resultado logo abaixo do editor" (exigência
 * explícita do briefing), no desktop depois do teclado/exemplos, antes do
 * histórico lateral.
 */
export function CalculatorWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // LaTeX é a única fonte da verdade do `StructuredMathInput` (Sprint
  // V3.0) — nunca mais a string Unicode que o backend espera; essa
  // conversão agora é feita só na hora de resolver, via
  // `mathFieldLatexToBackendExpression` (`handleSubmit`). Não dá pra
  // inicializar de forma síncrona a partir de `?expression=` como antes
  // (a conversão pro LaTeX de exibição é assíncrona — ver `syncSeqRef`
  // abaixo) — o efeito de deep link, mais adiante, cuida disso no
  // primeiro render.
  const [latex, setLatex] = useState("");
  const [status, setStatus] = useState<ResultStatus>("idle");
  const [solvedExpression, setSolvedExpression] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [approx, setApprox] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [hiddenTimestamps, setHiddenTimestamps] = useState<Set<string>>(new Set());

  const structuredApiRef = useRef<StructuredMathInputApi | null>(null);
  // Evita que uma conversão assíncrona antiga (Unicode -> LaTeX) sobrescreva
  // o campo depois de uma mais nova já ter resolvido — mesma técnica de
  // staleness de `hooks/useSolveLatex.ts` (`cancelled`/chave), adaptada pra
  // um contador simples já que aqui só o resultado MAIS RECENTE importa.
  const syncSeqRef = useRef(0);
  const inputId = useId();
  const errorId = useId();

  /**
   * Converte texto Unicode (exemplos, histórico, deep link) pro LaTeX que o
   * `StructuredMathInput` exibe — reaproveita `previewLatex` (já usado pelo
   * preview/resultado/histórico, `lib/math/to-latex.ts`), nunca um segundo
   * conversor. Se `previewLatex` não reconhecer o texto (fora do catálogo
   * dele — raro, mais amplo que o adapter de envio), cai num `\text{...}`
   * literal como último recurso, só para o campo não ficar vazio.
   */
  const syncFieldFromUnicode = useCallback((text: string) => {
    const seq = ++syncSeqRef.current;
    // Sempre resolve num microtask (nunca `setState` síncrono no corpo da
    // função) — este helper é chamado tanto de handlers de evento quanto de
    // um `useEffect` (deep link), e `setState` síncrono direto no corpo de
    // um efeito é proibido pelas regras novas do React Compiler
    // (`react-hooks/set-state-in-effect`); resolver sempre por promise
    // deixa o comportamento uniforme nos dois contextos.
    const latexPromise = text.trim() === "" ? Promise.resolve<string | null>("") : previewLatex(text);
    void latexPromise.then((converted) => {
      if (syncSeqRef.current !== seq) return;
      setLatex(converted ?? `\\text{${escapeForLatexText(text)}}`);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getHistory()
      .then((items) => {
        if (!cancelled) setHistory(items);
      })
      .catch(() => {
        // histórico é secundário: falha silenciosa não deve quebrar a tela principal
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await apiClient.getHistory());
    } catch {
      // histórico é secundário
    }
  }, []);

  const solve = useCallback(
    async (value: string) => {
      if (value.trim().length === 0) return;
      setStatus("loading");
      setResult(null);
      setApprox(null);
      setErrorMessage(null);
      setSolvedExpression(value);
      try {
        const response = await apiClient.solve(value);
        setResult(response.result);
        setApprox(response.approx);
        setStatus("success");
        await refreshHistory();
      } catch (cause) {
        const apiError = cause instanceof ApiError ? cause : new ApiError("network_error");
        setErrorMessage(friendlyMessage(apiError));
        setStatus("error");
      }
    },
    [refreshHistory]
  );

  // Investigação "Ver propriedades" (pós-Sprint V2.3): `useState(() =>
  // searchParams.get("expression") ?? "")` acima só roda no PRIMEIRO
  // mount — um link que aponta pra ESTA MESMA rota (ex. "Ver
  // propriedades" de `data/connections.ts`, sempre clicado a partir de
  // `/calculadora`) troca a query string sem desmontar `CalculatorWorkspace`
  // (Next.js App Router preserva a instância numa navegação que só muda
  // parâmetros da mesma página), então o inicializador nunca roda de novo
  // e a tela parecia "não fazer nada" ao clicar.
  //
  // Ajuste direto no CORPO DO RENDER (nunca dentro de um `useEffect`),
  // mesmo padrão já usado em `ProgressiveMathResult`/`RouteTransition`
  // neste projeto para "resetar estado quando uma prop muda": comparar
  // contra o último valor já processado e, só quando muda de verdade,
  // ajustar o estado. `solve` chamado direto aqui (não num efeito) é
  // deliberado: `solve` seta vários estados de forma síncrona antes do
  // primeiro `await` (pro "Resolvendo..." aparecer na hora, mesmo em
  // `handleSubmit`) — chamar isso de dentro de um `useEffect` dispara o
  // lint `react-hooks/set-state-in-effect` (cascata de renders); ajustar
  // no corpo do render é o padrão que este projeto já usa pra evitar
  // exatamente isso.
  //
  // Bug real encontrado DEPOIS da correção acima (auto-resolve só
  // funcionava na primeira vez): comparar só por "expression" quebra numa
  // SEGUNDA ação idêntica — `buildMatrixPropertiesLink` sempre gera a
  // MESMA URL estática pra mesma matriz, então o segundo clique produz
  // exatamente o `searchParams.get("expression")` já registrado como
  // processado, e o guard (corretamente, pela lógica antiga) bloqueava —
  // só que "já vi essa expressão" não deveria significar "não processar
  // de novo", deveria significar "não processar de novo ESTA MESMA
  // navegação". Corrigido com um identificador de solicitação
  // (`?request=<uuid>`, gerado no CLIENTE a cada clique — nunca durante
  // renderização, ver `ContextActionPill` — nunca reaproveitado entre
  // cliques, mesmo pra expressão idêntica): quando presente, vira a
  // chave de deduplicação (`previousDeepLinkRequest`), garantindo uma
  // execução nova por clique; quando ausente (todo outro consumidor de
  // `calculatorLink`, ex. Fórmulas/Geometria, sem `request`), cai de
  // volta pra comparar só a expressão (`previousDeepLinkExpression`),
  // preservando 100% o comportamento de antes pra esses casos.
  const deepLinkExpression = searchParams.get("expression");
  const deepLinkAutoSolve = searchParams.get("autoSolve") === "1";
  const deepLinkRequest = searchParams.get("request");
  const [previousDeepLinkExpression, setPreviousDeepLinkExpression] = useState<string | null>(null);
  const [previousDeepLinkRequest, setPreviousDeepLinkRequest] = useState<string | null>(null);
  const isNewRequest = deepLinkRequest !== null && deepLinkRequest !== previousDeepLinkRequest;
  const isNewPlainExpression = deepLinkRequest === null && deepLinkExpression !== previousDeepLinkExpression;
  if (deepLinkExpression !== null && (isNewRequest || isNewPlainExpression)) {
    setPreviousDeepLinkExpression(deepLinkExpression);
    if (deepLinkRequest !== null) setPreviousDeepLinkRequest(deepLinkRequest);
    if (deepLinkAutoSolve) {
      solve(deepLinkExpression);
    } else {
      setStatus("idle");
      setResult(null);
      setApprox(null);
      setErrorMessage(null);
    }
  }

  // Sincroniza o campo estruturado com o que está sendo resolvido — mesmo
  // em `autoSolve`, onde `solve()` não mexe nele sozinho (só quem chama
  // `solve` decide o que aparece, ver `handleSubmit`/`fillExpression`); sem
  // isso, o resultado mudaria sem o campo acompanhar. Em efeito próprio
  // (não no corpo do render acima, junto de `solve()`): `syncFieldFromUnicode`
  // mexe em `syncSeqRef.current`, e mutar ref durante o render é proibido
  // pelas regras novas do React Compiler (`react-hooks/refs`) — `solve()`
  // continua no render (só usa `setState`, permitido nesse padrão). Disparar
  // só quando `previousDeepLinkExpression` MUDA (não a cada `request` novo
  // com o MESMO texto) já é suficiente: o campo só precisa reconverter
  // quando o texto em si muda.
  useEffect(() => {
    if (previousDeepLinkExpression !== null) syncFieldFromUnicode(previousDeepLinkExpression);
  }, [previousDeepLinkExpression, syncFieldFromUnicode]);

  // Limpeza da URL (preferência confirmada na investigação): depois de
  // consumir `autoSolve`+`request`, remove os dois da URL, deixando só
  // `?expression=...` — assim um F5/voltar não re-resolve sozinho, e o
  // PRÓXIMO clique em "Ver propriedades" volta a acrescentar um par
  // `autoSolve`/`request` novo. `router.replace` é uma navegação (efeito
  // externo de verdade, não `setState` local do React) — por isso mora
  // num `useEffect` PRÓPRIO, separado do ajuste de estado acima, e nunca
  // dispara o lint `set-state-in-effect` (não chama nenhum setter local).
  // A condição `deepLinkRequest === previousDeepLinkRequest` só fica
  // verdadeira no PRÓXIMO render depois que o bloco acima já registrou o
  // pedido como processado — nunca limpa antes de `solve` já ter sido
  // disparado.
  //
  // `cleanedRequestRef` (não depender só do array de dependências do
  // `useEffect` pra idempotência): se `router` de `next/navigation` não
  // for uma referência perfeitamente estável em TODO cenário (confirmado
  // que isso quebra com um mock de teste ingênuo — `useRouter: () => ({
  // push, replace })` cria um objeto novo a cada render, forçando o
  // efeito a rodar de novo mesmo sem nenhuma dependência "de verdade"
  // mudar), o efeito PODE rodar mais de uma vez para o MESMO request já
  // settled. A ref garante `router.replace` no máximo uma vez por
  // request, não importa quantas vezes o efeito seja re-executado.
  const cleanedRequestRef = useRef<string | null>(null);
  useEffect(() => {
    if (deepLinkExpression === null || deepLinkRequest === null) return;
    if (deepLinkRequest !== previousDeepLinkRequest) return;
    if (cleanedRequestRef.current === deepLinkRequest) return;
    cleanedRequestRef.current = deepLinkRequest;
    router.replace(`/calculadora?expression=${encodeURIComponent(deepLinkExpression)}`);
  }, [deepLinkExpression, deepLinkRequest, previousDeepLinkRequest, router]);

  /**
   * Converte o LaTeX do campo pra sintaxe do backend (adapter novo desta
   * sprint) e só então resolve — nunca envia LaTeX cru. Falha de conversão
   * (slot vazio ou notação fora do catálogo desta sprint) mostra uma
   * mensagem amigável pelo MESMO mecanismo que erros de rede/servidor já
   * usam (`ResultPanel` com `status==="error"`), nunca dispara requisição
   * nem deixa exceção escapar.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (latex.trim().length === 0) return;
    const converted = mathFieldLatexToBackendExpression(latex);
    if (!converted.ok) {
      setStatus("error");
      setResult(null);
      setApprox(null);
      setSolvedExpression("");
      setErrorMessage(
        converted.reason === "incomplete"
          ? "Preencha todos os espaços antes de resolver."
          : "Esta notação ainda não é suportada pela calculadora."
      );
      return;
    }
    solve(converted.expression);
  }

  /**
   * Delega pra API real de inserção do MathLive (`insert()`), nunca
   * concatenação de string — teclas ainda não migradas (sem
   * `mathLiveInsert`, categorias fora de `ENABLED_KEYBOARD_CATEGORIES`) não
   * aparecem nesta página, então este `return` cedo nunca deveria disparar
   * na prática; é só uma proteção de tipo.
   */
  function handleInsert(key: KeyboardKey) {
    if (key.mathLiveInsert === undefined) return;
    structuredApiRef.current?.insert(key.mathLiveInsert);
  }

  function fillExpression(value: string) {
    syncFieldFromUnicode(value);
    setStatus("idle");
    setResult(null);
    setApprox(null);
    setErrorMessage(null);
    structuredApiRef.current?.focus();
  }

  function handleClear() {
    fillExpression("");
  }

  function handleHideHistoryItem(timestamp: string) {
    setHiddenTimestamps((previous) => new Set(previous).add(timestamp));
  }

  return (
    <PageShell variant="full-workspace">
      {/* `min-w-0` nas duas colunas: itens de grid têm `min-width: auto`
          (piso = min-content do conteúdo). No mobile (coluna implícita
          `auto`), a fileira de abas do teclado (~672px de min-content)
          estourava a página inteira; o desktop já se protegia via
          `minmax(0,1fr)` no track explícito. Com o piso zerado, a fileira
          rola no próprio `overflow-x-auto` dela, como sempre foi a intenção. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:gap-8">
        <div className="min-w-0 flex flex-col gap-4">
          <form onSubmit={handleSubmit} className="order-1 flex flex-col gap-2">
            <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">
              Expressão matemática
            </label>
            <StructuredMathInputLoader
              id={inputId}
              value={latex}
              onChange={setLatex}
              onReady={(api) => {
                structuredApiRef.current = api;
              }}
              placeholder="Digite ou monte com o teclado abaixo, ex.: x² - 4 = 0"
              ariaDescribedBy={status === "error" ? errorId : undefined}
              ariaInvalid={status === "error"}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={status === "loading" || latex.trim().length === 0}>
                {status === "loading" ? "Resolvendo..." : "Resolver"}
              </Button>
              <Button type="button" variant="ghost" onClick={handleClear} disabled={latex.length === 0}>
                Limpar
              </Button>
            </div>
          </form>

          <div className="order-2 lg:order-4">
            <ResultPanel
              status={status}
              expression={solvedExpression}
              result={result}
              approx={approx}
              errorMessage={errorMessage}
              errorId={errorId}
              onRetry={handleClear}
            />
          </div>

          <div className="order-3 lg:order-2">
            <MathKeyboard onInsert={handleInsert} categories={ENABLED_KEYBOARD_CATEGORIES} structuredOnly />
          </div>

          <div className="order-4 lg:order-3">
            <p className="mb-2 text-sm font-medium text-text-secondary">Exemplos</p>
            <div className="flex flex-wrap gap-2">
              {CALCULATOR_QUICK_EXAMPLES.map((example) => (
                <ExampleButton key={example.expression} example={example} onSelect={fillExpression} />
              ))}
            </div>
          </div>
        </div>

        <aside className="min-w-0 lg:border-l lg:border-border lg:pl-8">
          <HistoryPanel
            items={history}
            hiddenTimestamps={hiddenTimestamps}
            onSelect={fillExpression}
            onHide={handleHideHistoryItem}
          />
        </aside>
      </div>
    </PageShell>
  );
}
