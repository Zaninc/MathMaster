"""Sprint V2.8 — avaliação exata do Motor de Probabilidade.

Só matemática, zero apresentação (mesmo papel de
`combinatorics/evaluator.py`). Tudo em aritmética racional exata do SymPy
— os argumentos já chegam como `Rational`/`Integer` (ver
`parsing.py:parse_probability_fragment`, que usa a transformação
`rationalize`), então nenhuma operação aqui introduz erro de ponto
flutuante.

`evaluate_binomial_term` reutiliza `evaluate_combination` de
`combinatorics/evaluator.py` diretamente — nunca recalcula C(n,k) na mão
(exigência explícita do escopo da sprint).
"""
from __future__ import annotations

from sympy import Rational
from sympy.core.expr import Expr

from ..combinatorics.evaluator import evaluate_combination

# Tolerância para a comparação de independência (`independentes(...)`):
# os argumentos já chegam como `Rational` exato (ver docstring do módulo),
# então `pa*pb` e `pinter` nunca sofrem erro de arredondamento binário —
# mas a comparação ainda usa uma tolerância pequena (em vez de "=="),
# porque é o comportamento explicitamente pedido no escopo da sprint e
# protege contra qualquer entrada decimal futura que não passe por
# `rationalize` (defesa em profundidade, não uma correção de bug real).
_INDEPENDENCE_TOLERANCE = Rational(1, 10**9)


def evaluate_probabilidade(favoraveis: int, total: int) -> Expr:
    return Rational(favoraveis, total)


def evaluate_complementar(p: Expr) -> Expr:
    return 1 - p


def evaluate_uniao(pa: Expr, pb: Expr, pinter: Expr) -> Expr:
    return pa + pb - pinter


def evaluate_intersecao_independente(pa: Expr, pb: Expr) -> Expr:
    return pa * pb


def evaluate_condicional(pinter: Expr, pb: Expr) -> Expr:
    return pinter / pb


def evaluate_independentes(pa: Expr, pb: Expr, pinter: Expr) -> tuple[Expr, bool]:
    product = pa * pb
    is_independent = bool(abs(product - pinter) < _INDEPENDENCE_TOLERANCE)
    return product, is_independent


def evaluate_binomial_term(n: int, k: int, p: Expr) -> tuple[int, Expr, Expr, Expr]:
    combinations = evaluate_combination(n, k)
    p_pow_k = p**k
    one_minus_p_pow = (1 - p) ** (n - k)
    value = combinations * p_pow_k * one_minus_p_pow
    return combinations, p_pow_k, one_minus_p_pow, value
