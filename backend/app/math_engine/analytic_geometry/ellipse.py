"""Elipse (Sprint 11): definida por centro + semieixo maior (a) + semieixo
menor (b). Sem suporte a rotação de eixos (fora de escopo), então o eixo
maior é sempre tomado paralelo ao eixo x por convenção — a sintaxe pública
não recebe orientação.
"""
from __future__ import annotations

from dataclasses import dataclass

from sympy import simplify, sqrt
from sympy.core.expr import Expr

from ..errors import ExpressionError
from .points import Point


@dataclass(frozen=True)
class Ellipse:
    center: Point
    a: Expr  # semieixo maior
    b: Expr  # semieixo menor


def ellipse_from_axes(center: Point, a: Expr, b: Expr) -> Ellipse:
    a, b = simplify(a), simplify(b)
    if a <= 0 or b <= 0:
        raise ExpressionError(f"Os semieixos de uma elipse devem ser positivos: a={a}, b={b}")
    if b >= a:
        raise ExpressionError(
            f"O semieixo menor ({b}) deve ser estritamente menor que o semieixo maior ({a})."
        )
    return Ellipse(center=center, a=a, b=b)


def _focal_distance(ellipse: Ellipse) -> Expr:
    return simplify(sqrt(ellipse.a ** 2 - ellipse.b ** 2))


def ellipse_focuses(ellipse: Ellipse) -> tuple[Point, Point]:
    c = _focal_distance(ellipse)
    cx, cy = ellipse.center.x, ellipse.center.y
    return Point(simplify(cx - c), cy), Point(simplify(cx + c), cy)


def ellipse_eccentricity(ellipse: Ellipse) -> Expr:
    return simplify(_focal_distance(ellipse) / ellipse.a)
