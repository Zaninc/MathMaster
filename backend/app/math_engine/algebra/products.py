from sympy import expand_mul
from sympy.core.expr import Expr


def expand_products(expr: Expr) -> Expr:
    return expand_mul(expr)
