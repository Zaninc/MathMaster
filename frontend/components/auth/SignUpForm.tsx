"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AUTH_INPUT_CLASSES, AUTH_LABEL_CLASSES } from "@/components/auth/AuthFormShell";
import { Button } from "@/components/shared/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 6;

function translateSignUpError(message: string): string {
  if (/already registered/i.test(message)) return "Este e-mail já tem uma conta — use a tela de entrar.";
  if (/password/i.test(message)) return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (/rate limit/i.test(message)) return "Muitas tentativas — aguarde um instante e tente de novo.";
  return "Não foi possível criar a conta agora. Tente novamente.";
}

export function SignUpForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    setSubmitting(true);
    setError(null);

    // display_name viaja em user_metadata; o trigger handle_new_user
    // (migração 0001) copia para profiles.display_name no INSERT.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName.trim() } },
    });

    if (signUpError) {
      setError(translateSignUpError(signUpError.message));
      setSubmitting(false);
      return;
    }

    // Com confirmação de e-mail ligada no projeto Supabase, signUp não
    // devolve sessão — o usuário precisa clicar no link antes de entrar.
    if (!data.session) {
      setAwaitingConfirmation(true);
      setSubmitting(false);
      return;
    }

    router.refresh();
    router.push("/dashboard");
  }

  if (awaitingConfirmation) {
    return (
      <div role="status" className="rounded-md border border-border bg-background px-4 py-3 text-sm text-text-secondary">
        Conta criada! Enviamos um link de confirmação para{" "}
        <span className="font-medium text-text-primary">{email}</span>. Depois de confirmar, é só{" "}
        <a href="/login" className="font-medium text-accent hover:underline">
          entrar
        </a>
        .
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-name" className={AUTH_LABEL_CLASSES}>
          Nome
        </label>
        <input
          id="signup-name"
          type="text"
          autoComplete="name"
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className={AUTH_INPUT_CLASSES}
          placeholder="Como quer ser chamado(a)"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-email" className={AUTH_LABEL_CLASSES}>
          E-mail
        </label>
        <input
          id="signup-email"
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
        <label htmlFor="signup-password" className={AUTH_LABEL_CLASSES}>
          Senha
        </label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={AUTH_INPUT_CLASSES}
          placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <Button type="submit" disabled={submitting || !displayName.trim() || !email || !password}>
        {submitting ? "Criando conta…" : "Criar conta"}
      </Button>
    </form>
  );
}
