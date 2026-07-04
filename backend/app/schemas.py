from pydantic import BaseModel, Field


class SolveRequest(BaseModel):
    expression: str = Field(..., min_length=1, description="Expressão matemática a ser resolvida.")


class SolveResponse(BaseModel):
    expression: str
    result: str


class HistoryItem(BaseModel):
    expression: str
    result: str
    timestamp: str
