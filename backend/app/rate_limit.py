"""Hardening III, Etapa 7 — rate limiting simples por IP em `/solve`.

Janela deslizante em memória, por IP, sem infraestrutura nova (Redis etc.)
— consistente com o padrão já usado pelo histórico (`app/history.py`,
Etapa 6): estado em memória, aceitável para o V0 de 1 worker. A mesma
limitação documentada lá se aplica aqui: isso protege contra abuso DENTRO
de um mesmo processo, não entre múltiplos workers (`uvicorn --workers
N>1`), que teriam cada um sua própria contagem independente.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.config import settings

_WINDOW_SECONDS = 60.0

_requests_by_ip: dict[str, deque[float]] = defaultdict(deque)
_lock = threading.Lock()
_now = time.monotonic


def _client_ip(request: Request) -> str:
    if request.client is None:
        return "unknown"
    return request.client.host


def enforce_rate_limit(request: Request) -> None:
    """Dependency do FastAPI: levanta 429 se o IP do cliente já fez
    `settings.rate_limit_per_minute` requisições ou mais nos últimos 60
    segundos. Só se aplica onde é injetada como dependência (ex.: `/solve`)
    — não afeta nenhum outro endpoint que não a declare.
    """
    ip = _client_ip(request)
    now = _now()
    with _lock:
        timestamps = _requests_by_ip[ip]
        cutoff = now - _WINDOW_SECONDS
        while timestamps and timestamps[0] < cutoff:
            timestamps.popleft()
        if len(timestamps) >= settings.rate_limit_per_minute:
            raise HTTPException(
                status_code=429,
                detail="Muitas requisições. Tente novamente em instantes.",
            )
        timestamps.append(now)
