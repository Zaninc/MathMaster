"""Hipérbole (Sprint 11): definida por centro + semieixo real/transverso
(a) + semieixo imaginário/conjugado (b). Sem suporte a rotação de eixos
(fora de escopo), então o eixo transverso é sempre tomado paralelo ao eixo
x por convenção — a sintaxe pública não recebe orientação.
"""
from __future__ import annotations

from dataclasses import dataclass

from sympy import Symbol, expand, simplify, sqrt
from sympy.core.expr import Expr

from ..errors import ExpressionError
from .points import Point

_X = Symbol("x")


@dataclass(frozen=True)
class Hyperbola:
    center: Point
    a: Expr  # semieixo real (transverso)
    b: Expr  # semieixo imaginário (conjugado)


def hyperbola_from_axes(center: Point, a: Expr, b: Expr) -> Hyperbola:
    a, b = simplify(a), simplify(b)
    if a <= 0 or b <= 0:
        raise ExpressionError(f"Os semieixos de uma hipérbole devem ser positivos: a={a}, b={b}")
    return Hyperbola(center=center, a=a, b=b)


def _focal_distance(hyperbola: Hyperbola) -> Expr:
    return simplify(sqrt(hyperbola.a ** 2 + hyperbola.b ** 2))


def hyperbola_focuses(hyperbola: Hyperbola) -> tuple[Point, Point]:
    c = _focal_distance(hyperbola)
    cx, cy = hyperbola.center.x, hyperbola.center.y
    return Point(simplify(cx - c), cy), Point(simplify(cx + c), cy)


def hyperbola_asymptotes(hyperbola: Hyperbola) -> tuple[Expr, Expr]:
    """Retorna (expr1, expr2): os lados direitos de "y = ...", já expandidos
    em função de x — quem chama (render.py) monta a string final."""
    h, k = hyperbola.center.x, hyperbola.center.y
    slope = hyperbola.b / hyperbola.a
    asym1 = expand(k + slope * (_X - h))
    asym2 = expand(k - slope * (_X - h))
    return asym1, asym2


def hyperbola_eccentricity(hyperbola: Hyperbola) -> Expr:
    return simplify(_focal_distance(hyperbola) / hyperbola.a)
