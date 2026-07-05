from sympy import expand
from sympy.core.expr import Expr


def expand_expression(expr: Expr) -> Expr:
    return expand(expr)
