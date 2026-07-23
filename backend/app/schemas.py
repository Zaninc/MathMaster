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
