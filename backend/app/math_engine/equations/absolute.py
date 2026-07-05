from sympy import Eq, S, solveset
from sympy.core.symbol import Symbol


def solve_absolute_equation(equation: Eq, symbol: Symbol) -> str:
    solution = solveset(equation, symbol, domain=S.Reals)
    return str(solution)
