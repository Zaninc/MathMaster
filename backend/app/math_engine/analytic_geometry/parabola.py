"""Parábola (Sprint 11): definida por vértice + foco. Eixo deve ser
paralelo a x ou a y — rotação de eixos está fora de escopo desta sprint,
então vértice e foco alinhados apenas na diagonal (nem mesma abscissa, nem
mesma ordenada) é rejeitado explicitamente em vez de produzir um eixo
incorreto.
"""
from __future__ import annotations

from dataclasses import dataclass

from sympy import simplify
from sympy.core.expr import Expr

from ..errors import ExpressionError
from .classification import HORIZONTAL, VERTICAL
from .points import Point


@dataclass(frozen=True)
class Parabola:
    vertex: Point
    focus: Point


def parabola_from_vertex_focus(vertex: Point, focus: Point) -> Parabola:
    if vertex.x == focus.x and vertex.y == focus.y:
        raise ExpressionError(
            f"O foco {focus} coincide com o vértice {vertex} — não define uma parábola."
        )
    if vertex.x != focus.x and vertex.y != focus.y:
        raise ExpressionError(
            "Esta versão só suporta parábolas com eixo paralelo aos eixos coordenados: "
            f"vértice {vertex} e foco {focus} não têm nem a mesma abscissa nem a mesma ordenada."
        )
    return Parabola(vertex=vertex, focus=focus)


def parabola_axis(parabola: Parabola) -> str:
    return VERTICAL if parabola.vertex.x == parabola.focus.x else HORIZONTAL


def parabola_directrix(parabola: Parabola) -> tuple[str, Expr]:
    """Retorna (variável, valor): ("y", k-p) para eixo vertical, ("x", h-p)
    para eixo horizontal, onde p é a distância com sinal vértice->foco ao
    longo do eixo (diretriz é o espelho do foco em relação ao vértice)."""
    v, f = parabola.vertex, parabola.focus
    if parabola_axis(parabola) == VERTICAL:
        p = simplify(f.y - v.y)
        return "y", simplify(v.y - p)
    p = simplify(f.x - v.x)
    return "x", simplify(v.x - p)
