"""Hardening II, Etapa 6 — cobre o fallback factor -> simplify -> raw de
`algebra/dispatcher.py` (só "2+2" e "(x-1)*(x+1)" eram testados antes)."""
from __future__ import annotations

import pytest

from app.formatter.pipeline import format_result
from app.formatter.renderer import render_math
from app.math_engine.dispatcher import solve_expression


def _solve(expression: str) -> str:
    raw = solve_expression(expression)
    return render_math(format_result(expression, raw))


@pytest.mark.parametrize(
    "expression, expected",
    [
        ("x/x", "1"),  # factor não se aplica; simplify resolve
        ("2*x + 3*x", "5*x"),  # factor trivial
        ("sqrt(8)", "2*√2"),  # simplify (radsimp)
        ("(x**2-1)/(x-1)", "x + 1"),  # cancelamento de fator comum
        ("x**2 + 2*x + 1", "(x + 1)²"),  # factor não trivial
    ],
)
def test_algebra_fallback_chain(expression: str, expected: str) -> None:
    assert _solve(expression) == expected
