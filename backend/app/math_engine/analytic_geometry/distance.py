from __future__ import annotations

from sympy import simplify, sqrt
from sympy.core.expr import Expr

from .points import Point


def distance_between_points(p1: Point, p2: Point) -> Expr:
    return simplify(sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2))
