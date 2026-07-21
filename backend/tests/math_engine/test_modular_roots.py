"""Regressão do timeout/crash de módulo+trigonometria: `f(x)=|sin(x)|` e
similares travavam o processo pra sempre (Abs. `list()` sobre um conjunto
solução infinito e periódico nunca termina), e `f(x)=|x+sin(x)|` levantava
`TypeError` não tratado (`ConditionSet` não é iterável). Causa raiz isolada
em `solve_modular_roots()` (functions/modular.py): `solveset()` em si
sempre retorna rápido — o problema era só o `list(solution)` subsequente
assumir, sem checar, que qualquer resultado não-`FiniteSet` ainda seria
enumerável com segurança."""
from __future__ import annotations

import pytest
from sympy import Abs, Symbol, cos, sin, sqrt

from app.math_engine.functions.modular import solve_modular_roots

x = Symbol("x")


@pytest.mark.parametrize(
    "expr, expected",
    [
        (Abs(x), [0]),
        (Abs(sqrt(x) - 2), [4]),
        (5 * Abs(x + 1) ** 2, [-1]),
    ],
)
def test_finite_root_set_returns_sorted_list(expr, expected) -> None:
    assert solve_modular_roots(expr, x) == expected


@pytest.mark.parametrize(
    "expr",
    [
        Abs(sin(x)),  # Union(ImageSet, ImageSet) infinito e periódico
        Abs(cos(x)),  # idem
        Abs(x + sin(x)),  # ConditionSet — sem forma fechada, não iterável
    ],
)
def test_non_finite_solution_returns_none_instead_of_hanging_or_raising(expr) -> None:
    # Antes da correção: Abs(sin(x))/Abs(cos(x)) travavam para sempre em
    # list(solution); Abs(x + sin(x)) levantava TypeError. Nenhum dos dois
    # pode acontecer mais — e uma lista vazia também seria errada (diria
    # "nenhuma raiz", falso nos três casos).
    assert solve_modular_roots(expr, x) is None
