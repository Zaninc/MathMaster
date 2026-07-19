/**
 * Espelho TypeScript da tabela `profiles` (supabase/migrations/0001_profiles.sql).
 * Se a migração mudar, este tipo muda junto.
 */
export interface Profile {
  id: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}
