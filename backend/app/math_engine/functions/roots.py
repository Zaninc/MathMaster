from sympy import solve
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from .classification import MODULAR, RACIONAL
from .modular import solve_modular_roots
from .rational import denominator_roots


def compute_roots(expr: Expr, symbol: Symbol, kind: str) -> list:
    if kind == MODULAR:
        return solve_modular_roots(expr, symbol)

    if kind == RACIONAL:
        excluidos = denominator_roots(expr, symbol)
        numerador = expr.together().as_numer_denom()[0]
        return [raiz for raiz in solve(numerador, symbol) if raiz not in excluidos]

    return solve(expr, symbol)
