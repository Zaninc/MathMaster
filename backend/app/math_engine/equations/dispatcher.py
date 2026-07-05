import re

from sympy import Abs, Eq, degree
from sympy.core.relational import Relational
from sympy.parsing.sympy_parser import (
    convert_equals_signs,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

from ..errors import ExpressionError
from .absolute import solve_absolute_equation
from .inequalities import solve_inequality
from .linear import solve_linear
from .polynomial import solve_polynomial
from .quadratic import solve_quadratic
from .systems import solve_linear_system

_TRANSFORMATIONS = standard_transformations + (
    implicit_multiplication_application,
    convert_equals_signs,
)

_EQUALS_PATTERN = re.compile(r"(?<![<>=!])=(?!=)")
_INEQUALITY_PATTERN = re.compile(r"<=|>=|<|>")
_SPLIT_PATTERN = re.compile(r"[;\n]+")


def looks_like_equation(expression: str) -> bool:
    return bool(_EQUALS_PATTERN.search(expression))


def looks_like_inequality(expression: str) -> bool:
    return bool(_INEQUALITY_PATTERN.search(expression))


def is_equation_domain_expression(expression: str) -> bool:
    return looks_like_equation(expression) or looks_like_inequality(expression)


def _split_equations(expression: str) -> list[str]:
    return [part.strip() for part in _SPLIT_PATTERN.split(expression) if part.strip()]


def _parse_equation(text: str) -> Eq:
    try:
        parsed = parse_expr(text, transformations=_TRANSFORMATIONS)
    except Exception as exc:
        raise ExpressionError(f"Não foi possível interpretar a equação: {text}") from exc

    if not isinstance(parsed, Eq):
        raise ExpressionError(f"Não foi possível interpretar a equação: {text}")

    return parsed


def _solve_single_inequality(text: str) -> str:
    try:
        parsed = parse_expr(text, transformations=_TRANSFORMATIONS)
    except Exception as exc:
        raise ExpressionError(f"Não foi possível interpretar a inequação: {text}") from exc

    if not isinstance(parsed, Relational):
        raise ExpressionError(f"Não foi possível interpretar a inequação: {text}")

    symbols = list(parsed.free_symbols)
    if len(symbols) != 1:
        raise ExpressionError(
            "Só é possível resolver inequações de uma única incógnita nesta versão."
        )

    return solve_inequality(parsed, symbols[0])


def solve_equation_text(expression: str) -> str:
    if looks_like_inequality(expression):
        return _solve_single_inequality(expression)

    parts = _split_equations(expression)
    equations = [_parse_equation(part) for part in parts]

    if len(equations) > 1:
        symbols = sorted(
            {symbol for equation in equations for symbol in equation.free_symbols},
            key=str,
        )
        return solve_linear_system(equations, symbols)

    equation = equations[0]
    symbols = list(equation.free_symbols)
    if len(symbols) != 1:
        raise ExpressionError(
            "Só é possível resolver equações de uma única incógnita nesta versão."
        )
    symbol = symbols[0]

    if equation.has(Abs):
        return solve_absolute_equation(equation, symbol)

    try:
        grau = degree(equation.lhs - equation.rhs, symbol)
    except Exception as exc:
        raise ExpressionError(
            f"Não foi possível determinar o grau da equação: {equation}"
        ) from exc

    if grau == 1:
        return solve_linear(equation, symbol)
    if grau == 2:
        return solve_quadratic(equation, symbol)
    if grau >= 3:
        return solve_polynomial(equation, symbol)

    raise ExpressionError(f"Equações de grau {grau} ainda não são suportadas nesta versão.")
