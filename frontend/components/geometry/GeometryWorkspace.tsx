"use client";

import { useMemo, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/shared/Button";
import { FadeIn } from "@/components/shared/FadeIn";
import { apiClient } from "@/lib/api/client";
import { ApiError, friendlyMessage } from "@/lib/api/errors";
import {
  circleArea,
  circleCircumference,
  classifyTriangleByAngle,
  classifyTriangleBySides,
  distance,
  isValidTriangle,
  trianglePerimeter,
  triangleArea,
  type Point,
} from "@/lib/math/geometry";

import { GeometryCanvas } from "./GeometryCanvas";
import type { GeometryShape } from "./types";

type ShapeKind = "triangle" | "circle" | "line" | "parabola" | "ellipse" | "hyperbola";

const SHAPE_TABS: { id: ShapeKind; label: string; source: "local" | "backend" }[] = [
  { id: "triangle", label: "Triângulo", source: "local" },
  { id: "circle", label: "Círculo", source: "backend" },
  { id: "line", label: "Reta", source: "backend" },
  { id: "parabola", label: "Parábola", source: "backend" },
  { id: "ellipse", label: "Elipse", source: "backend" },
  { id: "hyperbola", label: "Hipérbole", source: "backend" },
];

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

interface PointFields {
  x: string;
  y: string;
}

function PointFieldGroup({
  legend,
  value,
  onChange,
}: {
  legend: string;
  value: PointFields;
  onChange: (next: PointFields) => void;
}) {
  return (
    <fieldset className="flex items-end gap-2">
      <legend className="mb-1 w-full text-xs font-medium text-text-secondary">{legend}</legend>
      <label className="flex flex-col gap-1 text-xs text-text-muted">
        x
        <input
          type="number"
          value={value.x}
          onChange={(event) => onChange({ ...value, x: event.target.value })}
          className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-primary outline-none focus-visible:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-text-muted">
        y
        <input
          type="number"
          value={value.y}
          onChange={(event) => onChange({ ...value, y: event.target.value })}
          className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-primary outline-none focus-visible:border-accent"
        />
      </label>
    </fieldset>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-text-muted">
      {label}
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-primary outline-none focus-visible:border-accent"
      />
    </label>
  );
}

/**
 * Fronteira documentada (decisão da auditoria, Etapa 4): Triângulo e
 * Círculo mostram fórmula + substituição calculadas AQUI, no frontend
 * (fixas, determinísticas, sem ambiguidade). Reta/Parábola/Elipse/
 * Hipérbole SEMPRE chamam o backend real — a equação/classificação
 * exibida nunca é recalculada no cliente; o `GeometryShape` passado ao
 * `GeometryCanvas` só descreve o que desenhar, a partir dos MESMOS
 * números do formulário, nunca da resposta em texto do backend.
 */
export function GeometryWorkspace() {
  const [activeKind, setActiveKind] = useState<ShapeKind>("triangle");

  const [triA, setTriA] = useState<PointFields>({ x: "0", y: "0" });
  const [triB, setTriB] = useState<PointFields>({ x: "8", y: "0" });
  const [triC, setTriC] = useState<PointFields>({ x: "0", y: "5" });

  const [circleCenter, setCircleCenter] = useState<PointFields>({ x: "0", y: "0" });
  const [circleRadius, setCircleRadius] = useState("5");

  const [lineP1, setLineP1] = useState<PointFields>({ x: "0", y: "0" });
  const [lineP2, setLineP2] = useState<PointFields>({ x: "4", y: "4" });

  const [paraVertex, setParaVertex] = useState<PointFields>({ x: "0", y: "0" });
  const [paraFocus, setParaFocus] = useState<PointFields>({ x: "0", y: "2" });

  const [ellipseCenter, setEllipseCenter] = useState<PointFields>({ x: "0", y: "0" });
  const [ellipseA, setEllipseA] = useState("6");
  const [ellipseB, setEllipseB] = useState("3");

  const [hyperCenter, setHyperCenter] = useState<PointFields>({ x: "0", y: "0" });
  const [hyperA, setHyperA] = useState("3");
  const [hyperB, setHyperB] = useState("2");

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [backendExpression, setBackendExpression] = useState("");
  const [backendResult, setBackendResult] = useState<string | null>(null);
  const [backendErrorMessage, setBackendErrorMessage] = useState<string | null>(null);

  function handleSelectShape(kind: ShapeKind) {
    setActiveKind(kind);
    setStatus("idle");
    setBackendResult(null);
    setBackendErrorMessage(null);
  }

  const shape: GeometryShape | null = useMemo(() => {
    switch (activeKind) {
      case "triangle": {
        const a: Point = { x: toNumber(triA.x), y: toNumber(triA.y) };
        const b: Point = { x: toNumber(triB.x), y: toNumber(triB.y) };
        const c: Point = { x: toNumber(triC.x), y: toNumber(triC.y) };
        if ([a.x, a.y, b.x, b.y, c.x, c.y].some(Number.isNaN)) return null;
        return { kind: "triangle", points: [a, b, c] };
      }
      case "circle": {
        const center: Point = { x: toNumber(circleCenter.x), y: toNumber(circleCenter.y) };
        const radius = toNumber(circleRadius);
        if (Number.isNaN(center.x) || Number.isNaN(center.y) || Number.isNaN(radius) || radius <= 0) return null;
        return { kind: "circle", center, radius };
      }
      case "line": {
        const p1: Point = { x: toNumber(lineP1.x), y: toNumber(lineP1.y) };
        const p2: Point = { x: toNumber(lineP2.x), y: toNumber(lineP2.y) };
        if ([p1.x, p1.y, p2.x, p2.y].some(Number.isNaN)) return null;
        return { kind: "line", p1, p2 };
      }
      case "parabola": {
        const vertex: Point = { x: toNumber(paraVertex.x), y: toNumber(paraVertex.y) };
        const focus: Point = { x: toNumber(paraFocus.x), y: toNumber(paraFocus.y) };
        if ([vertex.x, vertex.y, focus.x, focus.y].some(Number.isNaN)) return null;
        return { kind: "parabola", vertex, focus };
      }
      case "ellipse": {
        const center: Point = { x: toNumber(ellipseCenter.x), y: toNumber(ellipseCenter.y) };
        const a = toNumber(ellipseA);
        const b = toNumber(ellipseB);
        if ([center.x, center.y, a, b].some(Number.isNaN) || a <= 0 || b <= 0) return null;
        return { kind: "ellipse", center, a, b };
      }
      case "hyperbola": {
        const center: Point = { x: toNumber(hyperCenter.x), y: toNumber(hyperCenter.y) };
        const a = toNumber(hyperA);
        const b = toNumber(hyperB);
        if ([center.x, center.y, a, b].some(Number.isNaN) || a <= 0 || b <= 0) return null;
        return { kind: "hyperbola", center, a, b };
      }
      default:
        return null;
    }
  }, [
    activeKind,
    triA,
    triB,
    triC,
    circleCenter,
    circleRadius,
    lineP1,
    lineP2,
    paraVertex,
    paraFocus,
    ellipseCenter,
    ellipseA,
    ellipseB,
    hyperCenter,
    hyperA,
    hyperB,
  ]);

  const triangleStats = useMemo(() => {
    if (!shape || shape.kind !== "triangle") return null;
    const [a, b, c] = shape.points;
    if (!isValidTriangle(a, b, c)) return null;
    return {
      area: triangleArea(a, b, c),
      perimeter: trianglePerimeter(a, b, c),
      sideClass: classifyTriangleBySides(a, b, c),
      angleClass: classifyTriangleByAngle(a, b, c),
      ab: distance(a, b),
      bc: distance(b, c),
      ca: distance(c, a),
    };
  }, [shape]);

  const circleStats = useMemo(() => {
    if (!shape || shape.kind !== "circle") return null;
    return { area: circleArea(shape.radius), circumference: circleCircumference(shape.radius) };
  }, [shape]);

  function buildExpression(): string | null {
    if (!shape) return null;
    switch (shape.kind) {
      case "circle":
        return `circunferencia((${shape.center.x},${shape.center.y}), ${shape.radius})`;
      case "line":
        return `reta((${shape.p1.x},${shape.p1.y}), (${shape.p2.x},${shape.p2.y}))`;
      case "parabola":
        return `parabola((${shape.vertex.x},${shape.vertex.y}), (${shape.focus.x},${shape.focus.y}))`;
      case "ellipse":
        return `elipse((${shape.center.x},${shape.center.y}), ${shape.a}, ${shape.b})`;
      case "hyperbola":
        return `hiperbole((${shape.center.x},${shape.center.y}), ${shape.a}, ${shape.b})`;
      default:
        return null;
    }
  }

  async function handleCalculate() {
    const expression = buildExpression();
    if (!expression) return;
    setBackendExpression(expression);
    setStatus("loading");
    setBackendResult(null);
    setBackendErrorMessage(null);
    try {
      const response = await apiClient.solve(expression);
      setBackendResult(response.result);
      setStatus("success");
    } catch (cause) {
      const apiError = cause instanceof ApiError ? cause : new ApiError("network_error");
      setBackendErrorMessage(friendlyMessage(apiError));
      setStatus("error");
    }
  }

  return (
    <PageShell variant="full-workspace">
      <div className="grid gap-6 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:gap-8">
        <div className="flex flex-col gap-6">
          <div role="tablist" aria-label="Tipo de figura" className="flex flex-wrap gap-2">
            {SHAPE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeKind === tab.id}
                onClick={() => handleSelectShape(tab.id)}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors duration-(--motion-fast) ${
                  activeKind === tab.id
                    ? "border-accent text-text-primary"
                    : "border-border text-text-secondary hover:text-text-primary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeKind === "triangle" && (
            <div className="flex flex-col gap-3">
              <PointFieldGroup legend="Ponto A" value={triA} onChange={setTriA} />
              <PointFieldGroup legend="Ponto B" value={triB} onChange={setTriB} />
              <PointFieldGroup legend="Ponto C" value={triC} onChange={setTriC} />
              <p className="text-xs text-text-muted">
                Calculado localmente (fórmula fixa, sem chamada ao servidor).
              </p>
            </div>
          )}

          {activeKind === "circle" && (
            <div className="flex flex-col gap-3">
              <PointFieldGroup legend="Centro" value={circleCenter} onChange={setCircleCenter} />
              <NumberField label="Raio" value={circleRadius} onChange={setCircleRadius} />
              <Button type="button" onClick={handleCalculate} disabled={!shape || status === "loading"}>
                {status === "loading" ? "Calculando..." : "Calcular"}
              </Button>
            </div>
          )}

          {activeKind === "line" && (
            <div className="flex flex-col gap-3">
              <PointFieldGroup legend="Ponto 1" value={lineP1} onChange={setLineP1} />
              <PointFieldGroup legend="Ponto 2" value={lineP2} onChange={setLineP2} />
              <Button type="button" onClick={handleCalculate} disabled={!shape || status === "loading"}>
                {status === "loading" ? "Calculando..." : "Calcular"}
              </Button>
            </div>
          )}

          {activeKind === "parabola" && (
            <div className="flex flex-col gap-3">
              <PointFieldGroup legend="Vértice" value={paraVertex} onChange={setParaVertex} />
              <PointFieldGroup legend="Foco" value={paraFocus} onChange={setParaFocus} />
              <p className="text-xs text-text-muted">Vértice e foco precisam compartilhar x ou y (eixo alinhado).</p>
              <Button type="button" onClick={handleCalculate} disabled={!shape || status === "loading"}>
                {status === "loading" ? "Calculando..." : "Calcular"}
              </Button>
            </div>
          )}

          {activeKind === "ellipse" && (
            <div className="flex flex-col gap-3">
              <PointFieldGroup legend="Centro" value={ellipseCenter} onChange={setEllipseCenter} />
              <div className="flex gap-2">
                <NumberField label="Semieixo maior (a)" value={ellipseA} onChange={setEllipseA} />
                <NumberField label="Semieixo menor (b)" value={ellipseB} onChange={setEllipseB} />
              </div>
              <Button type="button" onClick={handleCalculate} disabled={!shape || status === "loading"}>
                {status === "loading" ? "Calculando..." : "Calcular"}
              </Button>
            </div>
          )}

          {activeKind === "hyperbola" && (
            <div className="flex flex-col gap-3">
              <PointFieldGroup legend="Centro" value={hyperCenter} onChange={setHyperCenter} />
              <div className="flex gap-2">
                <NumberField label="Semieixo real (a)" value={hyperA} onChange={setHyperA} />
                <NumberField label="Semieixo imaginário (b)" value={hyperB} onChange={setHyperB} />
              </div>
              <Button type="button" onClick={handleCalculate} disabled={!shape || status === "loading"}>
                {status === "loading" ? "Calculando..." : "Calcular"}
              </Button>
            </div>
          )}

          <div aria-live="polite" className="flex flex-col gap-2">
            {activeKind === "triangle" && triangleStats && (
              <div className="rounded-lg border border-border bg-surface p-3 text-sm text-text-primary">
                <p>Área = |x_A(y_B−y_C) + x_B(y_C−y_A) + x_C(y_A−y_B)| / 2 = {fmt(triangleStats.area)}</p>
                <p>Perímetro = AB + BC + CA = {fmt(triangleStats.perimeter)}</p>
                <p>
                  Lados: AB = {fmt(triangleStats.ab)}, BC = {fmt(triangleStats.bc)}, CA = {fmt(triangleStats.ca)}
                </p>
                <p>
                  Classificação: {triangleStats.sideClass}, {triangleStats.angleClass}
                </p>
              </div>
            )}
            {activeKind === "triangle" && !triangleStats && (
              <p className="text-sm text-danger">Os três pontos não formam um triângulo válido (estão alinhados).</p>
            )}

            {activeKind === "circle" && circleStats && (
              <div className="rounded-lg border border-border bg-surface p-3 text-sm text-text-primary">
                <p>Área = πr² = {fmt(circleStats.area)}</p>
                <p>Comprimento = 2πr = {fmt(circleStats.circumference)}</p>
              </div>
            )}

            {status === "success" && backendResult && (
              <FadeIn>
                <div className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-text-primary">
                  <p className="text-xs text-text-muted">{backendExpression}</p>
                  <p className="mt-1">{backendResult}</p>
                </div>
              </FadeIn>
            )}
            {status === "error" && backendErrorMessage && (
              <FadeIn>
                <p className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
                  {backendErrorMessage}
                </p>
              </FadeIn>
            )}
          </div>
        </div>

        <div>
          <GeometryCanvas shape={shape} />
        </div>
      </div>
    </PageShell>
  );
}
