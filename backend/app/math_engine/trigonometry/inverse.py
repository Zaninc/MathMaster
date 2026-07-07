import re

from sympy import acos, asin, simplify
from sympy.core.expr import Expr

from ..errors import ExpressionError

_INVERSE_CALL_PATTERN = re.compile(r"\b(asin|acos|atan)\s*\(")


def mentions_inverse_trig(text: str) -> bool:
    """Detecta asin/acos/atan a partir do texto de origem, não da árvore já
    avaliada: o SymPy resolve argumentos "notáveis" (ex.: asin(1/2)) para
    pi/6 assim que a expressão é montada, removendo o próprio nó asin/acos/atan
    — checar a árvore resultante perderia esses casos."""
    return bool(_INVERSE_CALL_PATTERN.search(text))


def validate_inverse_domain(expr: Expr) -> None:
    for node in expr.atoms(asin, acos):
        argumento = node.args[0]
        if argumento.free_symbols:
            continue
        if argumento > 1 or argumento < -1:
            raise ExpressionError(
                f"{node.func.__name__}({argumento}) está fora do domínio [-1, 1]."
            )


def evaluate_inverse(expr: Expr) -> str:
    return str(simplify(expr))
