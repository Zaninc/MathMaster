import { describe, expect, it, vi } from "vitest";

import type { ExerciseDraft } from "../../data/exercises/types";
import { runSync, type SyncSupabaseClient } from "./run";

const VALID_EXERCISE: ExerciseDraft = {
  slug: "algebra-basica-simplificacao-001",
  topicSlug: "algebra-basica",
  difficulty: "facil",
  position: 1,
  statement: "Simplifique a expressão:",
  statementLatex: "3x + 2x - x",
  choices: ["5x", "4x", "6x", "x"],
  correctIndex: 1,
  explanation: "3x + 2x - x = 4x.",
};

/** Fake em memória do Supabase — sem tocar rede/banco nenhum, como pedido. */
function makeFakeSupabase(options: { topics?: Array<{ id: string; slug: string }>; existingExerciseSlugs?: string[] } = {}) {
  const topics = options.topics ?? [{ id: "topic-uuid-1", slug: "algebra-basica" }];
  const existingSlugs = options.existingExerciseSlugs ?? [];
  const upsertCalls: unknown[][] = [];

  const client: SyncSupabaseClient = {
    from(table: string) {
      return {
        select: vi.fn(async () => {
          if (table === "topics") return { data: topics, error: null };
          if (table === "exercises") return { data: existingSlugs.map((slug) => ({ slug })), error: null };
          throw new Error(`tabela inesperada: ${table}`);
        }),
        upsert: vi.fn(async (rows: unknown[]) => {
          upsertCalls.push(rows);
          return { error: null };
        }),
      };
    },
  };

  return { client, upsertCalls };
}

describe("runSync", () => {
  it("catálogo inválido: aborta sem chamar o Supabase (nenhuma operação de escrita)", async () => {
    const { client, upsertCalls } = makeFakeSupabase();
    const fromSpy = vi.spyOn(client, "from");

    const invalid: ExerciseDraft = { ...VALID_EXERCISE, choices: ["a", "b", "c"] as unknown as ExerciseDraft["choices"] };
    const result = await runSync({ catalog: [invalid], dryRun: false, supabase: client });

    expect(result.ok).toBe(false);
    expect(result.validationErrors.length).toBeGreaterThan(0);
    expect(result.wrote).toBe(false);
    expect(fromSpy).not.toHaveBeenCalled();
    expect(upsertCalls).toHaveLength(0);
  });

  it("tópico inexistente: aborta antes de escrever", async () => {
    const { client, upsertCalls } = makeFakeSupabase({ topics: [] });

    const result = await runSync({ catalog: [VALID_EXERCISE], dryRun: false, supabase: client });

    expect(result.ok).toBe(false);
    expect(result.validationErrors[0].message).toContain("tópico inexistente");
    expect(upsertCalls).toHaveLength(0);
  });

  it("dry-run: calcula o plano mas nunca chama upsert", async () => {
    const { client, upsertCalls } = makeFakeSupabase();

    const result = await runSync({ catalog: [VALID_EXERCISE], dryRun: true, supabase: client });

    expect(result.ok).toBe(true);
    expect(result.wrote).toBe(false);
    expect(result.plan?.toInsert).toEqual(["algebra-basica-simplificacao-001"]);
    expect(upsertCalls).toHaveLength(0);
  });

  it("sync real: faz upsert por slug e reporta o plano", async () => {
    const { client, upsertCalls } = makeFakeSupabase();

    const result = await runSync({ catalog: [VALID_EXERCISE], dryRun: false, supabase: client });

    expect(result.ok).toBe(true);
    expect(result.wrote).toBe(true);
    expect(result.writeErrors).toBe(0);
    expect(upsertCalls).toHaveLength(1);
    const [rows] = upsertCalls;
    expect(rows).toEqual([
      expect.objectContaining({ slug: "algebra-basica-simplificacao-001", topic_id: "topic-uuid-1" }),
    ]);
  });

  it("idempotência: rodar duas vezes não gera um segundo insert (a segunda vez só atualiza)", async () => {
    const { client: firstClient } = makeFakeSupabase();
    const firstResult = await runSync({ catalog: [VALID_EXERCISE], dryRun: false, supabase: firstClient });
    expect(firstResult.plan?.toInsert).toEqual(["algebra-basica-simplificacao-001"]);

    // segunda rodada: o "banco" agora já tem o slug (simula o upsert anterior ter acontecido)
    const { client: secondClient, upsertCalls } = makeFakeSupabase({
      existingExerciseSlugs: ["algebra-basica-simplificacao-001"],
    });
    const secondResult = await runSync({ catalog: [VALID_EXERCISE], dryRun: false, supabase: secondClient });

    expect(secondResult.plan?.toInsert).toEqual([]);
    expect(secondResult.plan?.toUpdate).toEqual(["algebra-basica-simplificacao-001"]);
    expect(upsertCalls).toHaveLength(1);
  });

  it("exercício remoto sem par local vira divergente, nunca é apagado", async () => {
    const { client } = makeFakeSupabase({ existingExerciseSlugs: ["algebra-basica-simplificacao-001", "orfao-001"] });

    const result = await runSync({ catalog: [VALID_EXERCISE], dryRun: true, supabase: client });

    expect(result.plan?.divergent).toEqual(["orfao-001"]);
  });
});
