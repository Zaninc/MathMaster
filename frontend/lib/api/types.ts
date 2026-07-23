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
  /**
   * Sprint V2.1 (apresentação progressiva) — aproximação numérica decimal,
   * populada só quando o backend tem uma útil (hoje: somatórios com
   * resultado numérico que não seja já um inteiro exato). `null` para todo
   * o resto — sempre trate como "não há aproximação para oferecer".
   */
  approx: string | null;
}

export interface HistoryItem {
  expression: string;
  result: string;
  approx: string | null;
  timestamp: string;
}
