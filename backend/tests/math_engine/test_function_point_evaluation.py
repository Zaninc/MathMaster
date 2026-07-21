"""Avaliação direta de função na própria definição: "f(4)=3x^2-2x+5" deve
substituir x=4 no corpo e retornar o resultado, sem exigir a forma de duas
partes "f(x)=...; f(4)" que já existia. Ver `functions/dispatcher.py`,
`_evaluate_function_at_point`."""
from __future__ import annotations

import pytest

from app.math_engine.dispatcher import solve_expression
from app.math_engine.errors import ExpressionError


@pytest.mark.parametrize(
    "expression, expected",
    [
        ("f(4)=3x^2-2x+5", "f(4) = 45"),
        ("f(4)=3x²-2x+5", "f(4) = 45"),
        ("f(-2)=x^2+3x-1", "f(-2) = -3"),
        ("f(1/2)=2x+3", "f(1/2) = 4"),
        ("f(pi/2)=sin(x)+cos(x)", "f(pi/2) = 1"),
        ("f(pi/2)=sen(x)+cos(x)", "f(pi/2) = 1"),
        ("f(3)=(x^2+1)/(x-1)", "f(3) = 5"),
        ("f(1)=(x^2+1)/(x-1)", "f(1) = indefinido em x = 1"),
    ],
)
def test_direct_point_evaluation(expression: str, expected: str) -> None:
    assert solve_expression(expression) == expected


def test_definition_syntax_still_works() -> None:
    # Comportamento pré-existente (declaração de variável) não pode regredir.
    assert "Tipo: função quadrática" in solve_expression("f(x)=x^2")


def test_two_part_evaluation_syntax_still_works() -> None:
    # Sintaxe já suportada antes desta mudança: definição + avaliação
    # separadas por ";".
    assert solve_expression("f(x)=3*x^2-2*x+5; f(4)") == "f(4) = 45"


def test_ambiguous_body_raises_clear_error() -> None:
    with pytest.raises(ExpressionError):
        solve_expression("f(4)=a*x+b")


def test_symbolic_point_raises_clear_error() -> None:
    with pytest.raises(ExpressionError):
        solve_expression("f(x+1)=x^2")
