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

/**
 * Hotfix V2.9.1a — espelha `backend/app/schemas.py:TitleSegment`. `content`
 * de um segmento `math` é texto matemático puro (mesmo contrato de
 * `StepItem.expression`), nunca LaTeX bruto.
 */
export interface TitleSegment {
  type: "text" | "math";
  content: string;
}

/**
 * Sprint V2.9 (Passo a Passo) — espelha `backend/app/schemas.py:StepItem`.
 * `expression` é sempre texto matemático puro (nunca LaTeX bruto) — o
 * mesmo pipeline de `lib/math/to-latex.ts` já usado para o eco da
 * expressão/histórico converte cada passo.
 *
 * `title_segments` (Hotfix V2.9.1a) é aditivo: `null` (a maioria dos
 * títulos, ex. equações lineares) significa "sem matemática embutida,
 * exibir `title` como texto puro"; quando presente, é a versão
 * estruturada do MESMO `title` para títulos que misturam texto com
 * fórmulas (ex. a fórmula de Bhaskara) — `title` nunca é removido, continua
 * o fallback em texto puro. Nome do campo em snake_case de propósito
 * (mesmo "espelha EXATAMENTE" do resto deste arquivo) — Pydantic não tem
 * `alias_generator` configurado neste projeto, então o JSON real do
 * backend usa `title_segments`, nunca `titleSegments`.
 */
export interface StepItem {
  title: string | null;
  title_segments: TitleSegment[] | null;
  expression: string;
  explanation: string | null;
}

export interface StepsResponse {
  expression: string;
  result: string;
  steps: StepItem[];
}
