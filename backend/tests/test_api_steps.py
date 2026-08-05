"""Sprint V2.9 (Passo a Passo) — contrato HTTP de `POST /solve/steps`, e
regressão explícita de que `/solve` continua 100% intocado (mesmo
contrato `{expression, result, approx}`, ver CLAUDE_RULES.md)."""
from __future__ import annotations

from fastapi.testclient import TestClient


def test_solve_steps_success(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "2*x+4=10"})
    assert response.status_code == 200
    body = response.json()
    assert body["expression"] == "2*x+4=10"
    assert body["result"] == "x = 3"
    assert isinstance(body["steps"], list)
    assert body["steps"][0]["title"] == "Equação inicial"
    assert body["steps"][-1]["expression"] == "x=3"


def test_solve_steps_quadratic(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "x**2-9=0"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "x₁ = -3, x₂ = 3"
    expressions = {s["expression"] for s in body["steps"]}
    assert {"x=3", "x=-3"} <= expressions


def test_solve_steps_system(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "x+y=5\nx-y=1"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "x = 3, y = 2"
    assert body["steps"][-1]["expression"] == "x=3, y=2"


def test_solve_steps_unsupported_domain_returns_400(client: TestClient) -> None:
    # Sprint V2.9.1 — grau 2 já é suportado; grau 3 continua fora de escopo.
    response = client.post("/solve/steps", json={"expression": "x**3+2=6"})
    assert response.status_code == 400
    assert "lineares e quadráticas" in response.json()["detail"]


def test_solve_steps_three_by_three_returns_friendly_400(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "x+y+z=6\nx-y=0\ny-z=1"})
    assert response.status_code == 400
    assert "mais de duas incógnitas" in response.json()["detail"]


def test_solve_steps_invalid_expression_returns_400(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "2x+=10"})
    assert response.status_code == 400


def test_solve_endpoint_contract_unchanged_by_steps_feature(client: TestClient) -> None:
    response = client.post("/solve", json={"expression": "2*x+4=10"})
    assert response.status_code == 200
    assert response.json() == {"expression": "2*x+4=10", "result": "x = 3", "approx": None}


def test_solve_steps_step_item_has_optional_title_and_explanation(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "2*x+4=10"})
    for step in response.json()["steps"]:
        assert "expression" in step
        assert "title" in step
        assert "explanation" in step
