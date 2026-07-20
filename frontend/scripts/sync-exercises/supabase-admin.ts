import { createClient } from "@supabase/supabase-js";

import type { SyncEnv } from "./env";

/**
 * Cliente com a service role key — ignora RLS de propósito (é o único
 * jeito de escrever em `exercises`/`topics`, que só têm policy de
 * SELECT para `authenticated`; ver 0002_topics_exercises.sql). Nunca
 * importar este módulo fora de scripts server-side confiáveis — nunca
 * em `frontend/app`, `frontend/components` ou qualquer código que rode
 * no navegador.
 */
export function createSupabaseAdminClient(env: SyncEnv) {
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
