/**
 * Credenciais públicas do Supabase (Sprint V1.5.1). A anon key não é
 * segredo — a segurança vem das políticas RLS no banco (ver
 * supabase/migrations/). Assim como em lib/config/env.ts, as variáveis
 * são lidas por referência estática literal para o Next.js inliná-las.
 *
 * Auth é opcional: sem as variáveis o app continua funcionando e as
 * telas de auth mostram um aviso de "não configurado" em vez de quebrar.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
};

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
