"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, type ButtonVariant } from "@/components/shared/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface SignOutButtonProps {
  variant?: ButtonVariant;
  className?: string;
}

export function SignOutButton({ variant = "secondary", className }: SignOutButtonProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  }

  return (
    <Button variant={variant} className={className} onClick={handleSignOut} disabled={signingOut}>
      {signingOut ? "Saindo…" : "Sair"}
    </Button>
  );
}
