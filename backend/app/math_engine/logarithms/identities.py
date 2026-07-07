from sympy.core.expr import Expr

from .simplify import simplify_log


def is_log_identity(expr: Expr) -> bool:
    if not expr.free_symbols:
        return False
    return not simplify_log(expr).free_symbols
