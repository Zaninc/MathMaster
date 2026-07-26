"""Sprint V2.5 (Sistemas Polinomiais Não Lineares) — classificação
linear × não linear via ÁRVORE SymPy, nunca regex: cada equação já
parseada (`lhs - rhs`) é testada como polinômio nos símbolos do sistema
(`Expr.as_poly`), e o grau total decide o roteamento. `as_poly` devolve
`None` para qualquer termo transcendental das incógnitas (sin/cos/exp/
log/Abs/...) — a forma canônica do SymPy de dizer "isto não é um
polinômio nestas variáveis".

Só `equations/dispatcher.py` (ponto único de roteamento) e
`equations/nonlinear.py` (reaproveita `is_polynomial_system` como guarda
de segurança antes de chamar `nonlinsolve`) usam este módulo.
`equations/systems.py` (motor linear original, `linsolve`) permanece
100% intocado — nunca importa nem é importado por este arquivo.
"""
from __future__ import annotations

from sympy import Eq
from sympy.core.symbol import Symbol


def is_polynomial_system(equations: list[Eq], symbols: list[Symbol]) -> bool:
    """True apenas se TODA equação for um polinômio nos símbolos do
    sistema. Usado como guarda de segurança direta antes de chamar
    `nonlinsolve`: confirmado empiricamente que passar uma equação não
    polinomial (ex. "Abs(x)+y=5") para `nonlinsolve` não levanta erro
    nenhum — devolve uma "solução" matematicamente ERRADA em silêncio
    (o solver trata a função transcendental como um bloco opaco em vez de
    recusar). Esta guarda existe para EVITAR isso, não é só cosmética."""
    for equation in equations:
        try:
            poly = (equation.lhs - equation.rhs).as_poly(*symbols)
        except Exception:
            return False
        if poly is None:
            return False
    return True


def is_linear_system(equations: list[Eq], symbols: list[Symbol]) -> bool:
    """True apenas se TODA equação for um polinômio de grau total <= 1
    nos símbolos do sistema — mesmo critério que `sympy.linsolve` espera
    implicitamente, verificado ANTES de decidir entre `linsolve` (grau <=
    1 em tudo) e `nonlinsolve` (qualquer outro polinômio). Verificado
    empiricamente: "x+y=5"/"2x-3y=1"/"3x+4y-2z=7" têm grau 1;
    "x**2+y=5"/"x*y=6"/"x**2+y**2=25"/"(x+1)(y-2)=0" têm grau 2."""
    for equation in equations:
        try:
            poly = (equation.lhs - equation.rhs).as_poly(*symbols)
        except Exception:
            return False
        if poly is None or poly.total_degree() > 1:
            return False
    return True
