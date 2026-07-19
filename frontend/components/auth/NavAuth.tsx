"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

interface NavAuthProps {
  variant: "desktop" | "mobile";
  onNavigate?: () => void;
}

/**
 * Entrada única de auth na NavBar (deliberadamente 1 elemento — a NavBar
 * tem uma pendência conhecida de overflow em 768px e este componente não
 * pode agravá-la). Sem Supabase configurado não renderiza nada, deixando
 * a NavBar idêntica à de antes da Sprint V1.5.1.
 */
export function NavAuth({ variant, onNavigate }: NavAuthProps) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setAuthenticated(Boolean(data.session));
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(Boolean(session));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // null = não configurado ou estado inicial ainda não resolvido — não
  // renderizar evita flicker Entrar→Dashboard no primeiro paint.
  if (authenticated === null) return null;

  const href = authenticated ? "/dashboard" : "/login";
  const label = authenticated ? "Dashboard" : "Entrar";

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        variant === "desktop"
          ? "rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-primary transition-colors duration-(--motion-fast) hover:border-border-hover hover:bg-surface"
          : "flex items-center gap-2 rounded-md px-3 py-3 text-sm font-medium text-text-secondary"
      )}
    >
      {label}
    </Link>
  );
}
