"""Hardening II, Etapa 6 — cobre branches de `equations/` não exercitados
pela suíte de compatibilidade: sistema com N>2 incógnitas, soluções
complexas e entrada multi-linha via "\\n" (a suíte de compatibilidade só
usava ";" como separador)."""
from __future__ import annotations

from app.formatter.pipeline import format_result
from app.formatter.renderer import render_math
from app.math_engine.dispatcher import solve_expression
from app.math_engine.errors import ExpressionError

import pytest


def _solve(expression: str) -> str:
    raw = solve_expression(expression)
    return render_math(format_result(expression, raw))


def test_linear_system_with_three_unknowns() -> None:
    assert _solve("x+y+z=6; x-y=0; y-z=1") == "x = 7/3, y = 7/3, z = 4/3"


def test_quadratic_equation_with_complex_roots() -> None:
    assert _solve("x**2+1=0") == "x₁ = -i, x₂ = i"


def test_system_separated_by_newlines_instead_of_semicolons() -> None:
    assert _solve("x+y=5\nx-y=1") == "x = 3, y = 2"


def test_degenerate_zero_coefficient_equation_raises() -> None:
    # "0*x=5" não é uma equação de verdade (sem incógnita de fato) — o
    # parser rejeita antes mesmo de chegar ao cálculo de grau. Documentado
    # aqui como o comportamento real observado, não assumido.
    with pytest.raises(ExpressionError):
        _solve("0*x=5")


# --- Regressão: equações com parâmetro livre continuam fora de escopo ---
#
# Cálculo (derivada/integral/limite) já nomeia a variável ativa
# explicitamente na sintaxe, então parâmetros livres (a, b, c...) já são
# aceitos como constantes lá. Equações não têm essa declaração explícita —
# "a*x + b = 0" tem 3 símbolos livres e não há como saber qual é "a
# incógnita" sem inventar uma convenção nova. Decisão explícita: manter a
# rejeição atual aqui, não expandir a sintaxe de equações nesta sprint.


def test_equation_with_free_parameters_still_requires_single_unknown() -> None:
    with pytest.raises(ExpressionError, match="única incógnita"):
        _solve("a*x + b = 0")


def test_quadratic_equation_with_free_parameters_still_requires_single_unknown() -> None:
    with pytest.raises(ExpressionError, match="única incógnita"):
        _solve("a*x**2 + b*x + c = 0")


def test_solve_wrapper_syntax_is_not_valid_and_fails_cleanly() -> None:
    # "solve(...)" não é uma forma reconhecida por nenhum dispatcher do
    # MathMaster (equações são digitadas diretamente, ex. "a*x+b=0", sem
    # wrapper) — confirma que isso falha de forma limpa, nunca crasha.
    with pytest.raises(ExpressionError):
        _solve("solve(a*x + b = 0, x)")
