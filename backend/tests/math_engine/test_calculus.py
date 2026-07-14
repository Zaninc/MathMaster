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


# --- Sprint 12.1: notação natural de cálculo — paridade com a sintaxe técnica ---


def test_natural_derivative_notation_matches_technical_syntax() -> None:
    assert _solve("d/dx(x**2+3*x)") == _solve("derivada(x**2+3*x, x)")


def test_natural_indefinite_integral_notation_matches_technical_syntax() -> None:
    assert _solve("∫x**2 dx") == _solve("integral(x**2, x)")


def test_natural_integral_of_sin_is_routed_before_trigonometry() -> None:
    # Mesma garantia de test_calculus_is_routed_before_trigonometry, agora
    # também para a entrada em notação natural (∫sin(x)dx contém "sin(").
    assert _solve("∫ sin(x) dx") == "Integral: -cos(x) + C"


def test_natural_definite_integral_ascii_bounds_matches_technical_syntax() -> None:
    assert _solve("∫_0^2 x**2 dx") == _solve("integral(x**2, x, 0, 2)")


def test_natural_definite_integral_unicode_bounds_matches_technical_syntax() -> None:
    assert _solve("∫₀²x**2 dx") == _solve("integral(x**2, x, 0, 2)")


def test_natural_limit_notation_matches_technical_syntax() -> None:
    assert _solve("lim x→0 sin(x)/x") == _solve("limite(sin(x)/x, x, 0)")
    assert _solve("lim(x→0) sin(x)/x") == _solve("limite(sin(x)/x, x, 0)")
    assert _solve("lim_{x→0} sin(x)/x") == _solve("limite(sin(x)/x, x, 0)")


def test_natural_limit_at_infinity_matches_technical_syntax() -> None:
    assert _solve("lim x→∞ 1/x") == _solve("limite(1/x, x, oo)")


def test_one_sided_limit_natural_notation_raises_dedicated_message() -> None:
    with pytest.raises(ExpressionError, match="laterais"):
        _solve("lim x→0+ 1/x")


def test_derivative_without_parentheses_falls_through_to_clean_rejection() -> None:
    # "d/dx x**2" (sem parênteses) não é reconhecido como notação natural
    # (ambíguo — ver auditoria da Sprint 12.1); "dx" sobra como identificador
    # de 2 letras não reconhecido, já rejeitado pelo safe_parsing existente.
    with pytest.raises(ExpressionError, match=r"[Nn]ão reconhecido|[Nn]ão foi possível"):
        _solve("d/dx x**2")
