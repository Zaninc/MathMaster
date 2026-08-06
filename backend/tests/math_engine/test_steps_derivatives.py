"""Sprint V2.10 (Passo a Passo — Derivadas) — cobertura de
`math_engine.steps.derivatives`: regra da potência, coeficientes,
constantes, linearidade da soma/subtração, e rejeição amigável para
derivadas fora do escopo (nunca um erro interno)."""
from __future__ import annotations

import pytest

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps


def _final_expression(text: str) -> str:
    return generate_steps(text)[-1].expression


# --- Constantes --------------------------------------------------------------


def test_constant_alone_derivative_is_zero() -> None:
    steps = generate_steps("d/dx(7)")
    assert steps[0].title == "Função original"
    assert steps[-1].title == "A derivada de uma constante é zero"
    assert steps[-1].expression == "0"


def test_constant_within_polynomial_uses_derivando_title() -> None:
    steps = generate_steps("d/dx(x**2+5)")
    constant_step = next(s for s in steps if s.expression == "0")
    assert constant_step.title == "Derivando 5"


# --- Potência simples ---------------------------------------------------------


def test_bare_x_derivative() -> None:
    assert _final_expression("d/dx(x)") == "1"


def test_power_rule_x_squared() -> None:
    steps = generate_steps("d/dx(x**2)")
    assert steps[-1].expression == "2*x"
    assert "regra da potência" in steps[-1].title


def test_power_rule_x_fifth() -> None:
    assert _final_expression("d/dx(x**5)") == "5*x**4"


# --- Coeficiente × potência ----------------------------------------------------


def test_coefficient_power_shows_unsimplified_then_simplified() -> None:
    steps = generate_steps("d/dx(3*x**2)")
    expressions = [s.expression for s in steps]
    assert "2*3*x" in expressions  # regra aplicada, não simplificada
    assert expressions[-1] == "6*x"
    assert steps[-1].title == "Simplificando"


def test_negative_coefficient_power() -> None:
    steps = generate_steps("d/dx(-4*x**3)")
    expressions = [s.expression for s in steps]
    assert "3*(-4)*x**2" in expressions
    assert expressions[-1] == "-12*x**2"


# --- Soma ----------------------------------------------------------------------


def test_sum_of_two_terms() -> None:
    steps = generate_steps("d/dx(x**2+3*x)")
    titles = [s.title for s in steps]
    assert titles[0] == "Função original"
    assert titles[1] == "Aplicando a linearidade da derivada"
    assert titles[-1] == "Somando os resultados"
    assert steps[-1].expression == "2*x + 3"


def test_sum_of_three_terms() -> None:
    assert _final_expression("d/dx(x**3+x**2+x)") == "3*x**2 + 2*x + 1"


# --- Subtração -------------------------------------------------------------------


def test_subtraction() -> None:
    steps = generate_steps("d/dx(x**3-5*x)")
    linearity_step = next(s for s in steps if s.title == "Aplicando a linearidade da derivada")
    assert linearity_step.expression == "derivada(x**3, x)-derivada(5*x, x)"
    assert steps[-1].expression == "3*x**2 - 5"


# --- Polinômios completos --------------------------------------------------------


def test_full_polynomial_matches_solve_result_and_reads_in_degree_order() -> None:
    steps = generate_steps("d/dx(4*x**4+2*x**2-8*x+5)")
    titles_with_math = [s.title for s in steps if "Derivando" in s.title]
    # Ordem decrescente de grau, mesma convenção de leitura do resto do produto.
    assert titles_with_math == [
        "Derivando 4x⁴ pela regra da potência",
        "Derivando 2x² pela regra da potência",
        "Derivando -8x",
        "Derivando 5",
    ]
    assert steps[-1].title == "Somando os resultados"
    assert steps[-1].expression == "16*x**3 + 4*x - 8"

    from app.math_engine.dispatcher import solve_expression

    # O passo a passo nunca diverge do motor real de derivadas.
    assert solve_expression("d/dx(4*x**4+2*x**2-8*x+5)") == "Derivada: 16*x**3 + 4*x - 8"


# --- Fora de escopo: erro amigável, nunca interno ---------------------------------


def test_sin_rejected_with_friendly_message() -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("d/dx(sin(x))")


def test_exp_rejected_with_friendly_message() -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("d/dx(exp(x))")


def test_sin_still_works_via_solve_despite_steps_rejection() -> None:
    from app.math_engine.dispatcher import solve_expression

    assert solve_expression("d/dx(sin(x))") == "Derivada: cos(x)"


def test_negative_or_fractional_exponent_rejected() -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("d/dx(x**(-1))")
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("d/dx(x**(1/2))")


# --- Regressão: integral/limite continuam fora do passo a passo -------------------


def test_limit_still_rejected_by_domain_exclusion() -> None:
    # Sprint V2.10.1/V2.10.2 — integral indefinida (2 argumentos, `test_
    # steps_integrals.py`) e definida (4 argumentos, `test_steps_definite_
    # integrals.py`) já são suportadas; `limite` continua sendo o único
    # caso do domínio de cálculo ainda fora de escopo.
    with pytest.raises(ExpressionError, match="lineares e quadráticas"):
        generate_steps("limite(x**2, x, 0)")


# --- Contrato geral ------------------------------------------------------------


def test_every_step_is_pure_text_never_latex() -> None:
    for expr in ["d/dx(7)", "d/dx(x**5)", "d/dx(3*x**2)", "d/dx(4*x**4+2*x**2-8*x+5)"]:
        for step in generate_steps(expr):
            assert "\\" not in step.expression
            assert "$" not in step.expression
            assert "<" not in step.expression
