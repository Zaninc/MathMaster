"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AUTH_INPUT_CLASSES, AUTH_LABEL_CLASSES } from "@/components/auth/AuthFormShell";
import { Button } from "@/components/shared/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Mensagens do Supabase chegam em inglês; o produto fala PT-BR, então os
 * casos previsíveis são traduzidos e o resto cai numa mensagem genérica
 * (sem vazar detalhe interno para a tela).
 */
function translateAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(message)) return "Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).";
  if (/rate limit/i.test(message)) return "Muitas tentativas — aguarde um instante e tente de novo.";
  return "Não foi possível entrar agora. Tente novamente.";
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setSubmitting(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(translateAuthError(signInError.message));
      setSubmitting(false);
      return;
    }

    // refresh() antes do push garante que os Server Components (dashboard,
    // proxy) já enxerguem os cookies novos da sessão.
    router.refresh();
    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-email" className={AUTH_LABEL_CLASSES}>
          E-mail
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={AUTH_INPUT_CLASSES}
          placeholder="voce@exemplo.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-password" className={AUTH_LABEL_CLASSES}>
          Senha
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={AUTH_INPUT_CLASSES}
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <Button type="submit" disabled={submitting || !email || !password}>
        {submitting ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
