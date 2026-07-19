import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { SupabaseNotConfigured } from "@/components/auth/SupabaseNotConfigured";
import { PageShell } from "@/components/layout/PageShell";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta MathMaster.",
};

export default async function CadastroPage() {
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
        title="Criar conta"
        subtitle="Leva menos de um minuto — só nome, e-mail e senha."
        altText="Já tem conta?"
        altHref="/login"
        altLabel="Entrar"
      >
        <SignUpForm />
      </AuthFormShell>
    </PageShell>
  );
}
