from typing import Literal

from pydantic import BaseModel, Field


class SolveRequest(BaseModel):
    expression: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Expressão matemática a ser resolvida.",
    )


class SolveResponse(BaseModel):
    expression: str
    result: str
    # Sprint V2.1 (apresentação progressiva) — aproximação numérica decimal,
    # só populada quando há uma útil (ver `math_engine.solve_expression_with_approx`).
    # `None` preserva o contrato antigo para todo consumidor que só lê `result`.
    approx: str | None = None


class HistoryItem(BaseModel):
    expression: str
    result: str
    approx: str | None = None
    timestamp: str


class TitleSegment(BaseModel):
    """Hotfix V2.9.1a — espelha `math_engine.steps.models.TitleSegment`.
    `content` de um segmento `math` é texto matemático puro (mesmo
    contrato de `StepItem.expression`), nunca LaTeX bruto."""

    type: Literal["text", "math"]
    content: str


class StepItem(BaseModel):
    """Sprint V2.9 (Passo a Passo) — espelha `math_engine.steps.MathStep`.
    `expression` é sempre texto matemático puro (nunca LaTeX bruto — ver
    `math_engine/steps/models.py`); o frontend converte via o pipeline já
    existente de `lib/math/to-latex.ts`.

    `title_segments` (Hotfix V2.9.1a) é uma evolução ADITIVA: `None` (o
    padrão, todo título anterior a este hotfix) significa "sem matemática
    embutida, exibir `title` como está"; quando presente, é a versão
    estruturada do MESMO `title` para títulos que misturam texto comum com
    fórmulas (ex. "Aplicando a fórmula de Bhaskara (x=...) — primeira
    raiz"). `title` nunca é removido — continua o fallback em texto puro."""

    title: str | None = None
    title_segments: list[TitleSegment] | None = None
    expression: str
    explanation: str | None = None


class StepsRequest(BaseModel):
    expression: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Equação ou sistema linear a resolver passo a passo.",
    )


class StepsResponse(BaseModel):
    expression: str
    result: str
    steps: list[StepItem]
