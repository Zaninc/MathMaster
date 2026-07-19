import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { SupabaseNotConfigured } from "@/components/auth/SupabaseNotConfigured";
import { PageShell } from "@/components/layout/PageShell";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entre na sua conta MathMaster.",
};

export default async function LoginPage() {
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
  if (user) redirect("/dashboard");

  return (
    <PageShell className="flex justify-center">
      <AuthFormShell
        title="Entrar"
        subtitle="Acesse sua conta para acompanhar seu progresso."
        altText="Ainda não tem conta?"
        altHref="/cadastro"
        altLabel="Criar conta"
      >
        <LoginForm />
      </AuthFormShell>
    </PageShell>
  );
}
