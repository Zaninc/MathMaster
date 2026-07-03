from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.math_engine import ExpressionError, solve_expression
from app.schemas import SolveRequest, SolveResponse

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
        result = solve_expression(request.expression)
    except ExpressionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return SolveResponse(expression=request.expression, result=result)
