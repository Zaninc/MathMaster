"""Sprint V2.9.1 (Passo a Passo — Quadráticas) — cobertura de
`math_engine.steps.quadratic_equations`, incluindo a SELEÇÃO AUTOMÁTICA
do método (nunca Bhaskara indiscriminadamente) e a integração com o
roteamento por grau em `dispatcher.py`."""
from __future__ import annotations

import pytest

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps


def _roots(text: str) -> list[str]:
    """Últimas 1-2 expressões da sequência — as raízes finais."""
    steps = generate_steps(text)
    return [s.expression for s in steps if s.expression.startswith("x=")]


# --- Seleção automática do método -----------------------------------------


def test_pure_quadratic_uses_direct_square_root_never_bhaskara() -> None:
    steps = generate_steps("x**2=16")
    titles = " ".join(s.title or "" for s in steps)
    assert "raiz quadrada" in titles
    assert "discriminante" not in titles.lower()
    assert _roots("x**2=16") == ["x=4", "x=-4"]


def test_factorable_monic_quadratic_uses_factoring_never_bhaskara() -> None:
    steps = generate_steps("x**2-5*x+6=0")
    titles = " ".join(s.title or "" for s in steps)
    assert "Fatorando" in titles
    assert "discriminante" not in titles.lower()
    assert set(_roots("x**2-5*x+6=0")) == {"x=2", "x=3"}


def test_non_monic_with_non_integer_root_uses_bhaskara_not_factoring() -> None:
    # 2x²+3x-5=0 fatora sobre os racionais ((x-1)(2x+5)), mas uma raiz
    # (-5/2) não é inteira -- "fatoração inteira não é natural" aqui.
    steps = generate_steps("2*x**2+3*x-5=0")
    titles = " ".join(s.title or "" for s in steps)
    assert "discriminante" in titles.lower()
    assert "Fatorando" not in titles
    assert set(_roots("2*x**2+3*x-5=0")) == {"x=1", "x=-5/2"}


def test_linear_degenerate_quadratic_delegates_to_linear_engine() -> None:
    steps = generate_steps("0*x**2+2*x=6")
    assert [s.expression for s in steps] == ["2*x=6", "x=3"]
    assert steps[0].title == "Equação inicial"


# --- Raiz direta ------------------------------------------------------------


def test_direct_square_root_x_squared_49() -> None:
    assert _roots("x**2=49") == ["x=7", "x=-7"]


def test_direct_square_root_with_leading_coefficient() -> None:
    assert set(_roots("2*x**2=18")) == {"x=3", "x=-3"}
    assert set(_roots("5*x**2-45=0")) == {"x=3", "x=-3"}


# --- Fatoração ---------------------------------------------------------------


def test_factoring_difference_of_squares() -> None:
    assert set(_roots("x**2-9=0")) == {"x=3", "x=-3"}


def test_factoring_negative_roots() -> None:
    assert set(_roots("x**2+5*x+6=0")) == {"x=-2", "x=-3"}


# --- Bhaskara -----------------------------------------------------------------


def test_bhaskara_shows_discriminant_steps() -> None:
    steps = generate_steps("2*x**2+3*x-5=0")
    expressions = [s.expression for s in steps]
    assert "Delta=49" in expressions
    assert "x=1" in expressions
    assert "x=-5/2" in expressions


def test_bhaskara_second_example() -> None:
    assert set(_roots("3*x**2-2*x-1=0")) == {"x=1", "x=-1/3"}


def test_bhaskara_double_root() -> None:
    steps = generate_steps("x**2-4*x+4=0")
    assert steps[-1].expression == "x=2"
    assert "raiz dupla" in steps[-1].title


# --- Δ negativo (raízes complexas) --------------------------------------------


def test_negative_discriminant_gives_complex_roots() -> None:
    steps = generate_steps("x**2+1=0")
    expressions = [s.expression for s in steps]
    assert "Delta=-4" in expressions
    assert "x=i" in expressions
    assert "x=-i" in expressions


def test_negative_discriminant_general_complex_roots() -> None:
    assert set(_roots("x**2+4*x+5=0")) == {"x=-2 + i", "x=-2 - i"}


# --- Casos degenerados / erros ------------------------------------------------


def test_invalid_expression_raises_friendly_error() -> None:
    with pytest.raises(ExpressionError):
        generate_steps("x**2+=5")


def test_cubic_still_rejected() -> None:
    with pytest.raises(ExpressionError, match="lineares e quadráticas"):
        generate_steps("x**3-6*x**2+11*x-6=0")


# --- Regressão do /solve e do endpoint de passos existente --------------------


def test_regression_solve_quadratic_engine_unaffected() -> None:
    from app.math_engine.dispatcher import solve_expression

    assert solve_expression("x**2-4=0") == "x = -2, x = 2"


def test_regression_linear_steps_unaffected() -> None:
    steps = generate_steps("2*x+4=10")
    assert steps[-1].expression == "x=3"


def test_regression_system_steps_unaffected() -> None:
    steps = generate_steps("x+y=5\nx-y=1")
    assert steps[-1].expression == "x=3, y=2"


# --- Contrato geral ------------------------------------------------------------


def test_every_step_is_pure_text_never_latex() -> None:
    for expr in ["x**2=16", "x**2-9=0", "2*x**2+3*x-5=0", "x**2+1=0"]:
        for step in generate_steps(expr):
            assert "\\" not in step.expression
            assert "$" not in step.expression
