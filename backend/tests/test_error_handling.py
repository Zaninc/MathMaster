"""Hardening II, Etapa 3 — cobre o handler de exceção genérico e o logging
mínimo adicionados a `main.py`. Usa `monkeypatch` para forçar uma exceção
que NÃO é `ExpressionError` (simula um bug real do math_engine), já que
nenhum caminho legítimo hoje produz um erro não mapeado.
"""
from __future__ import annotations

import logging

import pytest
from fastapi.testclient import TestClient

import app.main as main_module


def test_unhandled_exception_returns_generic_500(
    client_no_raise: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _boom(expression: str) -> str:
        raise RuntimeError("bug interno simulado, nunca deveria vazar ao cliente")

    monkeypatch.setattr(main_module, "solve_expression", _boom)

    response = client_no_raise.post("/solve", json={"expression": "2+2"})

    assert response.status_code == 500
    assert response.json() == {"detail": "Erro interno do servidor."}
    assert "bug interno simulado" not in response.text


def test_unhandled_exception_is_logged(
    client_no_raise: TestClient, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    def _boom(expression: str) -> str:
        raise RuntimeError("bug interno simulado")

    monkeypatch.setattr(main_module, "solve_expression", _boom)

    with caplog.at_level(logging.ERROR, logger="mathmaster"):
        client_no_raise.post("/solve", json={"expression": "2+2"})

    assert any("Erro não tratado" in record.message for record in caplog.records)


def test_expression_error_is_logged_as_warning(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.WARNING, logger="mathmaster"):
        response = client.post("/solve", json={"expression": "circunferencia((0,0),0)"})

    assert response.status_code == 400
    assert any("ExpressionError" in record.message for record in caplog.records)


def test_successful_solve_is_logged_as_info(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO, logger="mathmaster"):
        response = client.post("/solve", json={"expression": "2+2"})

    assert response.status_code == 200
    assert any("Resolvido" in record.message for record in caplog.records)


def test_known_error_paths_unaffected_by_generic_handler(client: TestClient) -> None:
    # Confirma que registrar um handler para Exception não capturou os
    # handlers mais específicos que o FastAPI já registra por padrão.
    expression_error_response = client.post(
        "/solve", json={"expression": "circunferencia((0,0),0)"}
    )
    assert expression_error_response.status_code == 400

    validation_error_response = client.post("/solve", json={"expression": ""})
    assert validation_error_response.status_code == 422
