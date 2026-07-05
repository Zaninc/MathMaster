from sympy import simplify
from sympy.core.expr import Expr


def simplify_expression(expr: Expr) -> Expr:
    return simplify(expr)
