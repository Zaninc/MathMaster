"""Sprint 12 — derivada simbólica de primeira ordem.

Sprint V3.0.6 (Derivadas de Ordem Superior) — `compute_derivative` ganhou
um `order` opcional (padrão 1, comportamento 100% preservado pra todo
chamador existente): `sympy.diff(expr, symbol, order)` já é a primitiva
NATIVA do SymPy pra derivada de ordem n (equivalente a aplicar
`sympy.diff` repetidamente, mas numa única chamada) — nenhum motor novo,
nenhum loop escrito à mão aqui. Derivadas parciais continuam fora do
escopo desta versão."""
from __future__ import annotations

from sympy import diff as _sympy_diff
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..errors import ExpressionError


def compute_derivative(expr: Expr, symbol: Symbol, order: int = 1) -> Expr:
    try:
        return _sympy_diff(expr, symbol, order)
    except Exception as exc:
        raise ExpressionError(f"Não foi possível calcular a derivada de {expr}.") from exc
