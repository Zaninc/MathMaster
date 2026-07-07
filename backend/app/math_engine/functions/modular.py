from sympy import Abs, Eq, S, solveset
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol


def is_modular_function(expr: Expr) -> bool:
    return expr.has(Abs)


def solve_modular_roots(expr: Expr, symbol: Symbol) -> list:
    solution = solveset(Eq(expr, 0), symbol, domain=S.Reals)
    return sorted(solution, key=str) if solution.is_FiniteSet else list(solution)
