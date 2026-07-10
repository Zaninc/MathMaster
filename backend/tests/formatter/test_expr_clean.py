"""Hardening II, Etapa 6 — testes unitários de `formatter/expr_clean.py`,
incluindo a regressão real que motivou a bateria restrita de simplificadores
documentada no próprio módulo (Sprint 7.2: `simplify()`/`cancel()` puros
desfatoravam "(x-1)*(x+1)" para "x**2-1")."""
from __future__ import annotations

from sympy import Rational, factorial, sin, symbols
from sympy.abc import x

from app.formatter.expr_clean import clean_expr, evalf_expr


def test_clean_expr_never_expands_an_already_factored_form() -> None:
    factored = (x - 1) * (x + 1)
    assert clean_expr(factored) == factored


def test_clean_expr_cancels_common_factor_in_fraction() -> None:
    expr = (x**2 - 1) / (x - 1)
    assert clean_expr(expr) == x + 1


def test_clean_expr_falls_back_to_original_when_nothing_improves() -> None:
    expr = x + 1
    assert clean_expr(expr) == expr


def test_clean_expr_never_returns_a_longer_equivalent_form() -> None:
    n = symbols("n")
    expr = factorial(n)  # nenhum simplificador da bateria deveria mexer aqui
    assert clean_expr(expr) == expr


def test_evalf_expr_converts_to_decimal_with_given_precision() -> None:
    result = evalf_expr(Rational(1, 3), precision=4)
    assert str(result) == "0.3333"


def test_evalf_expr_on_symbolic_expression_only_evaluates_numeric_parts() -> None:
    # sin(x) depende de um símbolo livre — evalf() não tem nada numérico
    # para converter e devolve a expressão simbólica intacta (não é o
    # caminho de exceção, é o comportamento normal do SymPy nesse caso).
    expr = sin(x)
    assert evalf_expr(expr) == expr
