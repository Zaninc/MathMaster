/**
 * Hotfix — investigação de regressão de produção (site inteiro travando em
 * "Carregando...").
 *
 * Causa raiz confirmada lendo `node_modules/@supabase/auth-js/src/lib/
 * fetch.ts:_handleRequest` e reproduzindo ao vivo: a chamada de rede que
 * `supabase.auth.getUser()` faz para o servidor GoTrue usa `fetch()` puro,
 * SEM `AbortSignal`/timeout nenhum por padrão. Se o Supabase estiver lento,
 * fora do ar ou inalcançável (DNS, rede), essa chamada nunca resolve nem
 * rejeita — trava para sempre.
 *
 * Isso importa muito mais do que parece porque `proxy.ts` (middleware do
 * Next 16) chama `getUser()` incondicionalmente em TODA rota que não seja
 * asset estático — uma trava aí bloqueia a resposta HTTP inteira, para
 * qualquer página, não só as que usam Supabase. Várias Server Components
 * (ex. `app/aprendizado/page.tsx`, `lib/home/getProgressPreviewData.ts`)
 * também chamam `getSupabaseServerClient()` e aguardam `getUser()`
 * diretamente durante o SSR.
 *
 * Reproduzido isoladamente antes desta correção: uma chamada de
 * `supabase.auth.getUser(jwt)` contra um host Supabase inalcançável nunca
 * resolvia nem rejeitava dentro de uma janela de observação de 20s. Com
 * este wrapper (timeout de 5s), a mesma chamada falha em ~3s de forma
 * controlada (`getUser()` já trata o erro internamente e devolve
 * `{data:{user:null}}`, nunca propaga uma exceção crua).
 *
 * Mecanismo: `createServerClient`/`createClient` do Supabase aceitam
 * `global.fetch` como opção pública e documentada para substituir o fetch
 * usado internamente — não é um hack em cima de `auth-js`, é a extensão
 * oficial do próprio cliente.
 */

const SUPABASE_FETCH_TIMEOUT_MS = 5000;

export function createTimeoutFetch(timeoutMs: number = SUPABASE_FETCH_TIMEOUT_MS): typeof fetch {
  return (input, init) => {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
    return fetch(input, { ...init, signal });
  };
}
