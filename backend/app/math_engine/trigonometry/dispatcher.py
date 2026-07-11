import re

from sympy import pi
from sympy.parsing.sympy_parser import (
    implicit_multiplication_application,
    standard_transformations,
)

from ..errors import ExpressionError
from ..safe_parsing import safe_parse_expr
from .classification import INVERSA, NOTAVEL, classify_trig_expression, label_for
from .equations import solve_trig_equation
from .inverse import evaluate_inverse, mentions_inverse_trig, validate_inverse_domain
from .simplify import simplify_trig
from .values import evaluate_notable_value

_TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application,)

# parse_expr não reconhece "tau" nativamente (viraria um Symbol("tau") solto,
# não a constante 2*pi) — mapeamos explicitamente para que "tau" funcione
# nas expressões trigonométricas assim como "pi" já funciona nativamente.
_LOCAL_DICT = {"tau": 2 * pi}

_TRIG_FUNCTION_PATTERN = re.compile(r"\b(sin|cos|tan|asin|acos|atan)\s*\(")
_EQUALS_PATTERN = re.compile(r"(?<![<>=!])=(?!=)")
_INEQUALITY_PATTERN = re.compile(r"<=|>=|<|>")


def is_trigonometry_domain_expression(expression: str) -> bool:
    return bool(_TRIG_FUNCTION_PATTERN.search(expression))


def _looks_like_equation(expression: str) -> bool:
    return bool(_EQUALS_PATTERN.search(expression))


def _looks_like_inequality(expression: str) -> bool:
    return bool(_INEQUALITY_PATTERN.search(expression))


def solve_trigonometry_text(expression: str) -> str:
    if _looks_like_inequality(expression):
        raise ExpressionError(
            "Inequações trigonométricas ainda não fazem parte do escopo desta versão."
        )

    if _looks_like_equation(expression):
        return solve_trig_equation(expression)

    try:
        expr = safe_parse_expr(expression, transformations=_TRANSFORMATIONS, local_dict=_LOCAL_DICT)
    except Exception as exc:
        raise ExpressionError(
            f"Não foi possível interpretar a expressão: {expression}"
        ) from exc

    kind = classify_trig_expression(expr, mentions_inverse_trig(expression))

    if kind == INVERSA:
        validate_inverse_domain(expr)
        resultado = evaluate_inverse(expr)
    elif kind == NOTAVEL:
        resultado = evaluate_notable_value(expr)
    else:
        resultado = str(simplify_trig(expr))

    return f"Tipo: {label_for(kind)}; Resultado: {resultado}"
