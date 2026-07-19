/**
 * Fallback honesto para quando NEXT_PUBLIC_SUPABASE_URL/ANON_KEY não
 * existem no ambiente: as telas de auth explicam o que falta em vez de
 * quebrar (mesma filosofia dos cards de Ferramentas — nada finge estar
 * pronto).
 */
export function SupabaseNotConfigured() {
  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <h2 className="text-base font-semibold text-text-primary">Autenticação não configurada</h2>
      <p className="mt-2 text-sm text-text-secondary">
        Este ambiente ainda não tem as credenciais do Supabase. Defina{" "}
        <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
        <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> no{" "}
        <code className="font-mono text-xs">.env.local</code> (ver{" "}
        <code className="font-mono text-xs">.env.local.example</code>) e reinicie o servidor.
      </p>
    </div>
  );
}
