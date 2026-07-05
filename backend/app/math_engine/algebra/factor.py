from sympy import factor
from sympy.core.expr import Expr


def factor_expression(expr: Expr) -> Expr:
    return factor(expr)
