"""Sprint V2.9 (Passo a Passo) — cobertura de
`math_engine.steps.linear_systems` (método da eliminação, 2x2)."""
from __future__ import annotations

import pytest

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps


def test_simple_system_direct_elimination() -> None:
    steps = generate_steps("x+y=5\nx-y=1")
    assert steps[0].title == "Sistema inicial"
    assert steps[-1].expression == "x=3, y=2"


def test_system_requiring_row_multiplication() -> None:
    steps = generate_steps("2*x+3*y=13\nx+2*y=8")
    titles = [s.title for s in steps]
    assert any("Multiplicando" in title for title in titles)
    assert steps[-1].expression == "x=2, y=3"


def test_system_unique_solution_via_semicolon() -> None:
    steps = generate_steps("2*x+y=7; x-y=2")
    assert steps[-1].expression == "x=3, y=1"


def test_system_no_solution() -> None:
    steps = generate_steps("x+y=5\nx+y=3")
    assert steps[-1].expression == "0=2"
    assert "não tem solução" in steps[-1].title


def test_system_infinite_solutions() -> None:
    steps = generate_steps("x+y=5\n2*x+2*y=10")
    assert steps[-1].expression == "0=0"
    assert "infinitas soluções" in steps[-1].title


def test_three_by_three_system_returns_friendly_unavailability() -> None:
    with pytest.raises(ExpressionError, match="mais de duas incógnitas"):
        generate_steps("x+y+z=6\nx-y=0\ny-z=1")


def test_regression_current_solve_engine_unaffected() -> None:
    """A infraestrutura de passos nunca é chamada por `solve_expression` —
    o motor original (`equations/systems.py`, via `linsolve`) continua
    resolvendo sistemas 3x3 normalmente, só sem passo a passo."""
    from app.math_engine.dispatcher import solve_expression

    assert solve_expression("x+y+z=6\nx-y=0\ny-z=1") == "x = 7/3, y = 7/3, z = 4/3"


def test_every_step_is_pure_text_never_latex() -> None:
    for step in generate_steps("x+y=5\nx-y=1"):
        assert "\\" not in step.expression
        assert "$" not in step.expression
