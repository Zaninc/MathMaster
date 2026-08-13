"""Sprint "Exponenciais e Logaritmos" — cobertura de
`math_engine.steps.logarithmic_equations`: log natural (ln), base 10
(convenção do produto) e base arbitrária via mudança de base
(`log(arg)/log(base)` — a forma OFICIAL do produto para "log_b", ver
`mathfield-to-backend.ts`, Sprint V3.0.3; "log_2(x)" não tem sintaxe
própria no texto do backend)."""
from __future__ import annotations

import pytest

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps


def _final_expression(text: str) -> str:
    return generate_steps(text)[-1].expression


# --- Log natural (ln) --------------------------------------------------------


def test_ln_simple_argument() -> None:
    steps = generate_steps("ln(x)=2")
    titles = " ".join(s.title or "" for s in steps)
    assert "inversas" in titles
    assert _final_expression("ln(x)=2") == "x=exp(2)"


def test_ln_linear_argument_plus_constant() -> None:
    assert _final_expression("ln(x+1)=3") == "x=-1 + exp(3)"


def test_ln_linear_argument_with_coefficient() -> None:
    assert _final_expression("ln(2*x)=3") == "x=exp(3)/2"


def test_ln_domain_step_is_shown() -> None:
    steps = generate_steps("ln(x+1)=4")
    domain_steps = [s for s in steps if s.expression == "x + 1>0"]
    assert len(domain_steps) == 1
    assert "domínio" in (domain_steps[0].title or "").lower()


# --- Log base 10 (convenção do produto: "log" = base 10) --------------------


def test_log_base_10_simple() -> None:
    assert _final_expression("log(x)=2") == "x=100"


# --- Log de base arbitrária (mudança de base, "log(arg)/log(base)") --------


def test_log_base_2_via_change_of_base() -> None:
    assert _final_expression("log(x)/log(2)=3") == "x=8"


def test_log_base_2_with_linear_argument() -> None:
    assert _final_expression("log(x+1)/log(2)=4") == "x=15"


def test_log_base_3_via_change_of_base() -> None:
    assert _final_expression("log(x)/log(3)=4") == "x=81"


# --- Fora de escopo (nunca "chuta") ------------------------------------------


def test_non_linear_argument_is_out_of_scope() -> None:
    with pytest.raises(ExpressionError):
        generate_steps("ln(x**2)=3")


# --- Contrato geral ------------------------------------------------------------


def test_first_step_is_always_equacao_inicial() -> None:
    assert generate_steps("ln(x)=2")[0].title == "Equação inicial"


def test_every_step_is_pure_text_never_latex() -> None:
    for expr in ["ln(x)=2", "ln(x+1)=3", "log(x)=2", "log(x)/log(2)=3"]:
        for step in generate_steps(expr):
            assert "\\" not in step.expression
            assert "$" not in step.expression


def test_natural_log_never_shown_as_sympy_log() -> None:
    for expr in ["ln(x)=2", "log(x)=2", "log(x)/log(2)=3", "ln(x+1)=3"]:
        for step in generate_steps(expr):
            assert "log(" not in step.expression


# --- Regressão do /solve ------------------------------------------------------


def test_regression_solve_logarithmic_equation_unaffected() -> None:
    from app.math_engine.dispatcher import solve_expression

    assert solve_expression("ln(x)=2") == "x = exp(2)"
    assert solve_expression("log(x)=2") == "x = 100"
