import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DEFAULT_VIEWPORT, dataToPixelX, dataToPixelY } from "@/lib/math/viewport";

import {
  AxisSegment,
  CircleMarkers,
  EllipseMarkers,
  HyperbolaMarkers,
  LineMarkers,
  ParabolaMarkers,
  PointMarker,
  TriangleMarkers,
  centroidOf,
  type MarkerContext,
} from "./GeometryMarkers";
import type { GeometryShape } from "./types";

const WIDTH = 800;
const HEIGHT = 600;
const CONTEXT: MarkerContext = { viewport: DEFAULT_VIEWPORT, width: WIDTH, height: HEIGHT };

describe("centroidOf", () => {
  it("calcula a média dos pontos", () => {
    expect(centroidOf([{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 6 }])).toEqual({ x: 2, y: 2 });
  });
});

describe("PointMarker", () => {
  it("posiciona o círculo do marcador na coordenada correta em pixel", () => {
    const { container } = render(<PointMarker point={{ x: 0, y: 0 }} context={CONTEXT} label="Centro" />);
    const dot = container.querySelector("circle")!;
    expect(Number(dot.getAttribute("cx"))).toBeCloseTo(dataToPixelX(0, DEFAULT_VIEWPORT, WIDTH));
    expect(Number(dot.getAttribute("cy"))).toBeCloseTo(dataToPixelY(0, DEFAULT_VIEWPORT, HEIGHT));
  });

  it("mostra o rótulo de texto quando informado", () => {
    render(<PointMarker point={{ x: 0, y: 0 }} context={CONTEXT} label="Foco" />);
    expect(screen.getByText("Foco")).toBeInTheDocument();
  });

  it("sem label, não renderiza texto (só o ponto)", () => {
    const { container } = render(<PointMarker point={{ x: 0, y: 0 }} context={CONTEXT} />);
    expect(container.querySelector("text")).toBeNull();
    expect(container.querySelector("circle")).not.toBeNull();
  });

  it("com showCoords, mostra as coordenadas formatadas", () => {
    render(<PointMarker point={{ x: 3, y: -2 }} context={CONTEXT} label="A" showCoords />);
    expect(screen.getByText("(3, -2)")).toBeInTheDocument();
  });
});

describe("AxisSegment", () => {
  it("desenha uma linha entre os dois pontos e o rótulo no meio", () => {
    const { container } = render(
      <AxisSegment from={{ x: 0, y: 0 }} to={{ x: 5, y: 0 }} label="r = 5" context={CONTEXT} />
    );
    expect(container.querySelector("line")).not.toBeNull();
    expect(screen.getByText("r = 5")).toBeInTheDocument();
  });

  it("dashed aplica strokeDasharray, sem dashed não aplica", () => {
    const { container: withDash } = render(
      <AxisSegment from={{ x: 0, y: 0 }} to={{ x: 1, y: 0 }} label="a" context={CONTEXT} dashed />
    );
    expect(withDash.querySelector("line")?.getAttribute("stroke-dasharray")).not.toBeNull();

    const { container: withoutDash } = render(
      <AxisSegment from={{ x: 0, y: 0 }} to={{ x: 1, y: 0 }} label="a" context={CONTEXT} />
    );
    expect(withoutDash.querySelector("line")?.getAttribute("stroke-dasharray")).toBeNull();
  });

  it("labelAnchor='midpoint' (padrão) coloca o rótulo no meio do segmento", () => {
    const { container } = render(
      <AxisSegment from={{ x: 0, y: 0 }} to={{ x: 10, y: 0 }} label="r = 10" context={CONTEXT} />
    );
    const text = container.querySelector("text")!;
    const midX = (dataToPixelX(0, DEFAULT_VIEWPORT, WIDTH) + dataToPixelX(10, DEFAULT_VIEWPORT, WIDTH)) / 2;
    expect(Number(text.getAttribute("x"))).toBeCloseTo(midX + 6);
  });

  it("labelAnchor='end' coloca o rótulo perto de `to`, além do meio do segmento", () => {
    const { container } = render(
      <AxisSegment from={{ x: -10, y: 0 }} to={{ x: 10, y: 0 }} label="a = 10" context={CONTEXT} labelAnchor="end" />
    );
    const text = container.querySelector("text")!;
    const toX = dataToPixelX(10, DEFAULT_VIEWPORT, WIDTH);
    const midX = (dataToPixelX(-10, DEFAULT_VIEWPORT, WIDTH) + toX) / 2;
    // perto do vértice (to), não no meio (que aqui coincidiria com o centro, 0,0)
    expect(Number(text.getAttribute("x"))).toBeGreaterThan(toX);
    expect(Number(text.getAttribute("x"))).not.toBeCloseTo(midX);
  });
});

describe("marcadores por figura", () => {
  it("Triângulo: rótulos A, B, C e coordenadas", () => {
    const shape = { kind: "triangle", points: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 5 }] } as Extract<
      GeometryShape,
      { kind: "triangle" }
    >;
    render(<TriangleMarkers shape={shape} context={CONTEXT} />);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
    expect(screen.getByText("(0, 0)")).toBeInTheDocument();
    expect(screen.getByText("(8, 0)")).toBeInTheDocument();
  });

  it("Círculo: rótulo Centro e segmento do raio", () => {
    const shape = { kind: "circle", center: { x: 0, y: 0 }, radius: 5 } as Extract<GeometryShape, { kind: "circle" }>;
    const { container } = render(<CircleMarkers shape={shape} context={CONTEXT} />);
    expect(screen.getByText("Centro")).toBeInTheDocument();
    expect(screen.getByText("r = 5")).toBeInTheDocument();
    expect(container.querySelector("line")).not.toBeNull();
  });

  it("Reta: rótulos P1 e P2 nos extremos", () => {
    const shape = { kind: "line", p1: { x: 0, y: 0 }, p2: { x: 4, y: 4 } } as Extract<GeometryShape, { kind: "line" }>;
    render(<LineMarkers shape={shape} context={CONTEXT} />);
    expect(screen.getByText("P1")).toBeInTheDocument();
    expect(screen.getByText("P2")).toBeInTheDocument();
  });

  it("Parábola: rótulos Vértice e Foco", () => {
    const shape = { kind: "parabola", vertex: { x: 0, y: 0 }, focus: { x: 0, y: 2 } } as Extract<
      GeometryShape,
      { kind: "parabola" }
    >;
    render(<ParabolaMarkers shape={shape} context={CONTEXT} />);
    expect(screen.getByText("Vértice")).toBeInTheDocument();
    expect(screen.getByText("Foco")).toBeInTheDocument();
  });

  it("Elipse: Centro + segmentos a e b", () => {
    const shape = { kind: "ellipse", center: { x: 0, y: 0 }, a: 6, b: 3 } as Extract<
      GeometryShape,
      { kind: "ellipse" }
    >;
    render(<EllipseMarkers shape={shape} context={CONTEXT} />);
    expect(screen.getByText("Centro")).toBeInTheDocument();
    expect(screen.getByText("a = 6")).toBeInTheDocument();
    expect(screen.getByText("b = 3")).toBeInTheDocument();
  });

  it("Hipérbole: Centro + segmentos a e b", () => {
    const shape = { kind: "hyperbola", center: { x: 0, y: 0 }, a: 3, b: 2 } as Extract<
      GeometryShape,
      { kind: "hyperbola" }
    >;
    render(<HyperbolaMarkers shape={shape} context={CONTEXT} />);
    expect(screen.getByText("Centro")).toBeInTheDocument();
    expect(screen.getByText("a = 3")).toBeInTheDocument();
    expect(screen.getByText("b = 2")).toBeInTheDocument();
  });

  it("Hipérbole: rótulo 'a' fica perto do vértice, não sobreposto ao 'Centro'", () => {
    const shape = { kind: "hyperbola", center: { x: 0, y: 0 }, a: 3, b: 2 } as Extract<
      GeometryShape,
      { kind: "hyperbola" }
    >;
    render(<HyperbolaMarkers shape={shape} context={CONTEXT} />);

    const centroLabel = screen.getByText("Centro");
    const aLabel = screen.getByText("a = 3");
    const bLabel = screen.getByText("b = 2");
    const centerPx = dataToPixelX(0, DEFAULT_VIEWPORT, WIDTH);
    const vertexRightPx = dataToPixelX(3, DEFAULT_VIEWPORT, WIDTH);

    // "a" perto do vértice direito (x=3), longe do centro (x=0) — não mais no meio do segmento (que é o centro).
    expect(Number(aLabel.getAttribute("x"))).toBeGreaterThan(vertexRightPx - 1);
    expect(Number(aLabel.getAttribute("x"))).not.toBeCloseTo(centerPx);

    // Nenhum dos três rótulos cai nas mesmas coordenadas (x,y) — sem sobreposição.
    const positions = [centroLabel, aLabel, bLabel].map((node) => `${node.getAttribute("x")},${node.getAttribute("y")}`);
    expect(new Set(positions).size).toBe(positions.length);
  });
});
