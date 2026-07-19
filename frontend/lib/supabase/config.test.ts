import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

async function loadConfig() {
  vi.resetModules();
  return import("./config");
}

describe("isSupabaseConfigured", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("é false sem nenhuma variável definida", async () => {
    const { isSupabaseConfigured } = await loadConfig();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("é false com apenas a URL definida", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
    const { isSupabaseConfigured } = await loadConfig();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("é false com apenas a anon key definida", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    const { isSupabaseConfigured } = await loadConfig();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("é true com URL e anon key definidas, expostas em supabaseConfig", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    const { isSupabaseConfigured, supabaseConfig } = await loadConfig();
    expect(isSupabaseConfigured()).toBe(true);
    expect(supabaseConfig.url).toBe("https://proj.supabase.co");
    expect(supabaseConfig.anonKey).toBe("anon-key");
  });
});
