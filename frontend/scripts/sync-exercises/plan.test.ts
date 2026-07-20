import { describe, expect, it } from "vitest";

import { planSync } from "./plan";

describe("planSync", () => {
  it("catálogo todo novo: tudo vai para toInsert", () => {
    const plan = planSync(["a", "b"], new Set());
    expect(plan.toInsert).toEqual(["a", "b"]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.divergent).toEqual([]);
  });

  it("slug já existente no banco vai para toUpdate", () => {
    const plan = planSync(["a", "b"], new Set(["a"]));
    expect(plan.toInsert).toEqual(["b"]);
    expect(plan.toUpdate).toEqual(["a"]);
  });

  it("slug remoto sem par local vira divergent, nunca é sugerido pra exclusão", () => {
    const plan = planSync(["a"], new Set(["a", "orfao"]));
    expect(plan.divergent).toEqual(["orfao"]);
    expect(plan.toInsert).toEqual([]);
    expect(plan.toUpdate).toEqual(["a"]);
  });

  it("idempotência: rodar o plano de novo com o remoto já igual ao local não gera novas inserções", () => {
    const localSlugs = ["a", "b", "c"];
    const firstRun = planSync(localSlugs, new Set());
    expect(firstRun.toInsert).toEqual(localSlugs);

    // depois de "aplicar" o primeiro plano, o remoto passa a ter os mesmos slugs
    const remoteAfterFirstRun = new Set(localSlugs);
    const secondRun = planSync(localSlugs, remoteAfterFirstRun);

    expect(secondRun.toInsert).toEqual([]);
    expect(secondRun.toUpdate).toEqual(localSlugs);
    expect(secondRun.divergent).toEqual([]);
  });

  it("catálogo vazio não quebra", () => {
    expect(planSync([], new Set())).toEqual({ toInsert: [], toUpdate: [], divergent: [] });
  });
});
