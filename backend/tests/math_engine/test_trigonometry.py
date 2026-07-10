"""Hardening II, Etapa 6 — cobre `trigonometry/` fora dos valores notáveis
e da identidade fundamental: o branch GERAL (`simplify_trig` sem
classificação especial), erro de domínio de função inversa e rejeição de
inequação trigonométrica."""
from __future__ import annotations

import pytest

from app.formatter.pipeline import format_result
from app.formatter.renderer import render_math
from app.math_engine.dispatcher import solve_expression
from app.math_engine.errors import ExpressionError


def _solve(expression: str) -> str:
    raw = solve_expression(expression)
    return render_math(format_result(expression, raw))


def test_general_trig_expression_not_notable_or_identity() -> None:
    assert _solve("sin(x)+1") == "Tipo: expressão trigonométrica; Resultado: sin(x) + 1"


def test_inverse_trig_out_of_domain_raises() -> None:
    with pytest.raises(ExpressionError, match=r"fora do domínio"):
        _solve("asin(2)")


def test_trig_inequality_is_rejected_as_out_of_scope() -> None:
    with pytest.raises(ExpressionError, match=r"[Ii]nequaç"):
        _solve("sin(x)>0")
