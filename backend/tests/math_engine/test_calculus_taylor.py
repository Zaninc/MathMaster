"""Sprint V3.0.7 (Séries de Taylor e Maclaurin) — cobertura de
`calculus/taylor.py` via `/solve` (`solve_expression`/`solve_calculus_text`).

`taylor(expr, var, centro, ordem)` — REUTILIZA `compute_derivative`
(V3.0.6) pra cada f^(k); nenhum motor de derivação novo. Maclaurin é só
`taylor(expr, var, 0, ordem)`, nunca um caminho de código separado —
por isso não há testes "de Maclaurin" dedicados aqui além de usar
centro=0, exatamente como o resto da suíte já faz."""
from __future__ import annotations

import pytest
from sympy import Rational, Symbol, cos, diff, exp, factorial, log, pi, sin, simplify, sympify

from app.formatter.pipeline import format_result
from app.formatter.renderer import render_math
from app.math_engine.dispatcher import solve_expression
from app.math_engine.errors import ExpressionError

_x = Symbol("x")


def _solve(expression: str) -> str:
    raw = solve_expression(expression)
    return render_math(format_result(expression, raw))


def _taylor_value(text: str) -> str:
    return solve_expression(text).removeprefix("Taylor: ")


# --- Seção 10 do ticket — os 6 casos matemáticos obrigatórios --------------


def test_case_a_exp_at_0_order_4() -> None:
    assert _taylor_value("taylor(exp(x), x, 0, 4)") == "1+x+x**2/2+x**3/6+x**4/24"


def test_case_b_sin_at_0_order_5() -> None:
    assert _taylor_value("taylor(sin(x), x, 0, 5)") == "x-x**3/6+x**5/120"


def test_case_c_cos_at_0_order_6() -> None:
    assert _taylor_value("taylor(cos(x), x, 0, 6)") == "1-x**2/2+x**4/24-x**6/720"


def test_case_d_ln_1_plus_x_at_0_order_4() -> None:
    assert _taylor_value("taylor(ln(1+x), x, 0, 4)") == "x-x**2/2+x**3/3-x**4/4"


def test_case_e_reciprocal_at_0_order_5() -> None:
    assert _taylor_value("taylor(1/(1-x), x, 0, 5)") == "1+x+x**2+x**3+x**4+x**5"


def test_case_f_ln_at_1_order_4_preserves_x_minus_a_form() -> None:
    text = _taylor_value("taylor(ln(x), x, 1, 4)")
    # Forma pedida: potências de (x-1), nunca expandida em x puro.
    assert "(x - 1)**2" in text
    assert "(x - 1)**3" in text
    assert "(x - 1)**4" in text
    mine = sympify(text, locals={"x": _x})
    expected = sympify(
        "(x-1) - (x-1)**2/2 + (x-1)**3/3 - (x-1)**4/4", locals={"x": _x}
    )
    assert simplify(mine - expected) == 0


# --- Seção 11 do ticket — teste de ouro -------------------------------------


def test_golden_test_sin_at_pi_over_2_order_4() -> None:
    text = _taylor_value("taylor(sin(x), x, pi/2, 4)")
    assert "pi/2" in text
    mine = sympify(text, locals={"x": _x, "pi": pi})
    expected = sympify("1 - (x-pi/2)**2/2 + (x-pi/2)**4/24", locals={"x": _x, "pi": pi})
    assert simplify(mine - expected) == 0


def test_golden_test_odd_order_terms_never_appear_in_final_text() -> None:
    # Prova textual (não só numérica) de que os termos ímpares zeraram:
    # nenhuma potência ÍMPAR de (x-pi/2) sobrevive no resultado final.
    text = _taylor_value("taylor(sin(x), x, pi/2, 5)")
    assert "(x - pi/2)**1" not in text
    assert "(x - pi/2)**3" not in text
    assert "(x - pi/2)**5" not in text


# --- Seção 15 do ticket — consistência forte: P_n^(k)(a) == f^(k)(a) -------


@pytest.mark.parametrize(
    "text,expr,center,order",
    [
        ("taylor(exp(x), x, 0, 4)", exp(_x), 0, 4),
        ("taylor(sin(x), x, 0, 5)", sin(_x), 0, 5),
        ("taylor(cos(x), x, 0, 6)", cos(_x), 0, 6),
        ("taylor(ln(1+x), x, 0, 4)", log(1 + _x), 0, 4),
        ("taylor(1/(1-x), x, 0, 5)", 1 / (1 - _x), 0, 5),
        ("taylor(ln(x), x, 1, 4)", log(_x), 1, 4),
        ("taylor(sin(x), x, pi/2, 4)", sin(_x), pi / 2, 4),
    ],
)
def test_consistency_taylor_polynomial_derivatives_match_original_function(
    text: str, expr, center, order: int
) -> None:
    """Para 0 <= k <= ordem, P_n^(k)(a) == f^(k)(a) — detecta coeficiente
    errado de forma muito mais forte que comparar só a string final (um
    coeficiente trocado entre dois termos ainda poderia "parecer certo"
    numa leitura superficial, mas nunca sobrevive a esta checagem)."""
    text_value = _taylor_value(text)
    polynomial = sympify(text_value, locals={"x": _x, "pi": pi})
    for k in range(order + 1):
        poly_derivative_at_center = diff(polynomial, _x, k).subs(_x, center)
        func_derivative_at_center = expr if k == 0 else diff(expr, _x, k)
        func_derivative_at_center = func_derivative_at_center.subs(_x, center)
        assert simplify(poly_derivative_at_center - func_derivative_at_center) == 0, (
            f"k={k}: P_n^(k)(a)={poly_derivative_at_center} != f^(k)(a)={func_derivative_at_center}"
        )


# --- Seção 14 do ticket — hardening ------------------------------------------


def test_order_0_returns_f_of_a() -> None:
    assert _taylor_value("taylor(x**2+3, x, 2, 0)") == "7"


def test_order_1_returns_linear_approximation() -> None:
    text = _taylor_value("taylor(exp(x), x, 0, 1)")
    assert sympify(text, locals={"x": _x}) == sympify("1+x", locals={"x": _x})


def test_order_at_maximum_allowed_limit() -> None:
    from app.math_engine.calculus.taylor import MAX_TAYLOR_ORDER

    # Só confirma que NÃO lança — o valor em si não precisa de asserção
    # de conteúdo (só a validação de faixa importa aqui).
    _taylor_value(f"taylor(sin(x), x, 0, {MAX_TAYLOR_ORDER})")


@pytest.mark.parametrize(
    "expression",
    [
        "taylor(x**2, x, 0, -1)",
        "taylor(x**2, x, 0, 2.5)",
        "taylor(x**2, x, 0, )",
        "taylor(x**2, x, 0, abc)",
        "taylor(x**2, x, 0, 11)",
    ],
)
def test_invalid_or_out_of_range_order_raises_friendly_error(expression: str) -> None:
    with pytest.raises(ExpressionError):
        solve_expression(expression)


def test_order_above_limit_message_is_specific() -> None:
    with pytest.raises(ExpressionError, match="muito alta"):
        solve_expression("taylor(x**2, x, 0, 11)")


def test_order_negative_message_is_specific() -> None:
    with pytest.raises(ExpressionError, match="não-negativo"):
        solve_expression("taylor(x**2, x, 0, -1)")


def test_empty_expression_argument_raises() -> None:
    with pytest.raises(ExpressionError):
        solve_expression("taylor(, x, 0, 4)")


def test_empty_variable_argument_raises() -> None:
    with pytest.raises(ExpressionError):
        solve_expression("taylor(x**2, , 0, 4)")


def test_empty_center_argument_raises() -> None:
    with pytest.raises(ExpressionError):
        solve_expression("taylor(x**2, x, , 4)")


def test_center_pi() -> None:
    text = _taylor_value("taylor(sin(x), x, pi, 2)")
    mine = sympify(text, locals={"x": _x, "pi": pi})
    expected = sympify("-(x-pi)", locals={"x": _x, "pi": pi})
    assert simplify(mine - expected) == 0


def test_center_rational() -> None:
    # centro = 1/2, só confirma que resolve sem erro e bate com o
    # oráculo (derivada + substituição direta via SymPy).
    text = _taylor_value("taylor(exp(x), x, 1/2, 2)")
    mine = sympify(text, locals={"x": _x})
    a = Rational(1, 2)
    expected = sum(
        (diff(exp(_x), _x, k).subs(_x, a) / factorial(k)) * (_x - a) ** k for k in range(3)
    )
    assert simplify(mine - expected) == 0


def test_coefficients_that_vanish_are_simply_absent_never_shown_as_zero_terms() -> None:
    text = _taylor_value("taylor(cos(x), x, 0, 5)")
    assert "x**1" not in text
    assert "x**3" not in text
    assert "x**5" not in text


def test_constant_function() -> None:
    assert _taylor_value("taylor(5, x, 0, 4)") == "5"


def test_polynomial_function_of_degree_less_than_order_is_exact() -> None:
    # Polinômio de grau <= ordem é reproduzido EXATAMENTE (toda derivada
    # de ordem > grau é zero, então os termos extras simplesmente não
    # aparecem) — sem nenhum caso especial pra "já é um polinômio".
    text = _taylor_value("taylor(x**2+3*x+1, x, 0, 5)")
    mine = sympify(text, locals={"x": _x})
    assert simplify(mine - (_x**2 + 3 * _x + 1)) == 0


def test_composed_function() -> None:
    text = _taylor_value("taylor(sin(x**2), x, 0, 6)")
    mine = sympify(text, locals={"x": _x})
    expected = sum(
        (diff(sin(_x**2), _x, k).subs(_x, 0) / factorial(k)) * _x**k for k in range(7)
    )
    assert simplify(mine - expected) == 0


def test_rational_fraction() -> None:
    text = _taylor_value("taylor(x/(x**2+1), x, 0, 5)")
    mine = sympify(text, locals={"x": _x})
    expected = sum(
        (diff(_x / (_x**2 + 1), _x, k).subs(_x, 0) / factorial(k)) * _x**k for k in range(6)
    )
    assert simplify(mine - expected) == 0


# --- Seção 12 do ticket — domínio -------------------------------------------


def test_domain_ln_at_0_has_no_real_taylor_expansion() -> None:
    with pytest.raises(ExpressionError, match="não possui uma expansão de Taylor"):
        solve_expression("taylor(ln(x), x, 0, 4)")


def test_domain_reciprocal_at_0_has_no_expansion() -> None:
    with pytest.raises(ExpressionError, match="não possui uma expansão de Taylor"):
        solve_expression("taylor(1/x, x, 0, 3)")


def test_domain_sqrt_derivative_diverges_at_0() -> None:
    # f(0)=0 é finito, mas f'(0)=1/(2*sqrt(0)) diverge — o domínio precisa
    # ser checado em CADA ordem k, nunca só em k=0.
    with pytest.raises(ExpressionError, match="não possui uma expansão de Taylor"):
        solve_expression("taylor(sqrt(x), x, 0, 2)")


def test_domain_log_of_negative_center_is_complex_not_real() -> None:
    with pytest.raises(ExpressionError, match="não possui uma expansão de Taylor"):
        solve_expression("taylor(ln(x), x, -1, 2)")


def test_domain_never_crashes_never_500_style_internal_error() -> None:
    # Nunca NaN/zoo/crash cru — sempre `ExpressionError` amigável.
    for expression in ["taylor(ln(x), x, 0, 4)", "taylor(1/x, x, 0, 3)"]:
        try:
            solve_expression(expression)
            assert False, f"{expression} deveria ter levantado ExpressionError"
        except ExpressionError as exc:
            assert "zoo" not in str(exc)
            assert "nan" not in str(exc).lower()


# --- Seção 16 do ticket — regressões ----------------------------------------


def test_regression_plain_derivative_unaffected() -> None:
    assert _solve("derivada(x**2, x)") == "Derivada: 2x"


def test_regression_higher_order_derivative_unaffected() -> None:
    assert _solve("derivada(x**4, x, 2)") == "Derivada: 12x²"


def test_regression_implicit_derivative_unaffected() -> None:
    assert _solve("derivada(x**2+y**2=25, x)") == "Derivada: -x/y"


def test_regression_implicit_higher_order_unaffected() -> None:
    assert _solve("derivada(x**2+y**2=25, x, 2)") == "Derivada: -25/y³"


def test_regression_integral_unaffected() -> None:
    assert _solve("integral(x**2, x)") == "Integral: x³/3 + C"


def test_regression_definite_integral_unaffected() -> None:
    assert _solve("integral(x**2, x, 0, 2)") == "Integral definida: 8/3"


def test_regression_limit_unaffected() -> None:
    assert _solve("limite(x**2, x, 0)") == "Limite: 0"


def test_regression_linear_equation_unaffected() -> None:
    assert _solve("2*x+4=10") == "x = 3"


def test_regression_linear_system_unaffected() -> None:
    assert _solve("x+y=5\nx-y=1") == "x = 3, y = 2"


def test_regression_exponential_equation_unaffected() -> None:
    assert _solve("e^x=5") is not None


def test_regression_summation_unaffected() -> None:
    assert _solve("Σ(i=1..10) i") == "55"


def test_regression_matrix_unaffected() -> None:
    assert _solve("[[1,2],[3,4]]^2") == "[[7, 10], [15, 22]]"


def test_regression_implicit_multiplication_unaffected() -> None:
    assert _solve("derivada(x**3+y**3=6*x*y, x)") == "Derivada: (x² - 2y)/(2x - y²)"
