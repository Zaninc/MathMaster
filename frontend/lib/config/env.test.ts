import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

async function loadEnv() {
  vi.resetModules();
  const mod = await import("./env");
  return mod.env;
}

describe("env.apiUrl", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_MATHMASTER_API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("usa a variável oficial quando definida", async () => {
    process.env.NEXT_PUBLIC_MATHMASTER_API_URL = "https://api.example.com";
    const env = await loadEnv();
    expect(env.apiUrl).toBe("https://api.example.com");
  });

  it("cai no fallback depreciado e avisa no console quando só ele existe", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://legacy.example.com";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const env = await loadEnv();

    expect(env.apiUrl).toBe("https://legacy.example.com");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("NEXT_PUBLIC_MATHMASTER_API_URL"));
    warnSpy.mockRestore();
  });

  it("prioriza a variável oficial sobre o fallback quando ambas existem", async () => {
    process.env.NEXT_PUBLIC_MATHMASTER_API_URL = "https://api.example.com";
    process.env.NEXT_PUBLIC_API_URL = "https://legacy.example.com";
    const env = await loadEnv();
    expect(env.apiUrl).toBe("https://api.example.com");
  });

  it("usa o default local quando nenhuma variável existe", async () => {
    const env = await loadEnv();
    expect(env.apiUrl).toBe("http://127.0.0.1:8000");
  });
});
