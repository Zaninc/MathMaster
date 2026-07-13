"""Sprint 12 — limites bilaterais.

`sympy.limit()` não avisa quando o limite não existe: pode devolver
`AccumBounds` (oscilação, ex. `sin(1/x)` em 0 — confirmado empiricamente) ou
um valor que diverge silenciosamente entre os lados esquerdo e direito sem
lançar exceção (ex. `limit(1/x, x, 0, dir='-')` = -oo vs `dir='+'` = oo).
Por isso o limite é sempre calculado dos dois lados e comparado
explicitamente — decisão da auditoria da Sprint 12 (limites laterais ficam
fora do escopo desta versão, só o bilateral é exposto).

`oo`/`-oo` são resultados VÁLIDOS (divergência para o infinito é uma
resposta correta, ex. limite de 1/x² quando x->0 é +oo) — só
`AccumBounds`/`zoo`/`nan`, ou os dois lados discordando, contam como "não
existe".

Mensagens de erro (ajuste pós-smoke-test): nunca imprimem o repr interno do
SymPy de um valor calculado (`AccumBounds(-1, 1)`, ou os próprios lados
esquerdo/direito) — só `expr`/`symbol`/`point`, que são a entrada do
usuário, não um resultado intermediário. Três mensagens distintas:
oscilação, indefinido (zoo/nan) e lados válidos mas diferentes.

Quando `ponto` já é `oo`/`-oo`, só existe uma direção de aproximação
possível — o limite é calculado uma única vez, sem parâmetro `dir`.
"""
from __future__ import annotations

from sympy import nan, oo, zoo
from sympy import limit as _sympy_limit
from sympy.calculus.util import AccumBounds
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..errors import ExpressionError

_UNDEFINED_SINGLETONS = (zoo, nan)


def _is_oscillating(value: Expr) -> bool:
    return isinstance(value, AccumBounds)


def _is_undefined(value: Expr) -> bool:
    return any(value is singleton for singleton in _UNDEFINED_SINGLETONS)


def _safe_limit(expr: Expr, symbol: Symbol, point: Expr, **kwargs) -> Expr:
    try:
        return _sympy_limit(expr, symbol, point, **kwargs)
    except Exception as exc:
        raise ExpressionError(
            f"Não foi possível calcular o limite de {expr} quando {symbol} -> {point}."
        ) from exc


def _raise_does_not_exist(expr: Expr, symbol: Symbol, point: Expr, *, oscillates: bool) -> None:
    if oscillates:
        raise ExpressionError(
            f"O limite de {expr} quando {symbol} -> {point} não existe "
            "porque a expressão oscila."
        )
    raise ExpressionError(f"O limite de {expr} quando {symbol} -> {point} não existe.")


def compute_limit(expr: Expr, symbol: Symbol, point: Expr) -> Expr:
    if point in (oo, -oo):
        result = _safe_limit(expr, symbol, point)
        if _is_oscillating(result):
            _raise_does_not_exist(expr, symbol, point, oscillates=True)
        if _is_undefined(result):
            _raise_does_not_exist(expr, symbol, point, oscillates=False)
        return result

    left = _safe_limit(expr, symbol, point, dir="-")
    right = _safe_limit(expr, symbol, point, dir="+")

    if _is_oscillating(left) or _is_oscillating(right):
        _raise_does_not_exist(expr, symbol, point, oscillates=True)

    if _is_undefined(left) or _is_undefined(right):
        _raise_does_not_exist(expr, symbol, point, oscillates=False)

    if left != right:
        raise ExpressionError(
            f"O limite de {expr} quando {symbol} -> {point} não existe "
            "(os limites laterais são diferentes)."
        )

    return left
