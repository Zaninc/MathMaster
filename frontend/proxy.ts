import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured, supabaseConfig } from "@/lib/supabase/config";
import { createTimeoutFetch } from "@/lib/supabase/timeoutFetch";

/**
 * Mantém a sessão Supabase viva (refresh do token via cookies) em toda
 * navegação. Sem Supabase configurado vira um no-op — as rotas públicas
 * existentes não são afetadas.
 *
 * Convenção Next 16: proxy.ts substitui middleware.ts.
 *
 * Hotfix — regressão de produção: este middleware roda em TODA rota
 * (`config.matcher` abaixo só exclui assets estáticos), então uma chamada
 * de rede sem timeout aqui trava o site inteiro, não só páginas com
 * Supabase (ver `lib/supabase/timeoutFetch.ts` para a causa raiz completa
 * e a reprodução). `global.fetch` limita a chamada a alguns segundos; o
 * try/catch garante que qualquer falha (timeout, DNS, rede) deixa a
 * navegação seguir sem sessão renovada em vez de derrubar a resposta
 * inteira — páginas que exigem login já degradam graciosamente sozinhas.
 */
export default async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseConfig.url!, supabaseConfig.anonKey!, {
    global: { fetch: createTimeoutFetch() },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  try {
    // getUser() (e não getSession()) força a revalidação do JWT junto ao
    // servidor Supabase — é essa chamada que dispara o refresh do token.
    await supabase.auth.getUser();
  } catch {
    // Supabase lento/indisponível não pode travar a navegação inteira —
    // segue sem sessão renovada.
  }

  return response;
}

export const config = {
  matcher: [
    // Tudo exceto assets estáticos — auth precisa rodar nas páginas e
    // route handlers, não em imagens/fontes/ícones.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
