import { describe, expect, it } from "vitest";

import { FORMULAS } from "@/data/formulas";

import { matchesQuery } from "./search";

function titlesMatching(query: string): string[] {
  return FORMULAS.filter((formula) => matchesQuery(formula, query)).map((formula) => formula.title);
}

describe("matchesQuery", () => {
  it("query vazia casa com todas as fórmulas", () => {
    expect(titlesMatching("")).toHaveLength(FORMULAS.length);
    expect(titlesMatching("   ")).toHaveLength(FORMULAS.length);
  });

  it("'delta' encontra o discriminante", () => {
    expect(titlesMatching("delta")).toContain("Delta (discriminante)");
  });

  it("'pitagoras' (sem acento) encontra o Teorema de Pitágoras", () => {
    expect(titlesMatching("pitagoras")).toContain("Teorema de Pitágoras");
  });

  it("'log' encontra fórmulas de logaritmo", () => {
    expect(titlesMatching("log")).toContain("Derivada do logaritmo natural");
  });

  it("'integral' encontra fórmulas de cálculo com integral", () => {
    const titles = titlesMatching("integral");
    expect(titles).toContain("Integral da potência");
    expect(titles).toContain("Integral exponencial");
  });

  it("busca por categoria (case/acento-insensível)", () => {
    const titles = titlesMatching("TRIGONOMETRIA");
    expect(titles).toContain("Lei dos senos");
    expect(titles).not.toContain("Fórmula de Bhaskara");
  });

  it("busca por símbolo (Δ) encontra o discriminante via alias", () => {
    expect(titlesMatching("Δ")).toContain("Delta (discriminante)");
  });

  it("busca por 'sen' encontra fórmulas de seno via alias PT-BR", () => {
    expect(titlesMatching("sen")).toContain("Relação fundamental");
  });

  it("query sem correspondência não retorna nada", () => {
    expect(titlesMatching("xablauzzz123")).toHaveLength(0);
  });
});
