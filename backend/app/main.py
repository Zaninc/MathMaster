from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.formatter import format_result
from app.history import add_entry, get_history
from app.math_engine import ExpressionError, solve_expression
from app.schemas import HistoryItem, SolveRequest, SolveResponse

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/solve", response_model=SolveResponse)
def solve(request: SolveRequest) -> SolveResponse:
    try:
        raw_result = solve_expression(request.expression)
    except ExpressionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    result = format_result(request.expression, raw_result)
    add_entry(request.expression, result)
    return SolveResponse(expression=request.expression, result=result)


@app.get("/history", response_model=list[HistoryItem])
def history() -> list[HistoryItem]:
    return get_history()
