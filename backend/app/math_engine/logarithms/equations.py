from sympy import Eq, Pow
from sympy import log as sympy_log
from sympy import solve
from sympy.parsing.sympy_parser import (
    convert_equals_signs,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

from ..errors import ExpressionError

_TRANSFORMATIONS = standard_transformations + (
    implicit_multiplication_application,
    convert_equals_signs,
)

# Mesma convenção de dispatcher.py: log = base 10, ln = base e. Duplicado
# aqui (em vez de importado) seguindo o mesmo padrão já usado entre
# trigonometry/dispatcher.py e trigonometry/equations.py (cada arquivo que
# chama parse_expr mantém sua própria cópia).
_LOCAL_DICT = {
    "log": lambda x: sympy_log(x, 10),
    "ln": sympy_log,
}


def _validate_exponential_base(equation: Eq, symbol) -> None:
    # Suporte a a**x = b restrito a bases LITERAIS positivas e diferentes de 1
    # (ex.: 2**x = 8, 10**x = 1000, 5**x = 125). Base simbólica (a**x = b com
    # "a" incógnita) está fora do escopo desta sprint — nem chega a ser
    # roteada para logarithms/, pois _EXP_LITERAL_BASE_PATTERN (dispatcher.py)
    # só casa base numérica.
    for node in equation.atoms(Pow):
        base, expoente = node.args
        if not base.is_number or symbol not in expoente.free_symbols:
            continue
        if base <= 0 or base == 1:
            raise ExpressionError(
                "A base de uma equação exponencial deve ser um número real positivo diferente de 1."
            )


def solve_log_equation(text: str) -> str:
    try:
        parsed = parse_expr(text, transformations=_TRANSFORMATIONS, local_dict=_LOCAL_DICT)
    except Exception as exc:
        raise ExpressionError(f"Não foi possível interpretar a equação: {text}") from exc

    if not isinstance(parsed, Eq):
        raise ExpressionError(f"Não foi possível interpretar a equação: {text}")

    symbols = list(parsed.free_symbols)
    if len(symbols) != 1:
        raise ExpressionError(
            "Só é possível resolver equações logarítmicas/exponenciais de uma única incógnita nesta versão."
        )
    symbol = symbols[0]

    _validate_exponential_base(parsed, symbol)

    solutions = solve(parsed, symbol)
    return ", ".join(f"{symbol} = {solucao}" for solucao in solutions)
