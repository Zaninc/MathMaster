"""Módulo/valor absoluto via notação "|expr|", reescrita para "Abs(expr)" em
`parser/normalize.py` ANTES do roteamento de domínio — `Abs` em si já era
suportado (classificação modular, equações, avaliação direta de função); o
gap era só léxico. Ver `normalize.py:_rewrite_absolute_value`."""
from __future__ import annotations

import pytest

from app.math_engine.dispatcher import solve_expression


@pytest.mark.parametrize(
    "expression, expected",
    [
        ("f(2)=|x-5|", "f(2) = 3"),
        ("f(-3)=|x|", "f(-3) = 3"),
        ("f(0)=|x^2-9|", "f(0) = 9"),
        ("f(2)=|x^2-4|", "f(2) = 0"),
        ("f(5)=|sen(x)|", "f(5) = -sin(5)"),
    ],
)
def test_pipe_notation_direct_evaluation(expression: str, expected: str) -> None:
    assert solve_expression(expression) == expected


def test_pipe_notation_function_definition() -> None:
    assert solve_expression("f(x)=|x|") == (
        "Tipo: função modular; Domínio: ℝ; Raiz: x = 0; Intercepto em y: (0, 0)"
    )


def test_abs_call_syntax_still_works() -> None:
    # Sintaxe pré-existente (sem pipes) não pode regredir.
    assert solve_expression("f(x)=Abs(x)") == (
        "Tipo: função modular; Domínio: ℝ; Raiz: x = 0; Intercepto em y: (0, 0)"
    )


def test_pipe_notation_equation_still_routes_to_equations_domain() -> None:
    # |x-3|=5 é uma equação modular (duas raízes), não uma definição de
    # função chamada "Abs" — não pode ser roubada pelo domínio de funções.
    assert solve_expression("|x-3|=5") == "{-2, 8}"


def test_unicode_pipe_input_matches_ascii() -> None:
    # Notação real que o usuário digita (unicode ², −) produz o mesmo
    # resultado que a forma ASCII equivalente.
    assert solve_expression("f(2)=|x²−4|") == solve_expression("f(2)=|x^2-4|")
