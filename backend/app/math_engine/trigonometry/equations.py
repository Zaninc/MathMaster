from sympy import Eq, S, pi, solveset
from sympy.parsing.sympy_parser import (
    convert_equals_signs,
    implicit_multiplication_application,
    standard_transformations,
)

from ..errors import ExpressionError
from ..safe_parsing import safe_parse_expr

_TRANSFORMATIONS = standard_transformations + (
    implicit_multiplication_application,
    convert_equals_signs,
)

# parse_expr não reconhece "tau" nativamente (viraria um Symbol("tau") solto,
# não a constante 2*pi) — mapeamos explicitamente para que "tau" funcione
# nas equações trigonométricas assim como "pi" já funciona nativamente.
_LOCAL_DICT = {"tau": 2 * pi}


def solve_trig_equation(text: str) -> str:
    try:
        parsed = safe_parse_expr(text, transformations=_TRANSFORMATIONS, local_dict=_LOCAL_DICT)
    except Exception as exc:
        raise ExpressionError(f"Não foi possível interpretar a equação: {text}") from exc

    if not isinstance(parsed, Eq):
        raise ExpressionError(f"Não foi possível interpretar a equação: {text}")

    symbols = list(parsed.free_symbols)
    if len(symbols) != 1:
        raise ExpressionError(
            "Só é possível resolver equações trigonométricas de uma única incógnita nesta versão."
        )

    solucao = solveset(parsed, symbols[0], domain=S.Reals)
    return str(solucao)
