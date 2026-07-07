from sympy import simplify
from sympy.core.expr import Expr


def evaluate_log_expression(expr: Expr) -> str:
    return str(simplify(expr))
