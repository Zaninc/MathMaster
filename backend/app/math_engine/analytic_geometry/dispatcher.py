"""Sprint 10 — Geometria Analítica I (retas).

Segue o mesmo padrão de roteamento das outras áreas: um regex sobre o
texto bruto decide se a expressão pertence a este domínio
(is_analytic_geometry_domain_expression), e o nome da função capturado
pelo mesmo regex decide qual operação executar dentro do domínio.

Retas são SEMPRE definidas por dois pontos (reta(...)) ou por um ponto +
coeficiente angular (reta_m(...)) — nunca por uma equação livre digitada
pelo usuário (isso é Parser Inteligente, fora de escopo desta sprint).
Coordenadas só aceitam literais numéricos/simbólicos exatos (inteiros,
racionais, raízes, constantes como pi); variáveis livres em coordenadas,
ex. (a,b), são rejeitadas explicitamente por points.py.
"""
from __future__ import annotations

import re

from ..errors import ExpressionError
from .classification import classify_line, classify_relation
from .distance import distance_between_points
from .lines import line_from_point_slope, line_from_points, slope
from .midpoint import midpoint
from .points import parse_point_and_scalar, parse_point_pair, parse_two_lines
from .render import render_line_block, render_relation_block

_CALL_PATTERN = re.compile(
    r"^\s*(distancia|ponto_medio|coeficiente_angular|reta_m|reta|relacao_retas)"
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

    # relacao_retas
    (p1, p2), (p3, p4) = parse_two_lines(argumentos)
    line1 = line_from_points(p1, p2)
    line2 = line_from_points(p3, p4)
    return render_relation_block(classify_relation(line1, line2))
