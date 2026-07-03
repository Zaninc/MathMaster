from sympy import factor, simplify
from sympy.parsing.sympy_parser import (
    parse_expr,
    standard_transformations,
    implicit_multiplication_application,
)

_TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application,)


class ExpressionError(ValueError):
    """Erro de interpretação ou avaliação de uma expressão matemática."""


def solve_expression(expression: str) -> str:
    """Resolve uma expressão matemática simples via SymPy.

    Suporta, no V0: simplificação, fatoração simples de expressões algébricas,
    e chamadas diretas às funções do SymPy (ex.: "diff(x**2, x)",
    "integrate(x**2, x)"), já resolvidas durante a própria interpretação.
    """
    expression = expression.strip()
    if not expression:
        raise ExpressionError("A expressão não pode estar vazia.")

    try:
        parsed = parse_expr(expression, transformations=_TRANSFORMATIONS)
    except Exception as exc:
        raise ExpressionError(
            f"Não foi possível interpretar a expressão: {expression}"
        ) from exc

    try:
        result = factor(parsed)
    except Exception:
        try:
            result = simplify(parsed)
        except Exception:
            result = parsed

    return str(result)
