from sympy.parsing.sympy_parser import (
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

from .algebra.dispatcher import solve_algebra
from .equations.dispatcher import is_equation_domain_expression, solve_equation_text
from .errors import ExpressionError

_TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application,)


def solve_expression(expression: str) -> str:
    expression = expression.strip()
    if not expression:
        raise ExpressionError("A expressão não pode estar vazia.")

    if is_equation_domain_expression(expression):
        return solve_equation_text(expression)

    try:
        parsed = parse_expr(expression, transformations=_TRANSFORMATIONS)
    except Exception as exc:
        raise ExpressionError(
            f"Não foi possível interpretar a expressão: {expression}"
        ) from exc

    return solve_algebra(parsed)
