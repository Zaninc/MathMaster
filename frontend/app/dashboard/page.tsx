import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { SupabaseNotConfigured } from "@/components/auth/SupabaseNotConfigured";
import { PageShell } from "@/components/layout/PageShell";
import { ButtonLink } from "@/components/shared/Button";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Seu espaço pessoal no MathMaster.",
};

/**
 * Dashboard inicial (Sprint V1.5.1): saudação + atalhos. Exercícios,
 * histórico e learning engine chegam em sprints futuras — os atalhos
 * levam ao que já existe hoje.
 */
const SHORTCUTS = [
  { label: "Calculadora", href: "/calculadora", description: "Resolva expressões, equações e mais." },
  { label: "Gráficos", href: "/graficos", description: "Visualize funções no plano." },
  { label: "Aprendizado", href: "/aprendizado", description: "Exercícios por tópico e dificuldade." },
  { label: "Histórico", href: "/dashboard/historico", description: "Seus exercícios resolvidos recentemente." },
] as const;

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <PageShell className="flex justify-center">
        <div className="w-full max-w-md">
          <SupabaseNotConfigured />
        </div>
      </PageShell>
    );
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase!.auth.getUser();
  if (!user) redirect("/login");

  // maybeSingle: logo após o signup o trigger pode ainda não ter criado a
  // linha — a saudação cai no e-mail em vez de a página quebrar.
  const { data: profile } = await supabase!
    .from("profiles")
    .select("id, display_name, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  const greetingName = profile?.display_name?.trim() || user.email;

  return (
    <PageShell className="flex flex-col gap-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-text-primary">Olá, {greetingName}!</h1>
          <p className="max-w-2xl text-sm text-text-secondary">
            Este é o seu espaço no MathMaster. Exercícios personalizados e histórico de estudo chegam nas
            próximas versões — por enquanto, seus atalhos:
          </p>
        </div>
        <SignOutButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.href} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-text-primary">{shortcut.label}</h2>
              <p className="text-sm text-text-secondary">{shortcut.description}</p>
            </div>
            <ButtonLink href={shortcut.href} variant="secondary" className="mt-auto self-start">
              Abrir
            </ButtonLink>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
