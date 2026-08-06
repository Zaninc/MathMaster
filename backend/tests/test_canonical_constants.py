"""Hotfix V2.12.2a — cobertura unitária de `canonical_constants.py`, o
único módulo compartilhado por `app/formatter/` e `app/math_engine/steps/`
para reinterpretar o símbolo solto "e" (Euler) como `sympy.E`. Puramente
sintático (`xreplace`) — nunca recalcula nada, só decide COMO um valor já
computado deve virar texto."""
from __future__ import annotations

from sympy import E, Symbol, cos, exp, ln, log, sin, symbols

from app.canonical_constants import canonicalize_euler_constant

x = symbols("x")
e = Symbol("e")


def test_ln_of_bare_e_collapses_to_one() -> None:
    assert canonicalize_euler_constant(ln(e)) == 1


def test_log_of_bare_e_collapses_to_one() -> None:
    assert canonicalize_euler_constant(log(e)) == 1


def test_coefficient_times_ln_of_bare_e() -> None:
    assert canonicalize_euler_constant(2 * ln(e)) == 2
    assert canonicalize_euler_constant(5 * ln(e)) == 5


def test_bare_e_to_the_zero_already_one_without_needing_substitution() -> None:
    # Pow(qualquer coisa, 0) já é 1 nativamente no SymPy, independente do
    # símbolo ser Euler de verdade ou uma variável livre qualquer — esta
    # identidade nunca dependeu de `canonicalize_euler_constant`.
    assert canonicalize_euler_constant(e**0) == 1


def test_exp_of_zero_already_one_without_needing_substitution() -> None:
    assert canonicalize_euler_constant(exp(0)) == 1


def test_derivative_style_expression_with_bare_e_base() -> None:
    # Forma real produzida por compute_derivative quando o usuário digita
    # "e**(3*x)" em vez de "exp(3*x)": SymPy trata "e" como uma constante
    # livre genérica e aplica a regra de derivação de a^u, deixando
    # "ln(e)" no resultado — puramente um problema de apresentação.
    before = 3 * e ** (3 * x) * ln(e)
    assert canonicalize_euler_constant(before) == 3 * exp(3 * x)


def test_expression_without_bare_e_is_returned_unchanged() -> None:
    expr = sin(x) + cos(x)
    assert canonicalize_euler_constant(expr) is expr


def test_never_touches_the_real_sympy_e_constant() -> None:
    # `sympy.E` já é a constante real — `has(Symbol('e'))` não confunde as
    # duas (E não é um Symbol chamado "e", é a classe singleton `Exp1`).
    expr = ln(E)
    assert canonicalize_euler_constant(expr) == expr == 1


def test_never_touches_a_genuinely_different_free_symbol() -> None:
    a = symbols("a")
    expr = a**2 + ln(a)
    assert canonicalize_euler_constant(expr) == expr
