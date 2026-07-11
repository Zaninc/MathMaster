"""Parsing de literais de ponto "(x, y)" e das estruturas compostas usadas
pela sintaxe pública de analytic_geometry/ — sempre por regex/varredura de
parênteses sobre o texto bruto seguido de sympify por fragmento isolado
(nunca a string inteira de um argumento composto de uma vez), o mesmo
padrão de "classifica a forma antes de parsear" usado em
app/formatter/classify.py.

Coordenadas aceitam inteiros, racionais, raízes e constantes exatas (pi,
etc.) via sympy — variáveis livres (ex. "(a, b)") são rejeitadas
explicitamente, fora do escopo desta sprint.
"""
from __future__ import annotations

from dataclasses import dataclass

from sympy.core.expr import Expr
from sympy.parsing.sympy_parser import (
    implicit_multiplication_application,
    standard_transformations,
)

from ..errors import ExpressionError
from ..safe_parsing import safe_parse_expr

_TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application,)


@dataclass(frozen=True)
class Point:
    x: Expr
    y: Expr

    def __str__(self) -> str:
        return f"({self.x}, {self.y})"


def split_top_level(text: str, sep: str = ",") -> list[str]:
    """Divide `text` em `sep` apenas fora de parênteses/colchetes — usado
    para separar os dois pontos de "(1,2),(4,6)" sem confundir com as
    vírgulas internas de cada ponto."""
    parts = []
    depth = 0
    current: list[str] = []
    for char in text:
        if char in "([":
            depth += 1
        elif char in ")]":
            depth -= 1
        if char == sep and depth == 0:
            parts.append("".join(current))
            current = []
        else:
            current.append(char)
    parts.append("".join(current))
    return [part.strip() for part in parts]


def _parse_coordinate(text: str) -> Expr:
    try:
        value = safe_parse_expr(text, transformations=_TRANSFORMATIONS)
    except Exception as exc:
        raise ExpressionError(f"Não foi possível interpretar a coordenada: {text}") from exc

    if value.free_symbols:
        raise ExpressionError(
            f"Coordenadas com variáveis livres não são suportadas nesta versão: {text}"
        )
    return value


def parse_point(text: str) -> Point:
    text = text.strip()
    if not (text.startswith("(") and text.endswith(")")):
        raise ExpressionError(f"Ponto inválido: {text} (formato esperado: (x, y))")

    coords = split_top_level(text[1:-1])
    if len(coords) != 2 or not all(coords):
        raise ExpressionError(f"Ponto inválido: {text} (formato esperado: (x, y))")

    return Point(x=_parse_coordinate(coords[0]), y=_parse_coordinate(coords[1]))


def parse_point_pair(text: str) -> tuple[Point, Point]:
    parts = split_top_level(text)
    if len(parts) != 2:
        raise ExpressionError(f"Eram esperados dois pontos separados por vírgula: {text}")
    return parse_point(parts[0]), parse_point(parts[1])


def parse_point_and_scalar(text: str) -> tuple[Point, Expr]:
    parts = split_top_level(text)
    if len(parts) != 2:
        raise ExpressionError(f"Formato esperado: reta_m((x,y), m): {text}")
    return parse_point(parts[0]), _parse_coordinate(parts[1])


def parse_point_and_point_or_scalar(text: str) -> tuple[Point, Point | Expr]:
    """Segundo argumento de circunferencia(...): um ponto pertencente à
    curva ("(3,4)") ou o raio direto ("5") — a forma decide pelo prefixo
    "(", nunca por contagem de vírgulas (que já é ambígua dentro de um
    ponto)."""
    parts = split_top_level(text)
    if len(parts) != 2:
        raise ExpressionError(
            f"Formato esperado: circunferencia((x,y), r) ou circunferencia((x,y),(x,y)): {text}"
        )
    center = parse_point(parts[0])
    second = parts[1].strip()
    if second.startswith("(") and second.endswith(")"):
        return center, parse_point(second)
    return center, _parse_coordinate(second)


def parse_point_and_two_scalars(text: str) -> tuple[Point, Expr, Expr]:
    parts = split_top_level(text)
    if len(parts) != 3:
        raise ExpressionError(
            f"Formato esperado: (centro), semieixo1, semieixo2: {text}"
        )
    point = parse_point(parts[0])
    return point, _parse_coordinate(parts[1]), _parse_coordinate(parts[2])


def parse_point_pair_list(text: str) -> tuple[Point, Point]:
    text = text.strip()
    if not (text.startswith("[") and text.endswith("]")):
        raise ExpressionError(
            f"Reta inválida: {text} (formato esperado: [(x1,y1),(x2,y2)])"
        )
    return parse_point_pair(text[1:-1])


def parse_two_lines(text: str) -> tuple[tuple[Point, Point], tuple[Point, Point]]:
    parts = split_top_level(text)
    if len(parts) != 2:
        raise ExpressionError(
            f"Eram esperadas duas retas: {text} (formato esperado: "
            "relacao_retas([(x1,y1),(x2,y2)],[(x3,y3),(x4,y4)]))"
        )
    return parse_point_pair_list(parts[0]), parse_point_pair_list(parts[1])
