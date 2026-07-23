"""Sprint V2.1 (apresentação progressiva) — cobre:

- somatórios transcendentes que não colapsam para poucos termos ficam na
  própria notação Σ compacta como `result` (nunca a expansão de dezenas de
  termos), preservando o valor exato;
- `SolveResponse.approx`/`HistoryItem.approx`: aproximação numérica decimal
  populada só quando há uma útil (nunca para inteiros exatos ou resultados
  com parâmetro livre);
- `solve_expression`/`solve_expression_with_timeout` continuam devolvendo
  só uma string — nenhuma outra área do motor é afetada pelo contrato novo.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.math_engine import solve_expression, solve_expression_with_approx
from app.math_engine.summation.evaluator import evaluate_summation
from app.math_engine.summation.parsing import parse_summation_expression


def _approx(expression: str) -> str | None:
    _, approx = solve_expression_with_approx(expression)
    return approx


# --- Notação compacta como valor exato (não expande dezenas de termos) ----


def test_transcendental_sum_with_many_terms_stays_in_sigma_notation() -> None:
    result, _ = solve_expression_with_approx("Σ(i=1..30) sin(i)")
    assert result == "Σ(i=1..30) sin(i)"


def test_eleven_term_sine_cosine_sum_stays_compact_instead_of_expanding() -> None:
    # 11 termos (> EXPAND_LIMIT=10, mesmo limite de steps.py) — não colapsa
    # (22 átomos trigonométricos, acima do limite de `_bounded_trigsimp`).
    result, _ = solve_expression_with_approx("Σ(i=1..11) (sin(i)+cos(i))")
    assert result == "Σ(i=1..11) (sin(i)+cos(i))"


def test_exactly_ten_term_sum_still_expands_same_boundary_as_steps() -> None:
    # BUG 1 original (Σ(i=1..10) (sin(i)+cos(i))): exatamente 10 termos,
    # igual ao limite — expande normalmente (mesma fronteira de
    # `steps.EXPAND_LIMIT`), continua exercitando o wrapper de rolagem do
    # ResultPanel/HistoryPanel para este caso específico.
    result, _ = solve_expression_with_approx("Σ(i=1..10) (sin(i)+cos(i))")
    assert result != "Σ(i=1..10) (sin(i)+cos(i))"
    assert "sin(1)" in result and "cos(10)" in result


def test_small_pythagorean_sum_still_collapses_via_bounded_trigsimp() -> None:
    # 10 átomos trigonométricos (5 sin + 5 cos) — dentro do limite de
    # `_bounded_trigsimp`: continua colapsando para "5", nunca vira Σ
    # compacta (o valor JÁ é curto, não há nada para compactar).
    result, approx = solve_expression_with_approx("Σ(i=1..5) sin(i)^2 + cos(i)^2")
    assert result == "5"
    assert approx is None  # inteiro exato — aproximação seria redundante


def test_sum_with_few_terms_stays_expanded_even_if_it_does_not_collapse() -> None:
    # Só 3 termos (abaixo do limite) — expande normalmente mesmo sem forma
    # fechada mais curta, igual ao comportamento de antes desta sprint.
    # Ordem de impressão do SymPy não é a ordem de inserção (canônica,
    # própria do Add) — verifica presença dos 3 termos, não a ordem exata.
    result, _ = solve_expression_with_approx("Σ(i=1..3) sin(i)")
    assert result != "Σ(i=1..3) sin(i)"
    for term in ["sin(1)", "sin(2)", "sin(3)"]:
        assert term in result


def test_sum_that_fully_collapses_with_many_terms_is_not_forced_compact() -> None:
    # 30 termos, mas o total É um inteiro limpo — mostra "465" normalmente,
    # nunca a notação Σ (só existe para o caso que genuinamente não colapsa).
    result, _ = solve_expression_with_approx("Σ(i=1..30) i")
    assert result == "465"


def test_compact_notation_preserves_body_text_after_normalization() -> None:
    # A notação compacta reaproveita `node.expression`, que já passou pela
    # MESMA normalização textual (Unicode -> ASCII) que roda antes de
    # qualquer roteamento de domínio — "i²" já chega em `node.expression`
    # como "i**2" (a entrada ORIGINAL do usuário, essa sim com "i²", é
    # preservada à parte por `request.expression`, nunca por este texto).
    result, _ = solve_expression_with_approx("Σ(i=1..15) ((i²+1)/(2*i)+sin(i))")
    assert result == "Σ(i=1..15) ((i**2+1)/(2*i)+sin(i))"


# --- Aproximação numérica -------------------------------------------------


def test_approx_is_none_for_clean_integer_result() -> None:
    assert _approx("Σ(i=1..10) i") is None


def test_approx_is_none_for_result_with_free_parameter() -> None:
    assert _approx("Σ(i=1..3) a*i") is None


def test_approx_is_populated_for_rational_result() -> None:
    approx = _approx("Σ(i=1..5) ((i²+1)/(2*i))")
    assert approx is not None
    assert approx.startswith("8.64")


def test_approx_is_populated_for_transcendental_sum() -> None:
    approx = _approx("Σ(i=1..30) sin(i)")
    assert approx is not None
    float(approx)  # é um decimal de verdade, não uma forma simbólica


def test_approx_numerically_matches_the_exact_value() -> None:
    node = parse_summation_expression("Σ(i=1..30) sin(i)")
    exact_total = evaluate_summation(node)
    approx = _approx("Σ(i=1..30) sin(i)")
    assert approx is not None
    assert abs(float(approx) - float(exact_total.evalf())) < 1e-6


def test_approx_is_none_for_non_summation_expressions() -> None:
    # Escopo consciente desta sprint: só somatório calcula aproximação.
    assert _approx("2+2") is None
    assert _approx("x**2 - 4 = 0") is None
    assert _approx("integral(x**2, x)") is None


# --- Contrato preservado ---------------------------------------------------


def test_solve_expression_contract_is_completely_unchanged() -> None:
    # `solve_expression` (usado por /ready e por toda a suíte pré-existente)
    # continua devolvendo só uma string — o par (exato, approx) só existe
    # na função nova.
    assert solve_expression("2+2") == "4"
    assert isinstance(solve_expression("Σ(i=1..30) sin(i)"), str)


def test_solve_expression_with_approx_matches_solve_expression_for_the_exact_part() -> None:
    for expression in ["2+2", "x**2 - 4 = 0", "Σ(i=1..10) i", "Σ(i=1..30) sin(i)"]:
        result, _ = solve_expression_with_approx(expression)
        assert result == solve_expression(expression)


# --- Integração HTTP e histórico -------------------------------------------


def test_solve_endpoint_returns_approx_field_for_transcendental_sum(client: TestClient) -> None:
    response = client.post("/solve", json={"expression": "Σ(i=1..30) sin(i)"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Σ(i=1..30) sin(i)"
    assert body["approx"] is not None
    float(body["approx"])


def test_solve_endpoint_omits_approx_for_clean_results(client: TestClient) -> None:
    response = client.post("/solve", json={"expression": "Σ(i=1..10) i"})
    assert response.status_code == 200
    assert response.json()["approx"] is None


def test_solve_endpoint_omits_approx_for_non_summation_domains(client: TestClient) -> None:
    response = client.post("/solve", json={"expression": "2+2"})
    assert response.status_code == 200
    assert response.json() == {"expression": "2+2", "result": "4", "approx": None}


def test_history_stores_the_compact_result_and_its_approx(client: TestClient) -> None:
    client.post("/solve", json={"expression": "Σ(i=1..30) sin(i)"})
    history = client.get("/history").json()
    assert history[0]["expression"] == "Σ(i=1..30) sin(i)"
    assert history[0]["result"] == "Σ(i=1..30) sin(i)"  # compacto, nunca a expansão
    assert history[0]["approx"] is not None


def test_history_approx_is_null_when_solve_did_not_produce_one(client: TestClient) -> None:
    client.post("/solve", json={"expression": "2+2"})
    history = client.get("/history").json()
    assert history[0]["result"] == "4"
    assert history[0]["approx"] is None
