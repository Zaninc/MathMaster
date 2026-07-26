from sympy import Eq, linsolve
from sympy.core.symbol import Symbol
from sympy.solvers.solveset import NonlinearError

from ..errors import ExpressionError


def solve_linear_system(equations: list[Eq], symbols: list[Symbol]) -> str:
    # `linsolve` é estritamente para sistemas LINEARES — um termo não linear
    # em qualquer equação (potência, produto entre incógnitas, função
    # transcendental) faz o sympy levantar `NonlinearError` em vez de
    # devolver uma solução ou um conjunto vazio. Capturado aqui (não em
    # `dispatcher.py`, nem com `except Exception` genérico) porque este é o
    # ÚNICO ponto do domínio de sistemas que chama `linsolve` — qualquer
    # outra exceção (um bug real) continua subindo intocada, sem virar
    # `ExpressionError` por engano (ver `_run_solve` em `app/execution.py`:
    # só `ExpressionError` vira mensagem amigável; qualquer outra exceção
    # vira "internal_error").
    try:
        solution = linsolve(equations, symbols)
    except NonlinearError as exc:
        raise ExpressionError(
            "Sistemas não lineares ainda não são suportados nesta versão. "
            "Use apenas equações de primeiro grau."
        ) from exc
    if not solution:
        return "Sistema sem solução"

    values = next(iter(solution))
    return ", ".join(f"{symbol} = {value}" for symbol, value in zip(symbols, values))
