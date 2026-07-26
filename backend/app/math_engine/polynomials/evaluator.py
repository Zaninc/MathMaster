r"""Sprint V2.6 — cálculos do Motor de Polinômios Avançados.

`factor_polynomial`/`expand_polynomial` reaproveitam 100% de
`algebra/factor.py`/`algebra/expand.py` (zero lógica de SymPy duplicada,
regra explícita da sprint: "Não duplicar lógica existente do SymPy" e
"Não adicionar lógica diretamente dentro de algebra/") — a única diferença
é o roteamento: aqui chega por uma chamada nomeada explícita
("fatorar(...)"/"expandir(...)"), não pelo fallback genérico de
`algebra/dispatcher.py:solve_algebra`. `simplificar`/`grau`/`coeficientes`/
`raízes`/`divisão` são operações novas desta área, sem equivalente pronto
em nenhum outro módulo do motor."""
from __future__ import annotations

from sympy import cancel, div, solve
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol
from sympy.polys.polytools import Poly

from ..algebra.expand import expand_expression
from ..algebra.factor import factor_expression
from ..errors import ExpressionError


def factor_polynomial(expr: Expr) -> Expr:
    return factor_expression(expr)


def expand_polynomial(expr: Expr) -> Expr:
    return expand_expression(expr)


def simplify_polynomial(expr: Expr) -> Expr:
    """`cancel()` (não `simplify()` genérico): reduz uma expressão racional
    cancelando o MDC entre numerador e denominador — determinístico e
    suficiente para os dois casos pedidos pela sprint
    ("(x²-1)/(x-1)" -> "x+1", "(x²+2x+x²)/2" -> "x²+x"), confirmado
    empiricamente durante o planejamento."""
    return cancel(expr)


def polynomial_degree(poly: Poly):
    """`Poly(0, x).degree()` devolve o singleton `-oo` do SymPy (convenção
    oficial do SymPy para o polinômio nulo, adotada aqui sem alteração —
    ver docstring de `formatter.py:format_degree` para como isso chega ao
    usuário como "-∞")."""
    return poly.degree()


def polynomial_coefficients(poly: Poly) -> list:
    """Sempre inclui os coeficientes nulos intermediários (ex.
    "x³+2x²-5" -> [1, 2, 0, -5]) — comportamento nativo de
    `Poly.all_coeffs()`, nenhum filtro adicional necessário."""
    return poly.all_coeffs()


def polynomial_roots(expr: Expr, symbol: Symbol) -> list:
    """Raízes distintas (sem multiplicidade), incluindo complexas — mesma
    função (`sympy.solve`) já usada por `equations/quadratic.py`/
    `equations/polynomial.py` para resolver "expr = 0"."""
    return solve(expr, symbol)


def polynomial_division(dividend: Expr, divisor: Expr, symbol: Symbol) -> tuple[Expr, Expr]:
    try:
        return div(dividend, divisor, symbol)
    except ZeroDivisionError as exc:
        raise ExpressionError(
            "Não é possível dividir um polinômio por um divisor nulo."
        ) from exc
