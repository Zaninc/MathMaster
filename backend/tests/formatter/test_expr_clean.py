"""Hardening II, Etapa 6 — testes unitários de `formatter/expr_clean.py`,
incluindo a regressão real que motivou a bateria restrita de simplificadores
documentada no próprio módulo (Sprint 7.2: `simplify()`/`cancel()` puros
desfatoravam "(x-1)*(x+1)" para "x**2-1")."""
from __future__ import annotations

import time

from sympy import Rational, Symbol, cos, exp, factorial, ln, sin, symbols
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


# --- Hotfix (Sprint V2.1, BUG 2): trigsimp limitado a poucos átomos -------
#
# Causa-raiz medida empiricamente: `trigsimp` busca identidades ENTRE todos
# os átomos trigonométricos de uma expressão, e esse custo cresce muito
# rápido com a quantidade de átomos independentes (~0.04s a 12 átomos,
# ~3.6s a 60). Um somatório como "Σ(i=1..30) sin(i)" produz uma soma de 30
# átomos sin(k) sem nenhuma identidade real para achar — `clean_expr` pagava
# esse custo em TODO resultado, mesmo sem ganho algum.


def test_clean_expr_still_applies_trigsimp_below_the_atom_threshold() -> None:
    # Poucos átomos (2) — comportamento de antes, intocado: a identidade
    # fundamental continua sendo encontrada normalmente.
    expr = sin(x) ** 2 + cos(x) ** 2
    assert clean_expr(expr) == 1


def test_clean_expr_skips_trigsimp_above_the_atom_threshold_but_stays_fast() -> None:
    # 60 átomos (30 sin + 30 cos) de argumento numérico independente —
    # acima do limite, `trigsimp` nem é tentado; nenhum outro simplificador
    # da bateria encurta essa soma, então o resultado permanece intocado.
    expr = sum(sin(i) + cos(i) for i in range(1, 31))
    start = time.perf_counter()
    result = clean_expr(expr)
    elapsed = time.perf_counter() - start
    # Bem abaixo dos ~3.6s que `trigsimp` sozinho levava nesse mesmo caso
    # antes da correção — margem generosa para variação de máquina/CI.
    assert elapsed < 2.5, f"levou {elapsed:.2f}s, deveria pular trigsimp"
    assert result == expr


# --- Hotfix V2.12.2a: símbolo solto "e" reinterpretado como Euler ---------


def test_clean_expr_collapses_ln_of_bare_e_symbol() -> None:
    e = Symbol("e")
    assert clean_expr(ln(e)) == 1


def test_clean_expr_collapses_derivative_shaped_expression_with_bare_e() -> None:
    # Forma real produzida quando o usuário digita "e**(3*x)" em vez de
    # "exp(3*x)": SymPy trata "e" como constante livre genérica.
    e = Symbol("e")
    before = 3 * e ** (3 * x) * ln(e)
    assert clean_expr(before) == 3 * exp(3 * x)
