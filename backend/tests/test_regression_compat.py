"""Suíte de compatibilidade (Sprints 4-11 + hotfix 11.1) portada do script
descartável `scripts/check_regression.py` para pytest (Hardening II, Etapa 1).

Mesma fonte de casos (`tests/fixtures/regression_cases.py`) usada pelos dois
runners enquanto `check_regression.py` ainda existir, para nunca divergirem.
Cada caso testa a composição completa `solve_expression()` ->
`format_result()` -> `render_math()`, byte a byte — é o canário de
compatibilidade mais rígido da suíte.
"""
from __future__ import annotations

import pytest

from app.formatter.pipeline import format_result
from app.formatter.renderer import render_math
from app.math_engine.dispatcher import solve_expression
from app.math_engine.errors import ExpressionError
from tests.fixtures.regression_cases import ERROR_CASES, EXACT_CASES


def _solve(expression: str) -> str:
    raw = solve_expression(expression)
    return render_math(format_result(expression, raw))


@pytest.mark.parametrize("expression, expected", EXACT_CASES)
def test_exact_output(expression: str, expected: str) -> None:
    assert _solve(expression) == expected


@pytest.mark.parametrize("expression", ERROR_CASES)
def test_raises_expression_error(expression: str) -> None:
    with pytest.raises(ExpressionError):
        _solve(expression)
