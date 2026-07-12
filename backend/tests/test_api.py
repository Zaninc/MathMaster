"""Testes de integração HTTP (Hardening II, Etapa 2) — cobrem os contratos
de `/health`, `/solve` e `/history` via `TestClient`, camada que a suíte de
compatibilidade (`test_regression_compat.py`) nunca exercita (ela chama
`solve_expression()`/`format_result()`/`render_math()` direto, pulando
`main.py`/FastAPI por completo).
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import app.main as main_module


def test_health_check(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_check_returns_ok_when_math_engine_works(client: TestClient) -> None:
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_check_returns_503_when_math_engine_raises(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _boom(expression: str) -> str:
        raise RuntimeError("bug interno simulado")

    monkeypatch.setattr(main_module, "solve_expression", _boom)
    response = client.get("/ready")
    assert response.status_code == 503


def test_ready_check_returns_503_when_result_is_unexpected(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(main_module, "solve_expression", lambda expression: "5")
    response = client.get("/ready")
    assert response.status_code == 503


def test_ready_check_does_not_affect_health_check_contract(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_solve_success(client: TestClient) -> None:
    response = client.post("/solve", json={"expression": "2+2"})
    assert response.status_code == 200
    body = response.json()
    assert body == {"expression": "2+2", "result": "4"}


def test_solve_expression_error_returns_400(client: TestClient) -> None:
    response = client.post("/solve", json={"expression": "circunferencia((0,0),0)"})
    assert response.status_code == 400
    body = response.json()
    assert "detail" in body
    assert "raio" in body["detail"].lower()


def test_solve_empty_expression_returns_422(client: TestClient) -> None:
    response = client.post("/solve", json={"expression": ""})
    assert response.status_code == 422


def test_solve_missing_field_returns_422(client: TestClient) -> None:
    response = client.post("/solve", json={})
    assert response.status_code == 422


def test_history_empty_by_default(client: TestClient) -> None:
    response = client.get("/history")
    assert response.status_code == 200
    assert response.json() == []


def test_history_records_successful_solves_most_recent_first(client: TestClient) -> None:
    client.post("/solve", json={"expression": "2+2"})
    client.post("/solve", json={"expression": "3+3"})

    response = client.get("/history")
    assert response.status_code == 200
    body = response.json()

    assert len(body) == 2
    assert body[0]["expression"] == "3+3"
    assert body[0]["result"] == "6"
    assert body[1]["expression"] == "2+2"
    assert body[1]["result"] == "4"
    assert "timestamp" in body[0] and "timestamp" in body[1]


def test_history_does_not_record_expression_errors(client: TestClient) -> None:
    client.post("/solve", json={"expression": "2+2"})
    client.post("/solve", json={"expression": "circunferencia((0,0),0)"})

    response = client.get("/history")
    body = response.json()

    assert len(body) == 1
    assert body[0]["expression"] == "2+2"


def test_cors_allows_configured_origin(client: TestClient) -> None:
    response = client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_cors_rejects_unlisted_origin(client: TestClient) -> None:
    response = client.get("/health", headers={"Origin": "http://evil.example.com"})
    assert "access-control-allow-origin" not in response.headers


# --- Sprint Parser: normalização Unicode via /solve, histórico preserva o original ---

def test_solve_unicode_expression_matches_ascii_equivalent(client: TestClient) -> None:
    ascii_response = client.post("/solve", json={"expression": "x**2-4=0"})
    unicode_response = client.post("/solve", json={"expression": "x²-4=0"})

    assert ascii_response.status_code == 200
    assert unicode_response.status_code == 200
    assert ascii_response.json()["result"] == unicode_response.json()["result"]


def test_solve_unicode_expression_response_echoes_original_input(client: TestClient) -> None:
    response = client.post("/solve", json={"expression": "x²-4=0"})
    assert response.status_code == 200
    assert response.json()["expression"] == "x²-4=0"


def test_history_preserves_original_unicode_expression(client: TestClient) -> None:
    # O HISTÓRICO guarda a expressão original digitada ("√(x+1)"), não a
    # versão normalizada internamente ("sqrt(x + 1)") usada pelo motor —
    # o resultado exibido já passa por render_sqrt() com suporte a
    # argumento composto (Sprint Formatter Fix), por isso "√(x + 1)".
    client.post("/solve", json={"expression": "√(x+1)"})

    response = client.get("/history")
    body = response.json()

    assert body[0]["expression"] == "√(x+1)"
    assert body[0]["result"] == "√(x + 1)"
