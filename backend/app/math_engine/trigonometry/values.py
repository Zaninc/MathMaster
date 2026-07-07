from sympy import simplify
from sympy.core.expr import Expr


def evaluate_notable_value(expr: Expr) -> str:
    return str(simplify(expr))
