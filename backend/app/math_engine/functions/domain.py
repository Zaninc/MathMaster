from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from .classification import RACIONAL
from .rational import denominator_roots

_REAIS = "ℝ"


def compute_domain(expr: Expr, symbol: Symbol, kind: str) -> str:
    if kind != RACIONAL:
        return _REAIS

    excluidos = denominator_roots(expr, symbol)
    if not excluidos:
        return _REAIS

    valores = ", ".join(str(valor) for valor in excluidos)
    return f"{_REAIS} - {{{valores}}}"
