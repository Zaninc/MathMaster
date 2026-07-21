"""Integração ponta a ponta: `Abs(...)` continua sendo a representação
interna em `math_engine` (parser/sympy intocados), mas o texto exibido ao
usuário (após `format_result`+`render_math`, o mesmo caminho de `/solve`)
mostra a notação tradicional "|...|". Ver `formatter/unicode_math.py:
render_abs` e `tests/formatter/test_unicode_math.py` para os testes
unitários da função em si."""
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
        ("Abs(x)", "|x|"),
        ("Abs(x^2-9)", "|x² - 9|"),
        ("Abs(Abs(x-3))", "|x - 3|"),
        ("f(2)=|x-5|", "f(2) = 3"),
        ("f(x)=|x|", "Tipo: função modular; Domínio: ℝ; Raiz: x = 0; Intercepto em y: (0, 0)"),
    ],
)
def test_abs_renders_as_pipes_in_final_output(expression: str, expected: str) -> None:
    assert _solve(expression) == expected


def test_abs_of_trig_sum_renders_pipes_with_merged_coefficient() -> None:
    # "Abs(sen(x)+cos(x))" simplifica para sqrt(2)*Abs(sin(x + pi/4))
    # internamente — o coeficiente numérico continua colado ao módulo,
    # igual à convenção já usada para √ ("3√2", não "3*√2").
    assert _solve("Abs(sen(x)+cos(x))") == (
        "Tipo: expressão trigonométrica; Resultado: √2|sin(x + π/4)|"
    )


def test_modular_equation_display_unaffected_by_abs_rendering() -> None:
    # Equação modular: o resultado final já usava outra notação (x₁/x₂),
    # não uma expressão "Abs(...)" pura — confirma que a mudança visual não
    # vazou pra esse formato distinto.
    assert _solve("|x-3|=5") == "x₁ = -2, x₂ = 8"
