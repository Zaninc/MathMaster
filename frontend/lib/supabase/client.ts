"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { isSupabaseConfigured, supabaseConfig } from "./config";

let browserClient: SupabaseClient | null = null;

/**
 * Singleton por aba: o cliente browser guarda a sessão em cookies
 * (via @supabase/ssr), então recriá-lo a cada render só desperdiçaria
 * listeners de auth. Retorna null quando o Supabase não está
 * configurado — quem chama decide o fallback de UI.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseConfig.url!, supabaseConfig.anonKey!);
  }
  return browserClient;
}
