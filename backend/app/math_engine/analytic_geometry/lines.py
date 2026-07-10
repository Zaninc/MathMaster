"""Núcleo algébrico de retas: coeficiente angular, equação geral (ax+by+c=0)
a partir de dois pontos ou de ponto+coeficiente angular, e interceptos.

Reta vertical/horizontal não são casos especiais tratados por branch em
line_from_points(): a fórmula geral "reta por dois pontos" (a=y2-y1,
b=x1-x2, c=-(a*x1+b*y1)) já produz a forma correta em ambos os casos
degenerados sem ramificação. slope() é a única função que retorna None
como sinal interno (reta vertical, coeficiente angular indefinido); quem
chama decide se isso é um erro (coeficiente_angular(), no dispatcher) ou
um caso legítimo a classificar (reta()).
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from sympy import Integer, simplify
from sympy.core.expr import Expr

from ..errors import ExpressionError
from .points import Point


@dataclass(frozen=True)
class LineEquation:
    a: Expr
    b: Expr
    c: Expr

    @property
    def is_vertical(self) -> bool:
        return self.b == 0

    @property
    def is_horizontal(self) -> bool:
        return self.a == 0


def _reduced(a: Expr, b: Expr, c: Expr) -> LineEquation:
    """Normaliza (a,b,c) para inteiros primos entre si, com o primeiro
    coeficiente não-nulo positivo, quando os três são racionais.
    Coeficientes irracionais (sqrt, pi, ...) são deixados como o SymPy os
    simplificou, sem tentativa de normalização de escala."""
    if not (a.is_Rational and b.is_Rational and c.is_Rational):
        return LineEquation(a, b, c)

    terms = [term for term in (a, b, c) if term != 0]
    if not terms:
        return LineEquation(a, b, c)

    den_lcm = 1
    for term in terms:
        den_lcm = math.lcm(den_lcm, int(term.q))

    a, b, c = a * den_lcm, b * den_lcm, c * den_lcm

    nums = [int(term) for term in (a, b, c) if term != 0]
    common = nums[0]
    for value in nums[1:]:
        common = math.gcd(common, value)
    if common not in (0, 1):
        a, b, c = a / common, b / common, c / common

    for term in (a, b, c):
        if term != 0:
            if term < 0:
                a, b, c = -a, -b, -c
            break

    return LineEquation(a, b, c)


def slope(p1: Point, p2: Point) -> Expr | None:
    if p1.x == p2.x and p1.y == p2.y:
        raise ExpressionError(
            f"Os pontos {p1} e {p2} são o mesmo ponto — não definem uma reta."
        )
    if p1.x == p2.x:
        return None
    return simplify((p2.y - p1.y) / (p2.x - p1.x))


def line_from_points(p1: Point, p2: Point) -> LineEquation:
    if p1.x == p2.x and p1.y == p2.y:
        raise ExpressionError(
            f"Os pontos {p1} e {p2} são o mesmo ponto — não definem uma reta única."
        )
    a = simplify(p2.y - p1.y)
    b = simplify(p1.x - p2.x)
    c = simplify(-(a * p1.x + b * p1.y))
    return _reduced(a, b, c)


def line_from_point_slope(point: Point, m: Expr) -> LineEquation:
    # y - y0 = m(x - x0)  =>  m*x - y + (y0 - m*x0) = 0. Nunca produz reta
    # vertical (m é sempre um valor definido nesta operação) — reta
    # vertical só é alcançável via reta(P1, P2) com x1 == x2.
    a = simplify(m)
    b = Integer(-1)
    c = simplify(point.y - m * point.x)
    return _reduced(a, b, c)


def x_intercept(line: LineEquation) -> Expr | str | None:
    if line.a != 0:
        return simplify(-line.c / line.a)
    if line.c == 0:
        return "todos os pontos (reta coincide com o eixo x)"
    return None


def y_intercept(line: LineEquation) -> Expr | str | None:
    if line.b != 0:
        return simplify(-line.c / line.b)
    if line.c == 0:
        return "todos os pontos (reta coincide com o eixo y)"
    return None
