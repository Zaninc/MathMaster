"""Hardening II, Etapa 5 — limite de tamanho de `expression` (schemas.py)
e cap de tamanho do histórico em memória (history.py)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.history import _history, add_entry, get_history


def test_expression_within_max_length_is_accepted(client: TestClient) -> None:
    expression = "1+" * 499 + "1"  # 999 caracteres, dentro do limite de 1000
    response = client.post("/solve", json={"expression": expression})
    assert response.status_code == 200


def test_expression_over_max_length_is_rejected(client: TestClient) -> None:
    expression = "1+" * 501  # 1002 caracteres, acima do limite de 1000
    response = client.post("/solve", json={"expression": expression})
    assert response.status_code == 422


def test_history_is_capped_at_configured_max_entries(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.history as history_module

    monkeypatch.setattr(history_module.settings, "history_max_entries", 3)

    for i in range(5):
        add_entry(f"expr{i}", f"result{i}")

    assert len(_history) == 3
    # As mais antigas (expr0, expr1) foram descartadas; as 3 mais recentes
    # permanecem, na ordem de inserção original dentro da lista interna.
    assert [entry["expression"] for entry in _history] == ["expr2", "expr3", "expr4"]


def test_get_history_still_returns_most_recent_first_when_capped(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.history as history_module

    monkeypatch.setattr(history_module.settings, "history_max_entries", 2)

    for i in range(4):
        add_entry(f"expr{i}", f"result{i}")

    ordered = get_history()
    assert [entry["expression"] for entry in ordered] == ["expr3", "expr2"]
