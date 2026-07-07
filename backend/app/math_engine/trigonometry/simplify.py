from sympy import simplify, trigsimp
from sympy.core.expr import Expr


def simplify_trig(expr: Expr) -> Expr:
    return trigsimp(simplify(expr))
