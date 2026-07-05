from sympy import Eq, linsolve
from sympy.core.symbol import Symbol


def solve_linear_system(equations: list[Eq], symbols: list[Symbol]) -> str:
    solution = linsolve(equations, symbols)
    if not solution:
        return "Sistema sem solução"

    values = next(iter(solution))
    return ", ".join(f"{symbol} = {value}" for symbol, value in zip(symbols, values))
