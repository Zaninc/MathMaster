"""Hardening II, Etapa 6 — cobre os kinds de `functions/classification.py`
não exercitados pela suíte de compatibilidade (só QUADRATICA, LOGARITMICA
e EXPONENCIAL eram testados; AFIM/LINEAR/POLINOMIAL/RACIONAL/MODULAR/
TRANSCENDENTE nunca tinham nenhuma rede de segurança)."""
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
        ("f(x)=2*x+3", "Tipo: função afim; Domínio: ℝ; Raiz: x = -3/2; Intercepto em y: (0, 3)"),
        ("f(x)=2*x", "Tipo: função linear; Domínio: ℝ; Raiz: x = 0; Intercepto em y: (0, 0)"),
        (
            "f(x)=x**3-x",
            "Tipo: função polinomial; Domínio: ℝ; Raízes: x = -1, x = 0, x = 1; "
            "Intercepto em y: (0, 0)",
        ),
        (
            "f(x)=1/(x-2)",
            "Tipo: função racional; Domínio: ℝ - {2}; Raízes: nenhuma; "
            "Intercepto em y: (0, -1/2)",
        ),
        ("f(x)=Abs(x-3)", "Tipo: função modular; Domínio: ℝ; Raiz: x = 3; Intercepto em y: (0, 3)"),
        (
            "f(x)=sin(x)",
            "Tipo: função transcendente; Domínio: ℝ; Raízes: x = 0, x = π; "
            "Intercepto em y: (0, 0)",
        ),
        (
            "f(x)=sqrt(x)",
            "Tipo: função transcendente; Domínio: ℝ; Raiz: x = 0; Intercepto em y: (0, 0)",
        ),
    ],
)
def test_function_classification_kinds(expression: str, expected: str) -> None:
    assert _solve(expression) == expected
