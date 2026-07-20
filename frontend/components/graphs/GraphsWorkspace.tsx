"use client";

import { useEffect, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { normalizeForPlot } from "@/lib/math/graph-normalize";
import { compilePlotFunction, PlotExpressionError, type PlotFn } from "@/lib/math/plot-evaluator";
import { DEFAULT_VIEWPORT, type Viewport } from "@/lib/math/viewport";

import { FunctionList } from "./FunctionList";
import { GraphCanvas } from "./GraphCanvas";
import type { PlotFunction } from "./types";

const PALETTE = ["#3d6eff", "#22d3ee", "#34d399", "#f5a524", "#ef4b4b", "#a78bfa"];

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `fn-${idCounter}`;
}

export function GraphsWorkspace() {
  const [functions, setFunctions] = useState<PlotFunction[]>([]);
  const [compiled, setCompiled] = useState<Map<string, PlotFn>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);

  useEffect(() => {
    let cancelled = false;

    async function compileAll() {
      const nextCompiled = new Map<string, PlotFn>();
      const nextErrors = new Map<string, string>();

      await Promise.all(
        functions.map(async (fn) => {
          try {
            // Normalização acontece só aqui, na fronteira antes do avaliador —
            // compilePlotFunction/plot-evaluator.ts nunca sabem que a entrada
            // pode ter vindo em notação natural (x², sen(x), x(x+1)).
            const evaluate = await compilePlotFunction(normalizeForPlot(fn.expression));
            nextCompiled.set(fn.id, evaluate);
          } catch (cause) {
            const message =
              cause instanceof PlotExpressionError ? cause.message : "Não foi possível plotar esta função.";
            nextErrors.set(fn.id, message);
          }
        })
      );

      if (!cancelled) {
        setCompiled(nextCompiled);
        setErrors(nextErrors);
      }
    }

    compileAll();
    return () => {
      cancelled = true;
    };
  }, [functions]);

  function handleAdd(expression: string) {
    const color = PALETTE[functions.length % PALETTE.length];
    setFunctions((previous) => [...previous, { id: generateId(), expression, color, visible: true }]);
  }

  function handleToggle(id: string) {
    setFunctions((previous) => previous.map((fn) => (fn.id === id ? { ...fn, visible: !fn.visible } : fn)));
  }

  function handleRemove(id: string) {
    setFunctions((previous) => previous.filter((fn) => fn.id !== id));
  }

  return (
    <PageShell variant="full-workspace">
      <div className="grid gap-6 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:gap-8">
        <aside>
          <FunctionList
            functions={functions}
            errors={errors}
            onAdd={handleAdd}
            onToggle={handleToggle}
            onRemove={handleRemove}
          />
        </aside>
        <div>
          <GraphCanvas functions={functions} compiled={compiled} viewport={viewport} onViewportChange={setViewport} />
        </div>
      </div>
    </PageShell>
  );
}
