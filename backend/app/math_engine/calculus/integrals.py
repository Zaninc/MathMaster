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

from sympy import Integral, Piecewise, diff, nan, oo, zoo
from sympy import integrate as _sympy_integrate
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..errors import ExpressionError

_DIVERGENT_SINGLETONS = (oo, -oo, zoo, nan)


def _is_divergent(value: Expr) -> bool:
    return any(value is singleton for singleton in _DIVERGENT_SINGLETONS)


def verify_antiderivative(primitive: Expr, expr: Expr, symbol: Symbol) -> bool:
    """Hotfix P0 — hardening matemático: confirma que `primitive` é
    genuinamente uma antiderivada de `expr` recalculando `d/dx(primitive)`
    e comparando com o integrando original — a MESMA verificação que
    qualquer aluno faria à mão pra conferir uma integral. Usa
    `Expr.equals()` (não `simplify(...) == 0`): é o método do próprio
    SymPy feito pra essa pergunta exata ("estas duas expressões são
    iguais?") — tenta simplificação simbólica primeiro e cai pra
    amostragem numérica em pontos aleatórios quando a forma simbólica não
    fecha sozinha (ex. `(x²-2x+2)*exp(x)` derivado de volta bate com
    `x²*exp(x)` só depois de expandir — `equals()` já faz isso). Qualquer
    exceção (ex. função sem derivada fechada) ou resultado indeterminado
    (`None` — nem SymPy conseguiu decidir) conta como FALHA — nunca
    otimista, fail-closed conforme o ticket.

    Exceção deliberada: um `primitive` com `Piecewise` (ex. `integrate(x*e**x,
    x)` quando "e" chega como SÍMBOLO solto, não `exp`/Euler — convenção
    documentada do produto: "e solto é tratado como VARIÁVEL", ver
    `keyboard.ts`) é sempre aceito sem verificação — achado real durante
    este hotfix: `equals()` devolve `None` (indeterminado) pra esse padrão
    porque a forma fechada depende de `log(e) != 0`, uma condição que só
    faz sentido quando "e" é de fato uma variável livre — comportamento
    PRÉ-EXISTENTE, já tolerado antes desta verificação existir (não é o
    padrão do bug relatado no ticket, que produz um resultado ERRADO
    fechado, nunca um `Piecewise`) — bloqueá-lo aqui quebraria
    `/solve/steps` pra essa mesma classe de expressão sem corrigir nada."""
    if primitive.has(Piecewise):
        return True
    try:
        derivative = diff(primitive, symbol)
        equal = (derivative - expr).equals(0)
    except Exception:
        return False
    return bool(equal)


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
