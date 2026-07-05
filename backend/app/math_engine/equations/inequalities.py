from sympy import S, solveset
from sympy.core.relational import Relational
from sympy.core.symbol import Symbol


def solve_inequality(inequality: Relational, symbol: Symbol) -> str:
    solution = solveset(inequality, symbol, domain=S.Reals)
    return str(solution)
