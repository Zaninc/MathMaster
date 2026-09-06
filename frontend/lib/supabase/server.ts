import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { isSupabaseConfigured, supabaseConfig } from "./config";
import { createTimeoutFetch } from "./timeoutFetch";

/**
 * Cliente para Server Components e Route Handlers. Nunca use este módulo
 * em código client-side (importa next/headers). Retorna null quando o
 * Supabase não está configurado.
 *
 * Hotfix — regressão de produção: `global.fetch` limita as chamadas deste
 * cliente a alguns segundos (ver `timeoutFetch.ts` para a causa raiz) —
 * sem isso, uma Server Component que aguarda `getUser()`/uma consulta
 * diretamente (ex. `app/aprendizado/page.tsx`) trava o SSR da página
 * inteira se o Supabase estiver lento ou fora do ar.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient(supabaseConfig.url!, supabaseConfig.anonKey!, {
    global: { fetch: createTimeoutFetch() },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Components não podem gravar cookies — o refresh de
          // sessão que exigiria essa gravação é responsabilidade do
          // proxy.ts, então ignorar aqui é seguro.
        }
      },
    },
  });
}
