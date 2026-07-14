import { describe, expect, it } from "vitest";

import { ApiError, classifyResponseError, friendlyMessage, TIMEOUT_MESSAGE_MARKER } from "./errors";

describe("classifyResponseError", () => {
  it("classifica 429 como rate_limited", () => {
    const error = classifyResponseError(429, "Muitas requisições. Tente novamente em instantes.");
    expect(error.kind).toBe("rate_limited");
  });

  it("classifica 400 comum como invalid_expression", () => {
    const error = classifyResponseError(400, "Nome não reconhecido: 'xyz'.");
    expect(error.kind).toBe("invalid_expression");
  });

  it("classifica 422 (validação do Pydantic) como invalid_expression", () => {
    const error = classifyResponseError(422, "String should have at most 1000 characters");
    expect(error.kind).toBe("invalid_expression");
  });

  it("classifica 400 com a marca de timeout do backend como backend_timeout", () => {
    const detail = `O cálculo ${TIMEOUT_MESSAGE_MARKER} de 5.0s e foi interrompido.`;
    const error = classifyResponseError(400, detail);
    expect(error.kind).toBe("backend_timeout");
  });

  it("classifica qualquer outro status como server_error", () => {
    const error = classifyResponseError(500, undefined);
    expect(error.kind).toBe("server_error");
  });
});

describe("friendlyMessage", () => {
  it("usa o detail real do backend para invalid_expression", () => {
    const error = new ApiError("invalid_expression", "Nome não reconhecido: 'xyz'.", 400);
    expect(friendlyMessage(error)).toBe("Nome não reconhecido: 'xyz'.");
  });

  it("cai na cópia genérica quando invalid_expression não tem detail", () => {
    const error = new ApiError("invalid_expression", undefined, 400);
    expect(friendlyMessage(error)).toBe(
      "Não conseguimos interpretar essa expressão. Revise a escrita e tente novamente."
    );
  });

  it("usa a cópia oficial de rate limit, ignorando o detail do backend", () => {
    const error = new ApiError("rate_limited", "Muitas requisições. Tente novamente em instantes.", 429);
    expect(friendlyMessage(error)).toBe("Você fez muitas tentativas em pouco tempo. Aguarde um momento.");
  });

  it("usa a cópia oficial de timeout do backend", () => {
    const error = new ApiError("backend_timeout", "algo interno", 400);
    expect(friendlyMessage(error)).toBe("Esse cálculo levou mais tempo do que o permitido.");
  });

  it("usa a cópia oficial de timeout de rede", () => {
    const error = new ApiError("network_timeout");
    expect(friendlyMessage(error)).toBe("Esse cálculo levou mais tempo do que o permitido.");
  });

  it("usa a cópia oficial de indisponibilidade para erro de servidor e de rede", () => {
    expect(friendlyMessage(new ApiError("server_error"))).toBe(
      "O motor matemático está temporariamente indisponível."
    );
    expect(friendlyMessage(new ApiError("network_error"))).toBe(
      "O motor matemático está temporariamente indisponível."
    );
  });
});
