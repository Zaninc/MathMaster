"""Sprint V2.6 — cobre `polynomials/`: fatorar, expandir, simplificar, grau,
coeficientes, raízes (reais e complexas), divisão, aliases PT-BR/ASCII,
ordem da cascata (polynomials antes de calculus/functions/trigonometry/
logarithms/equations), validações (polinômio de uma única variável, corpo
que não é um polinômio genuíno, divisor nulo) e não-regressão das áreas
existentes."""
from __future__ import annotations

import pytest

from app.formatter.pipeline import format_result
from app.formatter.renderer import render_math
from app.math_engine.dispatcher import solve_expression
from app.math_engine.errors import ExpressionError
from app.math_engine.polynomials.dispatcher import (
    is_polynomial_domain_expression,
    solve_polynomial_text,
)


def _solve(expression: str) -> str:
    raw = solve_expression(expression)
    return render_math(format_result(expression, raw))


# --- fatorar -----------------------------------------------------------


def test_factor_difference_of_squares() -> None:
    assert _solve("fatorar(x²-9)") == "(x - 3)(x + 3)"


def test_factor_trinomial() -> None:
    assert _solve("fatorar(x²+5x+6)") == "(x + 2)(x + 3)"


def test_factor_difference_of_cubes() -> None:
    assert _solve("fatorar(x³-1)") == "(x - 1)(x² + x + 1)"


def test_factor_ascii_caret_syntax() -> None:
    assert _solve("fatorar(x^2-4)") == "(x - 2)(x + 2)"


# --- expandir ------------------------------------------------------------
#
# Rótulo "Expandido: " deliberado — ver `polynomials/formatter.py:
# format_expanded` para o motivo (protege o resultado de ser silenciosamente
# refatorado de volta pelo `formatter/expr_clean.py:clean_expr`, que
# prefere a representação mais curta).


def test_expand_cube_of_binomial() -> None:
    assert _solve("expandir((x+2)³)") == "Expandido: x³ + 6x² + 12x + 8"


def test_expand_difference_of_squares() -> None:
    assert _solve("expandir((x-1)(x+1))") == "Expandido: x² - 1"


def test_expand_sixth_power_does_not_collapse_back_to_factored_form() -> None:
    # Regressão do bug real encontrado durante o desenvolvimento: sem o
    # rótulo, `format_result`/`clean_expr` refatorava "(x+1)⁶" de volta,
    # desfazendo silenciosamente a expansão pedida.
    assert _solve("expandir((x+1)^6)") == (
        "Expandido: x⁶ + 6x⁵ + 15x⁴ + 20x³ + 15x² + 6x + 1"
    )


# --- simplificar -----------------------------------------------------------


def test_simplify_cancels_common_binomial_factor() -> None:
    assert _solve("simplificar((x²-1)/(x-1))") == "x + 1"


def test_simplify_combines_like_terms_over_constant_denominator() -> None:
    assert _solve("simplificar((x²+2x+x²)/2)") == "x² + x"


# --- grau --------------------------------------------------------------


def test_degree_of_quintic() -> None:
    assert _solve("grau(x⁸+x)") == "8"


def test_degree_of_constant_is_zero() -> None:
    assert _solve("grau(7)") == "0"


def test_degree_of_zero_polynomial_is_negative_infinity() -> None:
    # Convenção do próprio SymPy (`Poly(0, x).degree() == -oo`), adotada
    # sem alteração e documentada explicitamente (ver `evaluator.py`).
    assert _solve("grau(0)") == "-∞"


def test_degree_rejects_non_polynomial_body() -> None:
    with pytest.raises(ExpressionError, match=r"não é um polinômio"):
        _solve("grau(sin(x))")


def test_degree_rejects_more_than_one_free_variable() -> None:
    with pytest.raises(ExpressionError, match=r"uma única variável"):
        _solve("grau(x²+y²)")


# --- coeficientes ------------------------------------------------------


def test_coefficients_include_intermediate_zero() -> None:
    assert _solve("coeficientes(x⁴+2x²-7)") == "[1, 0, 2, 0, -7]"


def test_coefficients_of_cubic_with_missing_linear_term() -> None:
    assert _solve("coeficientes(x³+2x²-5)") == "[1, 2, 0, -5]"


def test_coefficients_of_quadratic_with_missing_linear_term() -> None:
    assert _solve("coeficientes(3x²-7)") == "[3, 0, -7]"


# --- raízes --------------------------------------------------------------


def test_roots_of_difference_of_squares() -> None:
    assert _solve("raizes(x²-9)") == "x₁ = -3, x₂ = 3"


def test_roots_accented_alias() -> None:
    assert _solve("raízes(x²-9)") == "x₁ = -3, x₂ = 3"


def test_roots_of_cubic_all_real() -> None:
    assert _solve("raízes(x³-6x²+11x-6)") == "x₁ = 1, x₂ = 2, x₃ = 3"


def test_roots_accepts_complex_roots() -> None:
    assert _solve("raízes(x²+1)") == "x₁ = -i, x₂ = i"


def test_roots_of_nonzero_constant_has_none() -> None:
    assert _solve("raizes(5)") == "Nenhuma raiz"


# --- divisão -------------------------------------------------------------


def test_division_exact_cubic_by_binomial() -> None:
    assert _solve("divisão(x³-1,x-1)") == "Quociente: x² + x + 1; Resto: 0"


def test_division_ascii_alias() -> None:
    assert _solve("divisao(x³-1,x-1)") == "Quociente: x² + x + 1; Resto: 0"


def test_division_quartic_by_quadratic() -> None:
    assert _solve("divisão(x⁴-1,x²+1)") == "Quociente: x² - 1; Resto: 0"


def test_division_with_nonzero_remainder() -> None:
    assert _solve("divisao(x²+1,x-1)") == "Quociente: x + 1; Resto: 2"


def test_division_by_zero_raises_friendly_error() -> None:
    with pytest.raises(ExpressionError, match=r"divisor nulo"):
        _solve("divisao(x²-1,0)")


def test_division_wrong_argument_count_raises() -> None:
    with pytest.raises(ExpressionError, match=r"2 argumentos"):
        _solve("divisao(x²-1)")


def test_division_rejects_more_than_one_free_variable() -> None:
    with pytest.raises(ExpressionError, match=r"uma única variável"):
        _solve("divisao(x²-y²,x-y)")


# --- roteamento / cascata --------------------------------------------------


def test_is_polynomial_domain_expression_requires_whole_string_call() -> None:
    assert is_polynomial_domain_expression("fatorar(x²-9)") is True
    assert is_polynomial_domain_expression("2*fatorar(x²-9)") is False
    assert is_polynomial_domain_expression("fatorar(x²-9) + 1") is False


def test_polynomial_call_is_routed_before_trigonometry() -> None:
    # "grau(sin(x)+1)" contém "sin(" — se trigonometria fosse checada
    # antes, essa chamada seria roubada e nunca chegaria a `polynomials/`
    # (que rejeita com a mensagem específica "não é um polinômio", prova de
    # que foi esta área que processou a chamada).
    with pytest.raises(ExpressionError, match=r"não é um polinômio"):
        _solve("grau(sin(x)+1)")


def test_polynomial_call_is_routed_before_equations() -> None:
    # "grau(x**2-9)" não deve ser confundido com uma equação, mesmo
    # contendo dígitos/operadores que também aparecem em equações.
    assert _solve("grau(x**2-9)") == "2"


def test_unknown_polynomial_operation_name_falls_through_untouched() -> None:
    # "raiz(" (sem o "es" final) não é nenhuma das sete operações
    # reconhecidas — não deve ser roubado por `polynomials/`, precisa cair
    # no roteamento normal (aqui, alias de raiz quadrada de `algebra/`).
    assert is_polynomial_domain_expression("raiz(9)") is False


def test_solve_polynomial_text_raises_for_non_matching_expression() -> None:
    with pytest.raises(ExpressionError):
        solve_polynomial_text("x + 1")


# --- não regressão de outras áreas ------------------------------------


def test_bare_expression_without_call_syntax_is_unaffected() -> None:
    # Sem a sintaxe de chamada, "x^2-9" continua caindo no fallback padrão
    # de álgebra (factor -> simplify -> raw), comportamento anterior à
    # Sprint V2.6, sem nenhuma mudança.
    assert _solve("x^2-9") == "(x - 3)(x + 3)"


def test_quadratic_equation_is_unaffected() -> None:
    assert _solve("x^2-9=0") == "x₁ = -3, x₂ = 3"
