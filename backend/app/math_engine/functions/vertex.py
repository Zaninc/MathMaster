from sympy import Poly, simplify
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol


def compute_vertex(expr: Expr, symbol: Symbol) -> str:
    poly = Poly(expr, symbol)
    a, b, _c = poly.all_coeffs()

    xv = simplify(-b / (2 * a))
    yv = simplify(expr.subs(symbol, xv))

    return f"({xv}, {yv})"
