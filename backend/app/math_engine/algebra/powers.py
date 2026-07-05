from sympy import expand_multinomial
from sympy.core.expr import Expr


def simplify_powers(expr: Expr) -> Expr:
    return expand_multinomial(expr)
