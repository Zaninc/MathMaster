from __future__ import annotations

from sympy import simplify

from .points import Point


def midpoint(p1: Point, p2: Point) -> Point:
    return Point(x=simplify((p1.x + p2.x) / 2), y=simplify((p1.y + p2.y) / 2))
