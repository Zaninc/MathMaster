from sympy import Integer
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from .classification import LOGARITMICA
from .evaluate import evaluate_function


def y_intercept(expr: Expr, symbol: Symbol, kind: str) -> str:
    if kind == LOGARITMICA:
        # x = 0 está fora do domínio de log(x)/ln(x) — evaluate_function
        # em x=0 daria "zoo" (ver Sprint 7.1 §6.3), não um valor legítimo de
        # "indefinido em x = ..." (que é reservado para descontinuidade
        # removível de função racional).
        return "inexistente"

    valor = evaluate_function(expr, symbol, Integer(0))
    if valor.startswith("indefinido"):
        return valor

    return f"(0, {valor})"
