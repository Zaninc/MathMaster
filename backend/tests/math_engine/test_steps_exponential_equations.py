"""Sprint "Exponenciais e Logaritmos" — cobertura de
`math_engine.steps.exponential_equations`, incluindo a SELEÇÃO AUTOMÁTICA
do método (bases iguais vs. logaritmo, nunca logaritmo indiscriminadamente)
e a integração com o roteamento em `steps/dispatcher.py`."""
from __future__ import annotations

import pytest

from sympy import Symbol

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps
from app.math_engine.steps.exponential_equations import match_exponential_term


def _final_expression(text: str) -> str:
    return generate_steps(text)[-1].expression


# --- Seleção automática do método -------------------------------------------


def test_exact_power_of_base_uses_same_base_method_never_logarithm() -> None:
    steps = generate_steps("2^x=8")
    titles = " ".join(s.title or "" for s in steps)
    assert "bases são iguais" in titles
    assert "logaritmo" not in titles.lower()
    assert _final_expression("2^x=8") == "x=3"


def test_non_exact_power_uses_logarithm_method() -> None:
    steps = generate_steps("5^x=13")
    titles = " ".join(s.title or "" for s in steps)
    assert "logaritmo natural" in titles.lower()
    assert "bases são iguais" not in titles


def test_euler_base_always_uses_logarithm_method_and_simplifies_ln_e() -> None:
    steps = generate_steps("e^x=5")
    titles = " ".join(s.title or "" for s in steps)
    assert "Como ln(e) = 1" in titles
    assert _final_expression("e^x=5") == "x=ln(5)"


# --- Expoente simples (== símbolo) ------------------------------------------


def test_simple_exponent_euler_base() -> None:
    assert _final_expression("e^x=5") == "x=ln(5)"


def test_simple_exponent_numeric_base_exact() -> None:
    assert _final_expression("2^x=8") == "x=3"


def test_simple_exponent_numeric_base_inexact() -> None:
    assert _final_expression("5^x=13") == "x=ln(13)/ln(5)"


# --- Expoente composto (2x, x+1) --------------------------------------------


def test_compound_exponent_double_x_euler_base() -> None:
    assert _final_expression("e^(2x)=7") == "x=ln(7)/2"


def test_compound_exponent_plus_one_euler_base() -> None:
    assert _final_expression("e^(x+1)=10") == "x=-1 + ln(10)"


def test_compound_exponent_double_x_numeric_base_exact() -> None:
    assert _final_expression("4^(2x)=16") == "x=1"


def test_compound_exponent_plus_one_numeric_base_exact() -> None:
    assert _final_expression("3^(x+1)=27") == "x=2"


# --- Coeficiente multiplicando a potência -----------------------------------


def test_coefficient_times_euler_power() -> None:
    assert _final_expression("2e^x=8") == "x=ln(4)"


def test_coefficient_times_compound_euler_power() -> None:
    assert _final_expression("3e^(2x)=12") == "x=ln(4)/2"


# --- Ausência de solução real -------------------------------------------------


def test_negative_target_has_no_real_solution() -> None:
    with pytest.raises(ExpressionError, match="não possui solução real"):
        generate_steps("e^x=-5")


def test_zero_target_has_no_real_solution() -> None:
    with pytest.raises(ExpressionError, match="não possui solução real"):
        generate_steps("2^x=0")


# --- Fora de escopo (nunca "chuta") ------------------------------------------


def test_non_linear_exponent_is_out_of_scope() -> None:
    with pytest.raises(ExpressionError):
        generate_steps("e^(x**2)=5")


def test_match_exponential_term_rejects_symbolic_base() -> None:
    x, a = Symbol("x"), Symbol("a")
    assert match_exponential_term(a**x, x) is None


def test_match_exponential_term_rejects_non_linear_exponent() -> None:
    x = Symbol("x")
    assert match_exponential_term(2 ** (x**2), x) is None


def test_match_exponential_term_accepts_linear_exponent() -> None:
    x = Symbol("x")
    coeff, base, exponent = match_exponential_term(2 * 3 ** (2 * x), x)
    assert (coeff, base, exponent) == (2, 3, 2 * x)


# --- Contrato geral ------------------------------------------------------------


def test_first_step_is_always_equacao_inicial() -> None:
    assert generate_steps("e^x=5")[0].title == "Equação inicial"


def test_every_step_is_pure_text_never_latex() -> None:
    for expr in ["e^x=5", "e^(2x)=7", "2^x=8", "5^x=13", "e^(x+1)=10"]:
        for step in generate_steps(expr):
            assert "\\" not in step.expression
            assert "$" not in step.expression


def test_natural_log_never_shown_as_sympy_log() -> None:
    # Convenção do produto: log natural sempre "ln(", nunca "log(" cru
    # (o SymPy sempre se auto-nomeia "log(" internamente).
    for expr in ["e^x=5", "5^x=13", "e^(2x)=7"]:
        for step in generate_steps(expr):
            assert "log(" not in step.expression


# --- Regressão do /solve ------------------------------------------------------


def test_regression_solve_exponential_equation_unaffected() -> None:
    from app.math_engine.dispatcher import solve_expression

    assert solve_expression("e^x=5") == "x = ln(5)"
    assert solve_expression("2^x=8") == "x = 3"
