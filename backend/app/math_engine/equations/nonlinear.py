"""Sprint V2.5 — camada NOVA e separada do motor linear
(`equations/systems.py`), nunca compartilha código com
`solve_linear_system`/`linsolve`. Resolve sistemas POLINOMIAIS não
lineares via `sympy.nonlinsolve` — potências, produtos entre incógnitas,
circunferências/parábolas/hipérboles, cúbicos simples quando o
`nonlinsolve` resolve naturalmente (nenhum código dedicado a grau 3).

Funções transcendentais das incógnitas (sin/cos/exp/log/Abs) já são
interceptadas por outros domínios ANTES de chegar aqui
(`math_engine/dispatcher.py`: trigonometria/logaritmos são checados antes
de equations), mas `nonlinear_validation.is_polynomial_system` protege
contra qualquer caso que escape dessa cascata — ver a docstring dela para
o porquê isto é uma proteção de CORREÇÃO, não só cosmética.

Nenhum método numérico, nenhuma aproximação (Newton, bisseção): somente
`nonlinsolve`, que resolve simbolicamente ou não resolve.
"""
from __future__ import annotations

from sympy import Eq, nonlinsolve
from sympy.core.symbol import Symbol

from ..errors import ExpressionError
from .nonlinear_formatter import format_nonlinear_solutions
from .nonlinear_validation import is_polynomial_system


def solve_nonlinear_system(equations: list[Eq], symbols: list[Symbol]) -> str:
    if not is_polynomial_system(equations, symbols):
        raise ExpressionError(
            "Sistemas com funções transcendentais (seno, cosseno, exponencial, "
            "logaritmo, módulo) ainda não são suportados nesta versão."
        )

    try:
        solutions = nonlinsolve(equations, symbols)
    except NotImplementedError as exc:
        raise ExpressionError(
            "Não foi possível resolver este sistema simbolicamente nesta versão."
        ) from exc

    return format_nonlinear_solutions(solutions, symbols)
