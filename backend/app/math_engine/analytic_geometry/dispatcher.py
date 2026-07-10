"""Sprint 10 — Geometria Analítica I (retas). Estendido na Sprint 11 —
Geometria Analítica II (cônicas: circunferência, parábola, elipse,
hipérbole), mesmo módulo, sem novo domínio.

Segue o mesmo padrão de roteamento das outras áreas: um regex sobre o
texto bruto decide se a expressão pertence a este domínio
(is_analytic_geometry_domain_expression), e o nome da função capturado
pelo mesmo regex decide qual operação executar dentro do domínio.

Retas são SEMPRE definidas por dois pontos (reta(...)) ou por um ponto +
coeficiente angular (reta_m(...)); cônicas são SEMPRE definidas por
centro/vértice + parâmetros literais (raio, foco, semieixos) — nunca por
uma equação livre digitada pelo usuário (isso é Parser Inteligente, fora
de escopo). Coordenadas só aceitam literais numéricos/simbólicos exatos
(inteiros, racionais, raízes, constantes como pi); variáveis livres em
coordenadas, ex. (a,b), são rejeitadas explicitamente por points.py.
"""
from __future__ import annotations

import re

from ..errors import ExpressionError
from .circle import circle_from_center_point, circle_from_center_radius
from .classification import (
    CIRCUNFERENCIA,
    ELIPSE,
    HIPERBOLE,
    PARABOLA,
    classify_line,
    classify_relation,
)
from .distance import distance_between_points
from .ellipse import ellipse_from_axes
from .hyperbola import hyperbola_from_axes
from .lines import line_from_point_slope, line_from_points, slope
from .midpoint import midpoint
from .parabola import parabola_from_vertex_focus
from .points import (
    Point,
    parse_point_and_point_or_scalar,
    parse_point_and_scalar,
    parse_point_and_two_scalars,
    parse_point_pair,
    parse_two_lines,
)
from .render import (
    render_circle_block,
    render_ellipse_block,
    render_hyperbola_block,
    render_line_block,
    render_parabola_block,
    render_relation_block,
)

_CALL_PATTERN = re.compile(
    r"^\s*(distancia|ponto_medio|coeficiente_angular|reta_m|reta|relacao_retas|"
    r"circunferencia|parabola|elipse|hiperbole)"
    r"\s*\((.*)\)\s*$",
    re.DOTALL,
)


def is_analytic_geometry_domain_expression(expression: str) -> bool:
    return bool(_CALL_PATTERN.match(expression.strip()))


def solve_analytic_geometry_text(expression: str) -> str:
    match = _CALL_PATTERN.match(expression.strip())
    if not match:
        raise ExpressionError(
            f"Não foi possível interpretar a expressão de geometria analítica: {expression}"
        )

    nome, argumentos = match.groups()

    if nome == "distancia":
        p1, p2 = parse_point_pair(argumentos)
        return f"Distância: {distance_between_points(p1, p2)}"

    if nome == "ponto_medio":
        p1, p2 = parse_point_pair(argumentos)
        return f"Ponto médio: {midpoint(p1, p2)}"

    if nome == "coeficiente_angular":
        p1, p2 = parse_point_pair(argumentos)
        m = slope(p1, p2)
        if m is None:
            raise ExpressionError(
                f"A reta que passa por {p1} e {p2} é vertical — "
                "o coeficiente angular não é definido."
            )
        return f"Coeficiente angular: {m}"

    if nome == "reta":
        p1, p2 = parse_point_pair(argumentos)
        line = line_from_points(p1, p2)
        return render_line_block(line, classify_line(line))

    if nome == "reta_m":
        point, m = parse_point_and_scalar(argumentos)
        line = line_from_point_slope(point, m)
        return render_line_block(line, classify_line(line))

    if nome == "relacao_retas":
        (p1, p2), (p3, p4) = parse_two_lines(argumentos)
        line1 = line_from_points(p1, p2)
        line2 = line_from_points(p3, p4)
        return render_relation_block(classify_relation(line1, line2))

    if nome == "circunferencia":
        center, second = parse_point_and_point_or_scalar(argumentos)
        if isinstance(second, Point):
            circle = circle_from_center_point(center, second)
        else:
            circle = circle_from_center_radius(center, second)
        return render_circle_block(circle, CIRCUNFERENCIA)

    if nome == "parabola":
        vertex, focus = parse_point_pair(argumentos)
        parabola = parabola_from_vertex_focus(vertex, focus)
        return render_parabola_block(parabola, PARABOLA)

    if nome == "elipse":
        center, a, b = parse_point_and_two_scalars(argumentos)
        ellipse = ellipse_from_axes(center, a, b)
        return render_ellipse_block(ellipse, ELIPSE)

    # hiperbole
    center, a, b = parse_point_and_two_scalars(argumentos)
    hyperbola = hyperbola_from_axes(center, a, b)
    return render_hyperbola_block(hyperbola, HIPERBOLE)
