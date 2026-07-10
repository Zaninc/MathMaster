"""Fixtures compartilhadas pela suíte pytest do backend (Hardening II).

`reset_history` roda automaticamente antes/depois de cada teste porque
`app.history` guarda estado em uma lista de módulo (ver history.py,
Sprint 2 — em memória, documentado como intencional para o V0) — sem
isso, testes que chamam `/solve` vazariam histórico de um teste para o
próximo. Importa o objeto `_history` diretamente (em vez de adicionar uma
função de limpeza só para teste em history.py) para não introduzir código
de produção que só existe para dar suporte à suíte.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.history import _history
from app.main import app


@pytest.fixture(autouse=True)
def reset_history():
    _history.clear()
    yield
    _history.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def client_no_raise() -> TestClient:
    """Starlette's TestClient re-raises unhandled exceptions by default (for
    easier debugging) instead of returning the 500 response the real ASGI
    server would send — only the tests that specifically exercise the
    generic exception handler need `raise_server_exceptions=False`."""
    return TestClient(app, raise_server_exceptions=False)
