import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.execution import shutdown_active_processes, solve_expression_with_timeout
from app.formatter import format_result, render_math
from app.history import add_entry, get_history
from app.math_engine import ExpressionError, solve_expression
from app.rate_limit import enforce_rate_limit
from app.schemas import HistoryItem, SolveRequest, SolveResponse

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger("mathmaster")


# Hardening III, Etapa 4 — se o servidor for desligado com uma requisição
# ainda em voo (um processo de cálculo ainda vivo), garante que ele seja
# encerrado à força em vez de ficar órfão. Sem lógica de startup.
@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    shutdown_active_processes()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Hardening II — captura qualquer exceção que NÃO seja um HTTPException já
# tratado (ex.: um bug real de math_engine/formatter, não um ExpressionError
# esperado): loga o traceback completo no servidor, mas nunca expõe detalhes
# internos ao cliente. Starlette despacha para o handler mais específico
# registrado, então isso não intercepta HTTPException (400) nem
# RequestValidationError (422) — ambos continuam com o comportamento padrão
# do FastAPI, verificado empiricamente em tests/test_api.py.
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Erro não tratado em %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Erro interno do servidor."})


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


# Hardening III, Etapa 5 — diferente de `/health` (sempre "ok", sem
# dependências, para liveness): valida que o math_engine de fato resolve
# uma expressão trivial antes de reportar o serviço como pronto para
# receber tráfego (readiness). Chama `solve_expression` direto (sem
# isolamento por processo) porque é um check barato que um orquestrador
# pode sondar com frequência — não faz sentido pagar o custo de um `spawn`
# a cada poll de readiness. Não checa "pool de processos" porque a Etapa 3
# não usa um pool persistente (processo novo por requisição).
@app.get("/ready")
def readiness_check() -> dict[str, str]:
    try:
        result = solve_expression("2+2")
    except Exception as exc:
        logger.error("Readiness check falhou: %s", exc)
        raise HTTPException(status_code=503, detail="Serviço não está pronto.") from exc
    if result != "4":
        logger.error("Readiness check retornou resultado inesperado: %r", result)
        raise HTTPException(status_code=503, detail="Serviço não está pronto.")
    return {"status": "ok"}


@app.post("/solve", response_model=SolveResponse)
def solve(
    request: SolveRequest, _rate_limit: None = Depends(enforce_rate_limit)
) -> SolveResponse:
    try:
        raw_result = solve_expression_with_timeout(request.expression)
    except ExpressionError as exc:
        logger.warning("ExpressionError para %r: %s", request.expression, exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    result = render_math(format_result(request.expression, raw_result))
    add_entry(request.expression, result)
    logger.info("Resolvido: %r -> %r", request.expression, result)
    return SolveResponse(expression=request.expression, result=result)


@app.get("/history", response_model=list[HistoryItem])
def history() -> list[HistoryItem]:
    return get_history()
