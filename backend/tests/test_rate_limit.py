"""Hardening III, Etapa 7 — testes de `app.rate_limit`."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import app.rate_limit as rate_limit_module
from app.rate_limit import enforce_rate_limit


class _FakeClient:
    def __init__(self, host: str) -> None:
        self.host = host


class _FakeRequest:
    def __init__(self, host: str) -> None:
        self.client = _FakeClient(host)


def test_solve_returns_429_when_rate_limit_exceeded(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(rate_limit_module.settings, "rate_limit_per_minute", 3)

    for _ in range(3):
        response = client.post("/solve", json={"expression": "2+2"})
        assert response.status_code == 200

    response = client.post("/solve", json={"expression": "2+2"})
    assert response.status_code == 429


def test_rate_limit_window_resets_after_time_passes(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(rate_limit_module.settings, "rate_limit_per_minute", 2)

    fake_time = 1_000.0
    monkeypatch.setattr(rate_limit_module, "_now", lambda: fake_time)

    assert client.post("/solve", json={"expression": "2+2"}).status_code == 200
    assert client.post("/solve", json={"expression": "2+2"}).status_code == 200
    assert client.post("/solve", json={"expression": "2+2"}).status_code == 429

    fake_time += 61  # passa da janela de 60s
    monkeypatch.setattr(rate_limit_module, "_now", lambda: fake_time)

    assert client.post("/solve", json={"expression": "2+2"}).status_code == 200


def test_health_check_is_not_rate_limited(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(rate_limit_module.settings, "rate_limit_per_minute", 2)

    for _ in range(10):
        response = client.get("/health")
        assert response.status_code == 200


def test_ready_check_is_not_rate_limited(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(rate_limit_module.settings, "rate_limit_per_minute", 2)

    for _ in range(10):
        response = client.get("/ready")
        assert response.status_code == 200


def test_history_endpoint_is_not_rate_limited(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(rate_limit_module.settings, "rate_limit_per_minute", 2)

    for _ in range(10):
        response = client.get("/history")
        assert response.status_code == 200


def test_different_ips_have_independent_budgets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(rate_limit_module.settings, "rate_limit_per_minute", 1)

    enforce_rate_limit(_FakeRequest("1.2.3.4"))  # consome o budget de 1.2.3.4
    with pytest.raises(Exception):
        enforce_rate_limit(_FakeRequest("1.2.3.4"))  # 1.2.3.4 já excedeu

    enforce_rate_limit(_FakeRequest("5.6.7.8"))  # budget próprio, não afetado
