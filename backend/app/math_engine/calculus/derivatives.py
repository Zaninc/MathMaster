"""Sprint 12 — derivada simbólica de primeira ordem.

Ordens superiores e derivadas parciais ficam fora do escopo desta versão
(ver auditoria da Sprint 12)."""
from __future__ import annotations

from sympy import diff as _sympy_diff
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..errors import ExpressionError


def compute_derivative(expr: Expr, symbol: Symbol) -> Expr:
    try:
        return _sympy_diff(expr, symbol)
    except Exception as exc:
        raise ExpressionError(f"Não foi possível calcular a derivada de {expr}.") from exc
