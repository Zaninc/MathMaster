from sympy import Integer
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from .evaluate import evaluate_function


def y_intercept(expr: Expr, symbol: Symbol) -> str:
    valor = evaluate_function(expr, symbol, Integer(0))
    if valor.startswith("indefinido"):
        return valor

    return f"(0, {valor})"
