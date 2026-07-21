from sympy import Integer, solve
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from .classification import EXPONENCIAL, LOGARITMICA, MODULAR, RACIONAL
from .modular import solve_modular_roots
from .rational import denominator_roots


def compute_roots(expr: Expr, symbol: Symbol, kind: str) -> list | None:
    if kind == LOGARITMICA:
        # log_b(x) = 0 <=> x = 1, para qualquer base > 0, != 1 — vale tanto
        # para log(x) (base 10) quanto ln(x) (base e), as duas únicas bases
        # reconhecidas nesta forma canônica.
        return [Integer(1)]

    if kind == EXPONENCIAL:
        # a**x > 0 para todo x real quando a > 0 — nunca há raiz. Hardcoded
        # em vez de solve(expr, symbol) para não depender do comportamento
        # do SymPy em equações de potência transcendentais.
        return []

    if kind == MODULAR:
        return solve_modular_roots(expr, symbol)

    if kind == RACIONAL:
        excluidos = denominator_roots(expr, symbol)
        numerador = expr.together().as_numer_denom()[0]
        return [raiz for raiz in solve(numerador, symbol) if raiz not in excluidos]

    return solve(expr, symbol)
