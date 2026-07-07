from sympy import fraction, solve
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol


def is_rational_function(expr: Expr, symbol: Symbol) -> bool:
    _, denom = fraction(expr.together())
    return symbol in denom.free_symbols


def denominator_roots(expr: Expr, symbol: Symbol) -> list:
    _, denom = fraction(expr.together())
    return solve(denom, symbol)
