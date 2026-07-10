"""Hardening II, Etapa 6 — testes unitários de `formatter/render_sets.py`,
incluindo os dois contratos "retorna None em vez de arriscar representação
errada" documentados no próprio docstring do módulo (Union misturando
Interval com ImageSet; texto que não corresponde à estrutura esperada)."""
from __future__ import annotations

from sympy import EmptySet, Interval, S, oo

from app.formatter.render_sets import render_finiteset_values, render_interval, render_periodic_solution


def test_render_interval_open() -> None:
    assert render_interval(Interval.open(2, oo)) == "(2, ∞)"


def test_render_interval_closed() -> None:
    assert render_interval(Interval(1, 5)) == "[1, 5]"


def test_render_interval_empty_set() -> None:
    assert render_interval(EmptySet) == "∅"


def test_render_interval_reals() -> None:
    assert render_interval(S.Reals) == "ℝ"


def test_render_interval_union_of_intervals() -> None:
    union = Interval.open(-oo, -2) + Interval.open(2, oo)
    assert render_interval(union) == "(-∞, -2) ∪ (2, ∞)"


def test_render_finiteset_values_with_symbol_single_value() -> None:
    from sympy import Integer

    assert render_finiteset_values([Integer(-4)], "x") == "x = -4"


def test_render_finiteset_values_with_symbol_multiple_values_sorted() -> None:
    from sympy import Integer

    # Passadas fora de ordem — render_finiteset_values deve ordenar por
    # (parte real, parte imaginária) antes de indexar x1/x2.
    values = [Integer(3), Integer(-4)]
    assert render_finiteset_values(values, "x") == "x₁ = -4, x₂ = 3"


def test_render_finiteset_values_without_symbol_falls_back_to_set_notation() -> None:
    from sympy import Integer

    assert render_finiteset_values([Integer(1), Integer(2)], None) == "{1, 2}"


def test_render_periodic_solution_single_branch() -> None:
    raw = "ImageSet(Lambda(_n, pi*_n + pi/4), Integers)"
    assert render_periodic_solution(raw, "x") == "x = pi*k + pi/4, k ∈ ℤ"


def test_render_periodic_solution_two_branches() -> None:
    raw = (
        "Union(ImageSet(Lambda(_n, 2*_n*pi + pi/6), Integers), "
        "ImageSet(Lambda(_n, 2*_n*pi + 5*pi/6), Integers))"
    )
    assert render_periodic_solution(raw, "x") == (
        "x = 2*pi*k + pi/6 ou x = 2*pi*k + 5*pi/6, k ∈ ℤ"
    )


def test_render_periodic_solution_defaults_to_x_when_symbol_is_none() -> None:
    raw = "ImageSet(Lambda(_n, pi*_n + pi/4), Integers)"
    assert render_periodic_solution(raw, None) == "x = pi*k + pi/4, k ∈ ℤ"


def test_render_periodic_solution_returns_none_for_unrelated_text() -> None:
    # Nunca deve ser chamado com texto não-classificado na prática (
    # classify.is_periodic_solution_shape já filtra antes), mas o contrato
    # de segurança exige degradar para None, não lançar, se o formato não
    # bater com o esperado.
    assert render_periodic_solution("not a valid sympy repr at all !!", "x") is None
