"""Sprint 12 — integrais indefinidas e definidas.

`sympy.integrate()` não levanta exceção quando não encontra uma forma
fechada: devolve silenciosamente um `Integral(...)` (ou uma subclasse, ex.
`NonElementaryIntegral`) não avaliado — confirmado empiricamente com
`integrate(x**x, x)`. A constante de integração ("+ C") nunca é adicionada
aqui: este módulo só devolve valores SymPy, a apresentação é
responsabilidade exclusiva de `dispatcher.py` (decisão da Sprint 12).

Para a integral definida, o mesmo conjunto de resultados (`oo`/`-oo`/`zoo`/
`nan`) cobre tanto limites impróprios divergentes quanto singularidades
dentro do intervalo (confirmado empiricamente: `integrate(1/x, (x, -1, 1))`
-> `nan`, `integrate(1/x**2, (x, -1, 1))` -> `oo`) — não é necessário
distinguir os dois casos.
"""
from __future__ import annotations

from sympy import Integral, nan, oo, zoo
from sympy import integrate as _sympy_integrate
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..errors import ExpressionError

_DIVERGENT_SINGLETONS = (oo, -oo, zoo, nan)


def _is_divergent(value: Expr) -> bool:
    return any(value is singleton for singleton in _DIVERGENT_SINGLETONS)


def compute_indefinite_integral(expr: Expr, symbol: Symbol) -> Expr:
    try:
        result = _sympy_integrate(expr, symbol)
    except Exception as exc:
        raise ExpressionError(f"Não foi possível calcular a integral de {expr}.") from exc

    if result.has(Integral):
        raise ExpressionError(
            f"Não foi possível calcular a integral de {expr} nesta versão."
        )
    return result


def compute_definite_integral(expr: Expr, symbol: Symbol, lower: Expr, upper: Expr) -> Expr:
    try:
        result = _sympy_integrate(expr, (symbol, lower, upper))
    except Exception as exc:
        raise ExpressionError(
            f"Não foi possível calcular a integral definida de {expr}."
        ) from exc

    if result.has(Integral):
        raise ExpressionError(
            f"Não foi possível calcular a integral definida de {expr} nesta versão."
        )
    if _is_divergent(result):
        raise ExpressionError(
            f"A integral definida de {expr} diverge ou é indefinida nesta versão."
        )
    return result
