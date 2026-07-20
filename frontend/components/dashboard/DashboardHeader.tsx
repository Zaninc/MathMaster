import { SignOutButton } from "@/components/auth/SignOutButton";
import type { Profile } from "@/lib/supabase/types";

interface DashboardHeaderProps {
  profile: Profile | null;
  email: string;
}

function initialsFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const base = trimmed.includes("@") ? trimmed.split("@")[0] : trimmed;
  const parts = base.split(/\s+/).filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
  return initials || "?";
}

/**
 * Cabeçalho do aluno (Sprint V1.5.5). `profiles` ainda não tem coluna de
 * avatar — em vez de inventar o campo, o avatar é sempre o fallback de
 * iniciais, derivado do nome ou, na ausência dele, do e-mail. Profile
 * incompleto/ausente (linha do trigger ainda não criada) cai no mesmo
 * fallback de e-mail já usado no restante do dashboard.
 */
export function DashboardHeader({ profile, email }: DashboardHeaderProps) {
  const name = profile?.display_name?.trim() || email;
  const initials = initialsFor(name);

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface-elevated text-base font-semibold text-text-primary"
        >
          {initials}
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-text-primary">Olá, {name}!</h1>
          <p className="text-sm text-text-secondary">
            Continue firme — cada exercício resolvido soma para o seu progresso.
          </p>
        </div>
      </div>
      <SignOutButton />
    </div>
  );
}
