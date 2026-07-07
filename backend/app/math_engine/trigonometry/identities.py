from sympy.core.expr import Expr

from .simplify import simplify_trig


def is_fundamental_identity(expr: Expr) -> bool:
    if not expr.free_symbols:
        return False
    return not simplify_trig(expr).free_symbols
