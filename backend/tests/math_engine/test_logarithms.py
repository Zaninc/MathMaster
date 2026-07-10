"""Hardening II, Etapa 6 — cobre `logarithms/` fora da avaliação numérica
simples: o branch GERAL, e a validação de domínio via regex sobre o texto
bruto (log/ln de argumento literal <= 0, que o SymPy não rejeita
nativamente — ver domain.py)."""
from __future__ import annotations

import pytest

from app.formatter.pipeline import format_result
from app.formatter.renderer import render_math
from app.math_engine.dispatcher import solve_expression
from app.math_engine.errors import ExpressionError


def _solve(expression: str) -> str:
    raw = solve_expression(expression)
    return render_math(format_result(expression, raw))


def test_general_log_expression_combines_terms() -> None:
    assert _solve("log(x)+log(y)") == (
        "Tipo: expressão logarítmica/exponencial; "
        "Resultado: ln(x**(1/ln(10))*y**(1/ln(10)))"
    )


@pytest.mark.parametrize("expression", ["log(-5)", "log(0)", "ln(-1)", "ln(0)"])
def test_log_of_nonpositive_literal_raises(expression: str) -> None:
    with pytest.raises(ExpressionError, match=r"fora do domínio"):
        _solve(expression)
