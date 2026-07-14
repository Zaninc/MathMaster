/**
 * NEXT_PUBLIC_MATHMASTER_API_URL é a variável oficial (Sprint Frontend V1).
 * NEXT_PUBLIC_API_URL (nome usado desde o Sprint 2) continua funcionando
 * como fallback depreciado durante a migração — remover quando nenhum
 * ambiente de deploy depender mais dele.
 *
 * Next.js só inlina `process.env.NEXT_PUBLIC_*` quando a expressão é uma
 * referência estática literal (não dinâmica), por isso as duas variáveis
 * são lidas explicitamente, nunca por nome construído em runtime.
 */
const DEFAULT_API_URL = "http://127.0.0.1:8000";

function resolveApiUrl(): string {
  const primary = process.env.NEXT_PUBLIC_MATHMASTER_API_URL;
  if (primary) return primary;

  const deprecatedFallback = process.env.NEXT_PUBLIC_API_URL;
  if (deprecatedFallback) {
    console.warn(
      "NEXT_PUBLIC_API_URL está depreciada — migre para NEXT_PUBLIC_MATHMASTER_API_URL."
    );
    return deprecatedFallback;
  }

  return DEFAULT_API_URL;
}

export const env = {
  apiUrl: resolveApiUrl(),
};
