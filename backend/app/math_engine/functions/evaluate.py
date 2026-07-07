from sympy import simplify
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from .rational import denominator_roots, is_rational_function


def evaluate_function(expr: Expr, symbol: Symbol, value: Expr) -> str:
    if is_rational_function(expr, symbol) and value in denominator_roots(expr, symbol):
        return f"indefinido em {symbol} = {value}"

    return str(simplify(expr.subs(symbol, value)))
