/**
 * Classificação de erros da API (Sprint Frontend V1, Etapa 0).
 *
 * Dois conceitos distintos de "timeout" que este módulo NÃO confunde:
 * - timeout de REDE (o cliente desiste de esperar uma resposta) — kind
 *   "network_timeout", nunca chega como resposta HTTP.
 * - timeout do BACKEND (o cálculo simbólico foi interrompido à força após
 *   `compute_timeout_seconds`) — chega como uma resposta HTTP 400 comum
 *   (`ComputationTimeoutError` é subclasse de `ExpressionError` em
 *   `backend/app/math_engine/errors.py`, sem status dedicado). A única
 *   forma de diferenciar esse caso de um 400 comum é o texto de `detail`
 *   conter `TIMEOUT_MESSAGE_MARKER` — dependência frágil a uma mudança de
 *   copy no backend, coberta por teste de regressão dedicado
 *   (`errors.test.ts`).
 *
 * 422 é tratado como o mesmo "kind" que 400 (`invalid_expression`): é o
 * caso do FastAPI rejeitar `SolveRequest.expression` na validação do
 * Pydantic (ex. excede `max_length=1000`) antes mesmo de chegar ao
 * math_engine — do ponto de vista do usuário é o mesmo problema ("o que
 * você digitou não pôde ser processado").
 */

export type ApiErrorKind =
  | "invalid_expression"
  | "backend_timeout"
  | "rate_limited"
  | "server_error"
  | "network_error"
  | "network_timeout";

export const TIMEOUT_MESSAGE_MARKER = "excedeu o tempo máximo permitido";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly detail?: string;

  constructor(kind: ApiErrorKind, detail?: string, status?: number) {
    super(detail ?? kind);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.detail = detail;
  }
}

export function classifyResponseError(status: number, detail: string | undefined): ApiError {
  if (status === 429) {
    return new ApiError("rate_limited", detail, status);
  }
  if (status === 400 || status === 422) {
    if (detail?.includes(TIMEOUT_MESSAGE_MARKER)) {
      return new ApiError("backend_timeout", detail, status);
    }
    return new ApiError("invalid_expression", detail, status);
  }
  return new ApiError("server_error", detail, status);
}

const FALLBACK_MESSAGES: Record<ApiErrorKind, string> = {
  invalid_expression: "Não conseguimos interpretar essa expressão. Revise a escrita e tente novamente.",
  backend_timeout: "Esse cálculo levou mais tempo do que o permitido.",
  rate_limited: "Você fez muitas tentativas em pouco tempo. Aguarde um momento.",
  server_error: "O motor matemático está temporariamente indisponível.",
  network_error: "O motor matemático está temporariamente indisponível.",
  network_timeout: "Esse cálculo levou mais tempo do que o permitido.",
};

/**
 * Mensagem exibida ao usuário: prioriza o `detail` real do backend quando
 * disponível (já é curado e seguro — ver `mathmaster-formatter-conservative
 * -design`/anos de hardening do ExpressionError), cai na cópia oficial de
 * produto só quando não há `detail` específico (rate limit, timeout,
 * erros de rede/servidor não trazem uma mensagem por caso).
 */
export function friendlyMessage(error: ApiError): string {
  if (error.kind === "invalid_expression" && error.detail) {
    return error.detail;
  }
  return FALLBACK_MESSAGES[error.kind];
}
