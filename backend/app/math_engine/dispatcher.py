from sympy.parsing.sympy_parser import (
    implicit_multiplication_application,
    standard_transformations,
)

from .algebra.dispatcher import solve_algebra
from .analytic_geometry.dispatcher import (
    is_analytic_geometry_domain_expression,
    solve_analytic_geometry_text,
)
from .calculus.dispatcher import is_calculus_domain_expression, solve_calculus_text
from .equations.dispatcher import is_equation_domain_expression, solve_equation_text
from .errors import ExpressionError
from .functions.dispatcher import is_function_domain_expression, solve_function_text
from .logarithms.dispatcher import (
    is_logarithm_domain_expression,
    solve_logarithm_text,
)
from .parser.normalize import normalize_expression
from .safe_parsing import safe_parse_expr
from .trigonometry.dispatcher import (
    is_trigonometry_domain_expression,
    solve_trigonometry_text,
)

_TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application,)


def solve_expression(expression: str) -> str:
    expression = expression.strip()
    if not expression:
        raise ExpressionError("A expressão não pode estar vazia.")

    # Sprint Parser — normaliza Unicode/aliases ANTES de qualquer
    # roteamento de domínio, porque os roteadores abaixo decidem por regex
    # sobre o texto bruto (ex. "sen(x)" só é reconhecido como trigonometria
    # depois de virar "sin(x)"). Ver docstring de `parser/normalize.py`.
    expression = normalize_expression(expression)

    if is_analytic_geometry_domain_expression(expression):
        return solve_analytic_geometry_text(expression)

    # Sprint 12 — precisa vir antes de functions/trigonometry/logarithms:
    # essas áreas casam "sin("/"log(" em qualquer posição do texto, o que
    # roubaria uma chamada como "integral(sin(x), x)" se checado depois.
    if is_calculus_domain_expression(expression):
        return solve_calculus_text(expression)

    if is_function_domain_expression(expression):
        return solve_function_text(expression)

    if is_trigonometry_domain_expression(expression):
        return solve_trigonometry_text(expression)

    if is_logarithm_domain_expression(expression):
        return solve_logarithm_text(expression)

    if is_equation_domain_expression(expression):
        return solve_equation_text(expression)

    try:
        parsed = safe_parse_expr(expression, transformations=_TRANSFORMATIONS)
    except Exception as exc:
        raise ExpressionError(
            f"Não foi possível interpretar a expressão: {expression}"
        ) from exc

    return solve_algebra(parsed)
