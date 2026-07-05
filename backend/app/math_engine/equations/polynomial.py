from sympy import Eq, solve
from sympy.core.symbol import Symbol


def solve_polynomial(equation: Eq, symbol: Symbol) -> str:
    solutions = solve(equation, symbol)
    return ", ".join(f"{symbol} = {solution}" for solution in solutions)
