import re

from sympy import Abs, Eq, degree
from sympy.core.relational import Relational
from sympy.parsing.sympy_parser import (
    convert_equals_signs,
    implicit_multiplication_application,
    standard_transformations,
)

from ..errors import ExpressionError
from ..safe_parsing import safe_parse_expr
from .absolute import solve_absolute_equation
from .inequalities import solve_inequality
from .linear import solve_linear
from .nonlinear import solve_nonlinear_system
from .nonlinear_validation import is_linear_system
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


def split_equations(expression: str) -> list[str]:
    return [part.strip() for part in _SPLIT_PATTERN.split(expression) if part.strip()]


def split_equation_sides(text: str) -> tuple[str, str]:
    """Sprint V2.9 (Passo a Passo) — divide uma equação de um único "="
    em (lado_esquerdo, lado_direito) SEM deixar o SymPy avaliar a
    igualdade. `_parse_equation` (usado por `solve_equation_text`) passa
    por `convert_equals_signs` + `Eq(...)`, e o SymPy, quando consegue
    PROVAR que a igualdade é sempre verdadeira ou sempre falsa
    independente de x (ex. "2x+1=2x+3", "2x+1=2x+1"), devolve
    `BooleanFalse`/`BooleanTrue` em vez de um `Eq` — exatamente os casos
    de identidade/contradição que a infraestrutura de passos precisa
    apresentar com passos próprios, não rejeitar. Esta função nunca
    constrói um `Eq`; devolve os dois lados como texto, para cada um ser
    parseado separadamente por quem chamar (`math_engine.steps`)."""
    parts = _EQUALS_PATTERN.split(text)
    if len(parts) != 2 or not parts[0].strip() or not parts[1].strip():
        raise ExpressionError(f"Não foi possível interpretar a equação: {text}")
    return parts[0].strip(), parts[1].strip()


def _parse_equation(text: str) -> Eq:
    try:
        parsed = safe_parse_expr(text, transformations=_TRANSFORMATIONS)
    except Exception as exc:
        raise ExpressionError(f"Não foi possível interpretar a equação: {text}") from exc

    if not isinstance(parsed, Eq):
        raise ExpressionError(f"Não foi possível interpretar a equação: {text}")

    return parsed


def _solve_single_inequality(text: str) -> str:
    try:
        parsed = safe_parse_expr(text, transformations=_TRANSFORMATIONS)
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

    parts = split_equations(expression)
    equations = [_parse_equation(part) for part in parts]

    if len(equations) > 1:
        symbols = sorted(
            {symbol for equation in equations for symbol in equation.free_symbols},
            key=str,
        )
        # Sprint V2.5 — a classificação linear x não linear usa a árvore
        # SymPy (`nonlinear_validation.is_linear_system`, grau total <= 1
        # em todos os símbolos), nunca regex. `solve_linear_system`
        # (`linsolve`) permanece o único caminho para sistemas lineares,
        # 100% intocado; `solve_nonlinear_system` (`nonlinsolve`) é uma
        # camada nova e separada para tudo que tiver grau > 1.
        if is_linear_system(equations, symbols):
            return solve_linear_system(equations, symbols)
        return solve_nonlinear_system(equations, symbols)

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
