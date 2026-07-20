import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadSyncEnv } from "./env";

describe("loadSyncEnv", () => {
  let emptyDir: string;
  let originalUrl: string | undefined;
  let originalKey: string | undefined;

  beforeEach(() => {
    // Diretório temporário sem .env.local — garante que este teste nunca
    // lê o .env.local real do projeto (que já tem essas variáveis).
    emptyDir = mkdtempSync(join(tmpdir(), "sync-exercises-env-test-"));
    originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    rmSync(emptyDir, { recursive: true, force: true });
    if (originalUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  });

  it("lança com mensagem clara quando as variáveis obrigatórias estão ausentes", () => {
    expect(() => loadSyncEnv(emptyDir)).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() => loadSyncEnv(emptyDir)).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("retorna as variáveis quando ambas estão presentes", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key";

    const env = loadSyncEnv(emptyDir);

    expect(env.supabaseUrl).toBe("https://example.supabase.co");
    expect(env.serviceRoleKey).toBe("fake-service-role-key");
  });
});
