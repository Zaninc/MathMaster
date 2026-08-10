"use client";

import { useEffect, useRef, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { MathFormula } from "@/components/shared/MathFormula";
import { CONVERTER_CATEGORIES, type ConverterCategoryId } from "@/data/converters";
import { convert } from "@/lib/converters/convert";
import { cn } from "@/lib/utils/cn";
import { formatNumber } from "@/lib/utils/format";

const FIELD_CLASSES =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus-visible:border-accent";

// Hotfix (suavizar transição dos Conversores) — durações pedidas
// explicitamente pelo ticket (350-450ms de entrada, saída bem mais curta
// pra não deixar a troca "lenta"). Nenhum token `--motion-*` existente
// cobre essa faixa (`--motion-slow` é 320ms, abaixo do pedido) — valores
// arbitrários do Tailwind (`duration-[Xms]`) são o jeito mais direto de
// atender o número exato sem inventar uma variável CSS nova só pra isto.
const ENTER_MS = 400;
const EXIT_MS = 150;

type PanelPhase = "resting" | "leaving" | "swapping" | "entering";

/** Classes do painel principal para cada fase da transição — sempre a
 * MESMA declaração de `transition`/`ease-out`, só o alvo (opacity/
 * translateY) e a duração mudam por fase. "leaving"/"swapping" usam o
 * MESMO alvo "oculto" (opacity 0, 6px abaixo) — a troca de conteúdo
 * acontece exatamente na fronteira entre as duas, enquanto o painel está
 * 100% invisível, então a troca em si nunca "pisca".
 *
 * `translate-y-*` no Tailwind v4 anima a propriedade CSS `translate`
 * (não `transform` — são propriedades separadas desde CSS Transforms
 * Level 2). Listar `transform` em `transition-[...]` não tem efeito
 * nenhum sobre o deslocamento vertical; precisa ser `translate`. */
function panelPhaseClasses(phase: PanelPhase): string {
  const hidden = phase === "leaving" || phase === "swapping";
  const duration = phase === "leaving" ? "duration-[150ms]" : phase === "swapping" ? "duration-0" : "duration-[400ms]";
  return cn(
    "transition-[opacity,translate] ease-out",
    duration,
    hidden ? "translate-y-1.5 opacity-0" : "translate-y-0 opacity-100"
  );
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Sprint V2.20 — workspace dos Conversores (`/ferramentas/conversores`).
 * Mesmo esqueleto de layout de `GeometryWorkspace.tsx` (`PageShell
 * variant="full-workspace"`, grid `sidebar + área principal` que colapsa
 * pra coluna única abaixo de `lg` sem nenhum tratamento mobile especial —
 * mesma solução responsiva já usada lá) e a mesma técnica de aba (`role=
 * "tablist"`/`role="tab"`/`aria-selected`, sem `role="tabpanel"`
 * explícito — mesmo nível de implementação ARIA de `SHAPE_TABS`) — só
 * que a lista de categorias fica em COLUNA (o wireframe do ticket pede
 * uma lista vertical), não numa fileira horizontal.
 *
 * UMA única implementação de calculadora para as 8 categorias — nunca 8
 * calculadoras copiadas: o formulário (valor + de/para + inverter +
 * resultado + explicação) é sempre a MESMA estrutura, parametrizada pela
 * categoria ativa; toda a matemática específica de cada categoria vive
 * em `lib/converters/convert.ts` (puro, sem depender deste componente).
 *
 * Hotfix V2.20.2 (transição entre categorias) — introduziu uma primeira
 * versão baseada em `FadeIn`+`key={categoryId}` (remonta o painel,
 * reproduz só a entrada). Hotfix seguinte (suavizar transição) SUBSTITUI
 * essa técnica: remontar trocava o conteúdo instantaneamente e só
 * animava a entrada — a saída era um corte seco, exatamente o que o
 * ticket pediu pra eliminar. Agora o painel é um `<div>` ESTÁVEL (nunca
 * remonta) cujo `className` muda em 4 fases (`PanelPhase`): "resting"
 * (visível) → "leaving" (foto opacity 1→0 + translateY 0→6px em 150ms)
 * → "swapping" (troca o CONTEÚDO — categoria/unidades/valor — num frame
 * só, com `duration-0`, enquanto o painel está 100% invisível, então a
 * troca em si nunca pisca) → "entering" (opacity 0→1 + translateY
 * 6px→0 em 400ms, dentro dos 350-450ms pedidos) → volta a "resting".
 * `categoryId` (o que a SIDEBAR destaca) atualiza IMEDIATAMENTE no
 * clique — só o CONTEÚDO do painel (`displayedCategoryId`, de onde vêm
 * `category`/`fromId`/`toId`/`value`) espera a fase "swapping". Trocar
 * só `value`/`fromId`/`toId`/inverter nunca entra nesse state machine —
 * nenhuma das fases é tocada, nenhuma transição dispara.
 * `prefers-reduced-motion` checado diretamente via `matchMedia` (nenhum
 * hook existia pra isso): quando ativo, a troca é INSTANTÂNEA (pula as 4
 * fases inteiramente), nunca um atraso artificial de 150ms sem nenhuma
 * animação visível pra compensar. A sidebar (`role="tablist"`) nunca
 * remonta nem é afetada por nenhuma fase — permanece 100% estável, como
 * antes. `opacity`/`transform` nunca disparam reflow — zero layout
 * shift por construção.
 */
export function ConvertersWorkspace() {
  // "Selecionada" (destaca a sidebar IMEDIATAMENTE) vs "exibida" (o que o
  // painel de fato renderiza — só alcança a selecionada na fase
  // "swapping", ver docstring acima).
  const [categoryId, setCategoryId] = useState<ConverterCategoryId>(CONVERTER_CATEGORIES[0].id);
  const [displayedCategoryId, setDisplayedCategoryId] = useState<ConverterCategoryId>(CONVERTER_CATEGORIES[0].id);
  const category = CONVERTER_CATEGORIES.find((c) => c.id === displayedCategoryId) ?? CONVERTER_CATEGORIES[0];

  const [value, setValue] = useState("1");
  const [fromId, setFromId] = useState(category.defaultFromId);
  const [toId, setToId] = useState(category.defaultToId);

  const [panelPhase, setPanelPhase] = useState<PanelPhase>("resting");
  const pendingCategoryRef = useRef<ConverterCategoryId | null>(null);

  // Aplica a categoria (conteúdo do painel + valores/unidades padrão) —
  // sempre num único ponto, chamado tanto pelo caminho instantâneo
  // (reduced motion) quanto pela fase "swapping" da transição normal.
  function applyDisplayedCategory(nextId: ConverterCategoryId) {
    const nextCategory = CONVERTER_CATEGORIES.find((c) => c.id === nextId);
    if (!nextCategory) return;
    setDisplayedCategoryId(nextId);
    setFromId(nextCategory.defaultFromId);
    setToId(nextCategory.defaultToId);
    setValue("1");
  }

  function handleSelectCategory(nextId: ConverterCategoryId) {
    if (nextId === categoryId) return;
    setCategoryId(nextId);
    if (prefersReducedMotion()) {
      applyDisplayedCategory(nextId);
      return;
    }
    pendingCategoryRef.current = nextId;
    setPanelPhase("leaving");
  }

  useEffect(() => {
    if (panelPhase === "leaving") {
      const id = setTimeout(() => {
        if (pendingCategoryRef.current !== null) {
          applyDisplayedCategory(pendingCategoryRef.current);
          pendingCategoryRef.current = null;
        }
        setPanelPhase("swapping");
      }, EXIT_MS);
      return () => clearTimeout(id);
    }
    if (panelPhase === "swapping") {
      // Precisa de um frame pintado com o painel já invisível (opacity
      // 0, duration-0) ANTES de pedir a transição de entrada — mesma
      // técnica que `FadeIn` já usava pro mount, aplicada aqui pra
      // "entering" também: sem o `requestAnimationFrame`, o navegador
      // podia colapsar "swapping" e "entering" no mesmo frame e pular a
      // animação de entrada direto pro estado final.
      const id = requestAnimationFrame(() => setPanelPhase("entering"));
      return () => cancelAnimationFrame(id);
    }
    if (panelPhase === "entering") {
      const id = setTimeout(() => setPanelPhase("resting"), ENTER_MS);
      return () => clearTimeout(id);
    }
  }, [panelPhase]);

  function handleSwap() {
    setFromId(toId);
    setToId(fromId);
  }

  const fromUnit = category.units.find((u) => u.id === fromId) ?? category.units[0];
  const toUnit = category.units.find((u) => u.id === toId) ?? category.units[1] ?? category.units[0];

  // Vazio nunca vira 0 escondido: `Number("")` é 0 em JS, então a
  // checagem de string vazia precisa vir ANTES do `Number()` — mesma
  // lição já aplicada no backend pra distinguir "nada digitado" de "zero
  // digitado" (ver `polynomial_division.py`/histórico de sprints).
  const trimmedValue = value.trim();
  const parsedValue = trimmedValue === "" ? null : Number(trimmedValue);
  const isValidInput = parsedValue !== null && Number.isFinite(parsedValue);
  const outcome = isValidInput ? convert(displayedCategoryId, parsedValue, fromUnit, toUnit) : null;

  return (
    <PageShell variant="full-workspace" className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-text-primary">Conversores</h1>
        <p className="max-w-2xl text-sm text-text-secondary">
          Converta unidades e veja como o cálculo é feito.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] lg:gap-8">
        <div
          role="tablist"
          aria-label="Categoria de conversão"
          aria-orientation="vertical"
          className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0"
        >
          {CONVERTER_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === categoryId}
              onClick={() => handleSelectCategory(c.id)}
              className={cn(
                "shrink-0 rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors duration-(--motion-fast)",
                c.id === categoryId
                  ? "border-accent bg-accent/10 text-text-primary"
                  : "border-border text-text-secondary hover:border-border-hover hover:text-text-primary"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div
          data-motion-reveal
          data-panel-phase={panelPhase}
          className={cn(
            "flex flex-col gap-6 rounded-lg border border-border bg-surface p-4 sm:p-6",
            panelPhaseClasses(panelPhase)
          )}
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-text-primary">{category.label}</h2>
            {category.note !== undefined && <p className="text-xs text-text-muted">{category.note}</p>}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1 text-xs text-text-muted">
              Valor
              <input
                type="number"
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className={FIELD_CLASSES}
              />
            </label>

            <label className="flex flex-1 flex-col gap-1 text-xs text-text-muted">
              De
              <select value={fromId} onChange={(event) => setFromId(event.target.value)} className={FIELD_CLASSES}>
                {category.units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.label})
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={handleSwap}
              aria-label="Inverter unidades de origem e destino"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-text-secondary transition-colors duration-(--motion-fast) hover:border-border-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span aria-hidden="true">⇄</span>
            </button>

            <label className="flex flex-1 flex-col gap-1 text-xs text-text-muted">
              Para
              <select value={toId} onChange={(event) => setToId(event.target.value)} className={FIELD_CLASSES}>
                {category.units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.label})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-md border border-border bg-surface-elevated p-4">
            <p className="text-xs font-medium text-text-secondary">Resultado</p>
            {parsedValue === null || !Number.isFinite(parsedValue) ? (
              <p className="mt-1 text-sm text-text-muted">Digite um valor numérico para converter.</p>
            ) : outcome === null ? (
              <p className="mt-1 text-sm text-danger">Não foi possível converter essas unidades.</p>
            ) : (
              <p className="mt-1 flex flex-wrap items-baseline gap-1.5 text-xl font-semibold text-text-primary">
                <span>
                  {formatNumber(parsedValue)} {fromUnit.label} =
                </span>
                {outcome.exactLatex !== null ? (
                  <MathFormula formula={outcome.exactLatex} />
                ) : (
                  <span>{outcome.formatted}</span>
                )}
                <span className="text-sm font-normal text-text-secondary">{toUnit.label}</span>
              </p>
            )}
          </div>

          {outcome !== null && (
            <section
              aria-label="Como foi convertido"
              className="rounded-md border border-border bg-surface px-4 py-3"
            >
              <h3 className="text-xs font-medium text-text-secondary">Como foi convertido</h3>
              <div className="mt-1.5 flex flex-col gap-1">
                {outcome.steps.map((step, index) => {
                  // Sprint V2.20.1 — o ÚLTIMO passo é sempre o resultado
                  // da conta ("= X"); quando existe uma forma exata em
                  // LaTeX (hoje só ângulo), ele ganha mais destaque
                  // (cor/tamanho + o próprio pipeline KaTeX) do que os
                  // passos de preparação acima — "a matemática deve ter
                  // mais destaque que o texto". Os outros passos
                  // continuam texto simples — nunca um segundo resultado
                  // principal competindo com o card "Resultado" acima.
                  const isLastStep = index === outcome.steps.length - 1;
                  if (isLastStep && outcome.exactLatex !== null && step.startsWith("= ")) {
                    return (
                      <p key={index} className="flex items-baseline gap-1.5 text-sm text-text-primary">
                        <span className="text-text-secondary">=</span>
                        <MathFormula formula={outcome.exactLatex} />
                      </p>
                    );
                  }
                  return (
                    <p
                      key={index}
                      className={cn("text-sm", isLastStep ? "font-medium text-text-primary" : "text-text-secondary")}
                    >
                      {step}
                    </p>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </PageShell>
  );
}
