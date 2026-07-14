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
from .calculus.natural_notation import normalize_calculus_notation
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


def normalize_all(expression: str) -> str:
    """Compõe as duas camadas de normalização puramente textual, nesta
    ordem exata: Sprint Parser (Unicode/aliases gerais) primeiro, depois
    Sprint 12.1 (notação natural de cálculo — d/dx, ∫, lim), que já espera
    receber o texto geral já normalizado (ex. "sen(x)" -> "sin(x)" antes de
    "d/dx(sen(x))" virar "derivada(sin(x), x)"). Único ponto de entrada
    usado tanto por `solve_expression` quanto por `main.py` (que recalcula
    a normalização à parte só para formatar/rotular o resultado, nunca para
    o histórico — ver `app/main.py`)."""
    return normalize_calculus_notation(normalize_expression(expression))


def solve_expression(expression: str) -> str:
    expression = expression.strip()
    if not expression:
        raise ExpressionError("A expressão não pode estar vazia.")

    # Sprint Parser + Sprint 12.1 — normaliza Unicode/aliases/notação
    # natural de cálculo ANTES de qualquer roteamento de domínio, porque os
    # roteadores abaixo decidem por regex sobre o texto bruto (ex. "sen(x)"
    # só é reconhecido como trigonometria depois de virar "sin(x)"; "d/dx(x)"
    # só é reconhecido como cálculo depois de virar "derivada(x, x)"). Ver
    # docstrings de `parser/normalize.py` e `calculus/natural_notation.py`.
    expression = normalize_all(expression)

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
