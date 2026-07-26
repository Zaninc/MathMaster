"""Hardening II, Etapa 6 — testes unitários de `formatter/classify.py`
isolados do pipeline completo. Antes desta sprint, os shapes só eram
exercitados indiretamente via `solve_expression()` end-to-end; um bug num
detector poderia ficar mascarado por outro shape compensando por acaso."""
from __future__ import annotations

import pytest

from app.formatter.classify import (
    is_assignment_shape,
    is_finiteset_shape,
    is_interval_shape,
    is_multi_assignment_shape,
    is_periodic_solution_shape,
    is_pure_expression_shape,
)


@pytest.mark.parametrize(
    "text",
    ["Interval(2, oo)", "Interval.open(2, oo)", "Union(Interval(1,2), Interval(3,4))", "EmptySet", "Reals"],
)
def test_is_interval_shape_positive(text: str) -> None:
    assert is_interval_shape(text) is True


@pytest.mark.parametrize("text", ["{1, 2}", "x = 5", "Tipo: reta; Foo: 1", "ImageSet(Lambda(_n, _n), Integers)"])
def test_is_interval_shape_negative(text: str) -> None:
    assert is_interval_shape(text) is False


@pytest.mark.parametrize(
    "text",
    [
        "ImageSet(Lambda(_n, pi*_n + pi/4), Integers)",
        "Union(ImageSet(Lambda(_n, 2*_n*pi + pi/6), Integers), ImageSet(Lambda(_n, 2*_n*pi + 5*pi/6), Integers))",
    ],
)
def test_is_periodic_solution_shape_positive(text: str) -> None:
    assert is_periodic_solution_shape(text) is True


@pytest.mark.parametrize(
    "text",
    [
        "Interval(2, oo)",
        "Union(Interval(1,2), Interval(3,4))",  # Union genérico não deve casar aqui
        "{1, 2}",
        "x = 5",
    ],
)
def test_is_periodic_solution_shape_negative(text: str) -> None:
    assert is_periodic_solution_shape(text) is False


@pytest.mark.parametrize("text", ["{1, 2}", "{-4, 3}", "{}"])
def test_is_finiteset_shape_positive(text: str) -> None:
    assert is_finiteset_shape(text) is True


def test_is_finiteset_shape_rejects_non_brace_text() -> None:
    assert is_finiteset_shape("Interval(1, 2)") is False


def test_is_assignment_shape_requires_every_segment_to_match() -> None:
    assert is_assignment_shape(["x = 5", "y = 7"]) is True
    assert is_assignment_shape(["x = 5", "f(2) = 7"]) is False  # um segmento não-assignment invalida tudo
    assert is_assignment_shape([]) is False


# --- Sprint V2.5 (Sistemas Polinomiais Não Lineares) ------------------


def test_is_multi_assignment_shape_requires_two_plus_branches_all_valid() -> None:
    assert is_multi_assignment_shape([["x = 2", "y = 3"], ["x = 3", "y = 2"]]) is True
    assert is_multi_assignment_shape([["x = 2", "y = 3"]]) is False  # só 1 ramo — nada a distinguir
    assert is_multi_assignment_shape([]) is False


def test_is_multi_assignment_shape_rejects_when_any_branch_is_malformed() -> None:
    assert is_multi_assignment_shape([["x = 2", "y = 3"], ["x = 3", "f(2) = 7"]]) is False


@pytest.mark.parametrize("text", ["x + 1", "2*x**2 - 4", "sqrt(2)"])
def test_is_pure_expression_shape_accepts_bare_ascii_math(text: str) -> None:
    assert is_pure_expression_shape(text) is True


def test_is_pure_expression_shape_rejects_empty_text() -> None:
    assert is_pure_expression_shape("") is False


@pytest.mark.parametrize(
    "text",
    ["Tipo: reta; Foo: 1", "x = 5", "a;b", "função afim"],
)
def test_is_pure_expression_shape_rejects_labeled_or_non_ascii_text(text: str) -> None:
    # Strings com "=", ":" ou ";" (tipicamente blocos "Tipo: ...") ou com
    # acentuação (blocos em português) nunca devem ser tratadas como
    # expressão pura — mesmo se o resto do texto parecer matemático.
    assert is_pure_expression_shape(text) is False
