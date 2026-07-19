import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured, supabaseConfig } from "@/lib/supabase/config";

/**
 * Mantém a sessão Supabase viva (refresh do token via cookies) em toda
 * navegação. Sem Supabase configurado vira um no-op — as rotas públicas
 * existentes não são afetadas.
 *
 * Convenção Next 16: proxy.ts substitui middleware.ts.
 */
export default async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseConfig.url!, supabaseConfig.anonKey!, {
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

  // getUser() (e não getSession()) força a revalidação do JWT junto ao
  // servidor Supabase — é essa chamada que dispara o refresh do token.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Tudo exceto assets estáticos — auth precisa rodar nas páginas e
    // route handlers, não em imagens/fontes/ícones.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
