"""Sprint V2.9 (Passo a Passo) — cobertura de
`math_engine.steps.linear_equations`. Cada passo é verificado como texto
matemático puro (nunca LaTeX), e a lista de expressões inteira é conferida
para garantir que a SEQUÊNCIA de operações é a esperada, não só o passo
final."""
from __future__ import annotations

import pytest

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps


def _expressions(text: str) -> list[str]:
    return [step.expression for step in generate_steps(text)]


def test_simple_linear_equation() -> None:
    steps = generate_steps("2*x+4=10")
    assert [s.expression for s in steps] == ["2*x + 4=10", "2*x=6", "x=3"]
    assert steps[0].title == "Equação inicial"
    assert steps[-1].expression == "x=3"


def test_variable_on_both_sides() -> None:
    assert _expressions("3x-7=2x+5")[-1] == "x=12"


def test_distributive_property() -> None:
    assert _expressions("4*(x+2)=20")[-1] == "x=3"


def test_fraction_coefficient() -> None:
    steps = generate_steps("(x/3)+2=5")
    assert "x/3=3" in [s.expression for s in steps]
    assert steps[-1].expression == "x=9"


def test_negative_coefficient() -> None:
    assert _expressions("-2*x=6")[-1] == "x=-3"


def test_infinite_solutions() -> None:
    steps = generate_steps("2*x+1=2*x+1")
    assert steps[-1].expression == "1=1"
    assert "infinitas soluções" in steps[-1].title


def test_no_solution() -> None:
    steps = generate_steps("2*x+1=2*x+3")
    assert steps[-1].expression == "1=3"
    assert "não tem solução" in steps[-1].title


def test_invalid_expression_raises() -> None:
    with pytest.raises(ExpressionError):
        generate_steps("2x+=10")


def test_cubic_equation_rejected_with_clear_message() -> None:
    # Sprint V2.9.1 — grau 2 agora é suportado (`quadratic_equations.py`);
    # grau 3 continua fora do escopo do passo a passo.
    with pytest.raises(ExpressionError, match="lineares e quadráticas"):
        generate_steps("x**3+2=6")


def test_inequality_rejected_with_clear_message() -> None:
    with pytest.raises(ExpressionError, match="inequaç"):
        generate_steps("x>3")


def test_non_equation_domain_rejected() -> None:
    with pytest.raises(ExpressionError):
        generate_steps("2+2")


def test_every_step_is_pure_text_never_latex() -> None:
    for step in generate_steps("2*x+4=10"):
        assert "\\" not in step.expression
        assert "$" not in step.expression
