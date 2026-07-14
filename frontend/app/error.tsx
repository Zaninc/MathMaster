"use client";

import { useEffect } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/shared/Button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageShell className="flex flex-col items-center gap-4 text-center">
      <p className="text-sm font-medium text-text-muted">Erro inesperado</p>
      <h1 className="text-2xl font-semibold text-text-primary">Algo deu errado por aqui.</h1>
      <p className="max-w-md text-text-secondary">
        Não foi um problema com a sua expressão — foi a interface que travou. Tente novamente.
      </p>
      <Button type="button" onClick={reset}>
        Tentar de novo
      </Button>
    </PageShell>
  );
}
