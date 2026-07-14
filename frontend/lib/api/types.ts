/**
 * Espelha exatamente backend/app/schemas.py — única fonte de verdade dos
 * contratos entre frontend e backend nesta V1 (sem geração automática de
 * tipos a partir do OpenAPI ainda, ver ARCHITECTURE.md §5.2).
 */
export interface SolveRequest {
  expression: string;
}

export interface SolveResponse {
  expression: string;
  result: string;
}

export interface HistoryItem {
  expression: string;
  result: string;
  timestamp: string;
}
