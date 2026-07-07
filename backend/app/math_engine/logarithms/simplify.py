from sympy import logcombine, powdenest, simplify
from sympy.core.expr import Expr


def simplify_log(expr: Expr) -> Expr:
    return simplify(powdenest(logcombine(expr, force=True), force=True))
