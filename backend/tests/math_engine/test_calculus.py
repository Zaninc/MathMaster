"""Sprint 12 — cobre `calculus/`: derivada, integral (indefinida e
definida), limite bilateral, e os casos de rejeição explícita (integral não
avaliada, integral definida divergente, limite oscilante/lados
discordantes). Também cobre a ordem da cascata (cálculo antes de
trigonometria) e a denylist de nomes reservados."""
from __future__ import annotations

import pytest

from app.formatter.pipeline import format_result
from app.formatter.renderer import render_math
from app.math_engine.dispatcher import solve_expression
from app.math_engine.errors import ExpressionError


def _solve(expression: str) -> str:
    raw = solve_expression(expression)
    return render_math(format_result(expression, raw))


def test_derivative_of_polynomial() -> None:
    assert _solve("derivada(x**2+3*x, x)") == "Derivada: 2x + 3"


def test_derivative_of_log_uses_base10_convention() -> None:
    assert _solve("derivada(log(x), x)") == "Derivada: 1/(x*ln(10))"


def test_indefinite_integral_of_polynomial_shows_constant() -> None:
    assert _solve("integral(x**2, x)") == "Integral: x³/3 + C"


def test_indefinite_integral_of_sin() -> None:
    assert _solve("integral(sin(x), x)") == "Integral: -cos(x) + C"


def test_definite_integral() -> None:
    assert _solve("integral(x**2, x, 0, 2)") == "Integral definida: 8/3"


def test_limit_removable_singularity() -> None:
    assert _solve("limite(sin(x)/x, x, 0)") == "Limite: 1"


def test_limit_at_infinity() -> None:
    assert _solve("limite(1/x, x, oo)") == "Limite: 0"


def test_limit_diverging_sides_raises_without_leaking_internal_repr() -> None:
    with pytest.raises(ExpressionError) as exc_info:
        _solve("limite(1/x, x, 0)")
    message = str(exc_info.value)
    assert "não existe" in message
    assert "limites laterais são diferentes" in message
    # Não deve vazar o repr interno dos lados calculados (-oo/oo).
    assert "oo" not in message


def test_limit_oscillating_raises_without_leaking_accumbounds_repr() -> None:
    with pytest.raises(ExpressionError) as exc_info:
        _solve("limite(sin(1/x), x, 0)")
    message = str(exc_info.value)
    assert "não existe" in message
    assert "oscila" in message
    assert "AccumBounds" not in message


def test_indefinite_integral_without_closed_form_raises() -> None:
    with pytest.raises(ExpressionError, match=r"[Nn]ão foi possível calcular"):
        _solve("integral(x**x, x)")


def test_definite_integral_diverges_raises() -> None:
    with pytest.raises(ExpressionError, match=r"diverge"):
        _solve("integral(1/x, x, -1, 1)")


def test_calculus_is_routed_before_trigonometry() -> None:
    # "integral(sin(x), x)" contém "sin(" — se trigonometry fosse checado
    # antes de calculus na cascata, essa chamada seria roubada e nunca
    # chegaria como uma integral.
    assert _solve("integral(sin(x), x)") == "Integral: -cos(x) + C"


def test_derivative_wrong_argument_count_raises() -> None:
    with pytest.raises(ExpressionError, match=r"2 argumentos"):
        _solve("derivada(x**2)")


def test_reserved_calculus_name_is_not_stolen_as_function_definition() -> None:
    with pytest.raises(ExpressionError, match=r"[Nn]ão reconhecido|[Nn]ão foi possível"):
        _solve("derivada(x) = 5")
