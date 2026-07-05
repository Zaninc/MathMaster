from sympy import radsimp, sqrtdenest
from sympy.core.expr import Expr


def simplify_roots(expr: Expr) -> Expr:
    return sqrtdenest(radsimp(expr))
