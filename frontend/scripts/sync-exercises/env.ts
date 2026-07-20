import { loadEnvConfig } from "@next/env";

/**
 * Carrega `.env.local` com o MESMO mecanismo que o próprio Next.js usa
 * em dev/build (`@next/env` — já dependência transitiva de `next`,
 * promovida aqui a devDependency explícita). Evita manter um parser de
 * `.env` próprio e evita adicionar `dotenv` como dependência nova.
 */
export interface SyncEnv {
  supabaseUrl: string;
  serviceRoleKey: string;
}

const REQUIRED_VARS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

/**
 * `projectDir` aponta pra `frontend/` (onde `.env.local` mora) — passar
 * um diretório diferente em teste evita carregar o `.env.local` real.
 */
export function loadSyncEnv(projectDir: string = process.cwd()): SyncEnv {
  loadEnvConfig(projectDir);

  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente ausentes: ${missing.join(", ")}. Defina em frontend/.env.local (nunca comitado — ver ` +
        `frontend/.env.local.example e frontend/scripts/sync-exercises/README.md). ` +
        `SUPABASE_SERVICE_ROLE_KEY NUNCA leva o prefixo NEXT_PUBLIC_ nem pode ser exposta ao frontend.`
    );
  }

  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  };
}
