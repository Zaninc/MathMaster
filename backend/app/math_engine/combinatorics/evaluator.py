"""Sprint V2.7 — avaliação exata do Motor de Combinatória.

Só matemática, zero apresentação (mesmo papel de `polynomials/evaluator.py`).
Tudo em aritmética inteira exata do SymPy (`factorial`/`binomial`) — nunca
aproximações, conforme o contrato do produto.
"""
from __future__ import annotations

from sympy import binomial, factorial


def evaluate_factorial(n: int) -> int:
    return int(factorial(n))


def evaluate_permutation(n: int) -> int:
    return int(factorial(n))


def evaluate_arrangement(n: int, k: int) -> int:
    return int(factorial(n) // factorial(n - k))


def evaluate_combination(n: int, k: int) -> int:
    return int(binomial(n, k))


def evaluate_permutation_with_repetition(n: int, repetitions: list[int]) -> int:
    denominator = 1
    for repetition in repetitions:
        denominator *= int(factorial(repetition))
    return int(factorial(n)) // denominator
