import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { isSupabaseConfigured, supabaseConfig } from "./config";

/**
 * Cliente para Server Components e Route Handlers. Nunca use este módulo
 * em código client-side (importa next/headers). Retorna null quando o
 * Supabase não está configurado.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient(supabaseConfig.url!, supabaseConfig.anonKey!, {
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
