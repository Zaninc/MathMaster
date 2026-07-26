"""Sprint V2.5 (Sistemas Polinomiais Não Lineares) — converte o resultado
cru de `nonlinsolve` (um `FiniteSet` de `Tuple`s, ou `EmptySet`) para o
MESMO estilo de texto que `equations/systems.py:solve_linear_system` já
produz para uma única solução ("x = 2, y = 3") — nunca um repr() do
SymPy (nada de "FiniteSet(...)"/"Tuple(...)" vazando pro usuário).

Múltiplas soluções são unidas com " ou " — mesmo separador que
`formatter/render_sets.py:render_periodic_solution` já usa para
alternativas de uma solução trigonométrica periódica, e já reconhecido
ponta a ponta pelo pipeline KaTeX do frontend
(`lib/math/to-latex.ts:valueToLatex`, branch `splitTopLevel(text, " ou
")`) — nenhuma mudança de frontend foi necessária para o eco de
múltiplas soluções. O RESULTADO final ("x = 2, y = 3 ou x = 3, y = 2")
passa por uma extensão pequena e simétrica do formatter existente
(`formatter/classify.py:is_multi_assignment_shape` +
`formatter/pipeline.py:_format_multi_assignment`) — reaproveita
`_format_assignment_list` já existente em cada ramo "ou", nunca duplica
a lógica de limpeza/ordenação de valores.

Este módulo NUNCA importa de `app.formatter` (dependência de mão única
já estabelecida no projeto: formatter lê a saída de math_engine, nunca o
contrário) — por isso duplica localmente uma versão mínima do
`sort_key` de `formatter/render_roots.py`, só para ordenar as soluções de
forma determinística (a ordem de iteração de um `FiniteSet` do SymPy não
é uma garantia de API).
"""
from __future__ import annotations

from sympy import FiniteSet
from sympy.core.symbol import Symbol
from sympy.polys.rootoftools import CRootOf
from sympy.sets.sets import Set as SymPySet

from ..errors import ExpressionError

_NO_SOLUTION_MESSAGE = "Sistema sem solução"
_INFINITE_SOLUTIONS_MESSAGE = "Sistema com infinitas soluções (indeterminado)."
_NO_CLOSED_FORM_MESSAGE = (
    "Não foi possível expressar a solução deste sistema em forma fechada nesta versão."
)
_UNEXPECTED_STRUCTURE_MESSAGE = (
    "Não foi possível interpretar a solução deste sistema não linear nesta versão."
)


def _sort_key(value):
    """Duplica `formatter/render_roots.py:sort_key` de propósito (ver
    docstring do módulo) — ordena por (parte real, parte imaginária);
    valores não numéricos (não deveriam ocorrer aqui, já filtrados antes
    desta função ser chamada) vão para o fim."""
    try:
        complex_value = complex(value.evalf())
        return (round(complex_value.real, 12), round(complex_value.imag, 12))
    except Exception:
        return (float("inf"), str(value))


def format_nonlinear_solutions(solutions: SymPySet, symbols: list[Symbol]) -> str:
    """`solutions` é o retorno cru de `nonlinsolve(equations, symbols)`.
    Levanta `ExpressionError` (nunca `RuntimeError`) para as duas formas
    de "não dá pra mostrar isto com fidelidade" (raiz sem forma fechada
    via `CRootOf`, ou uma estrutura que não seja o `FiniteSet` de `Tuple`s
    esperado) — qualquer outra exceção real de programação continua
    subindo intocada, nunca mascarada aqui."""
    if not solutions:
        return _NO_SOLUTION_MESSAGE

    if not isinstance(solutions, FiniteSet):
        raise ExpressionError(_UNEXPECTED_STRUCTURE_MESSAGE)

    tuples: list[tuple] = []
    for element in solutions:
        values = tuple(element) if hasattr(element, "__iter__") else (element,)
        if len(values) != len(symbols):
            raise ExpressionError(_UNEXPECTED_STRUCTURE_MESSAGE)
        tuples.append(values)

    symbol_set = set(symbols)
    for values in tuples:
        for value in values:
            if value.has(CRootOf):
                raise ExpressionError(_NO_CLOSED_FORM_MESSAGE)

    for values in tuples:
        for value in values:
            if value.free_symbols & symbol_set:
                return _INFINITE_SOLUTIONS_MESSAGE

    tuples.sort(key=lambda values: tuple(_sort_key(value) for value in values))

    branches = [
        ", ".join(f"{symbol} = {value}" for symbol, value in zip(symbols, values))
        for values in tuples
    ]
    return " ou ".join(branches)
