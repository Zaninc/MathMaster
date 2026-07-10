"""Circunferência (Sprint 11): definida por centro + raio, ou por centro +
um ponto pertencente à curva (raio = distância centro<->ponto, reaproveita
distance.py) — nunca por uma equação geral digitada livremente (fora de
escopo, reservado ao Parser Inteligente, mesma fronteira das retas na
Sprint 10).
"""
from __future__ import annotations

from dataclasses import dataclass

from sympy import Symbol, expand, simplify
from sympy.core.expr import Expr

from ..errors import ExpressionError
from .distance import distance_between_points
from .points import Point

_X = Symbol("x")
_Y = Symbol("y")


@dataclass(frozen=True)
class Circle:
    center: Point
    radius: Expr


def circle_from_center_radius(center: Point, radius: Expr) -> Circle:
    radius = simplify(radius)
    if radius <= 0:
        raise ExpressionError(f"O raio de uma circunferência deve ser positivo: {radius}")
    return Circle(center=center, radius=radius)


def circle_from_center_point(center: Point, point: Point) -> Circle:
    radius = distance_between_points(center, point)
    if radius == 0:
        raise ExpressionError(
            f"O ponto {point} coincide com o centro {center} — não define uma circunferência."
        )
    return Circle(center=center, radius=radius)


def circle_equation(circle: Circle) -> tuple[Expr, Expr]:
    """Retorna (lado_esquerdo, lado_direito) de (x-h)^2 + (y-k)^2 = r^2, já
    expandido — quem chama (render.py) monta a string final "lhs = rhs",
    mesmo padrão de render_line_block() em lines.py/render.py."""
    lhs = expand((_X - circle.center.x) ** 2 + (_Y - circle.center.y) ** 2)
    rhs = simplify(circle.radius ** 2)
    return lhs, rhs
