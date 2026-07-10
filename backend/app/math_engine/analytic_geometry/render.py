"""Monta as strings finais compostas de analytic_geometry/ — o mesmo
idioma "Campo: valor; Campo: valor" usado por functions/ e logarithms/.

Este módulo NÃO é o pacote app/formatter/ (que reformata output genérico
por shape, classificando a forma antes de parsear) — é local a
analytic_geometry/, nunca importado de fora do math_engine, e nunca
decide a forma de saída de outra área. Renomeado de "formatter.py" para
"render.py" deliberadamente, para evitar colisão de responsabilidade com
o pacote irmão app/formatter/.

Símbolos Unicode (∥, ⊥) NÃO são inseridos aqui: este renderer produz só
os rótulos semânticos em português de classification.py; a substituição
para ∥/⊥ acontece somente na camada de apresentação
(app/formatter/unicode_math.py), igual a pi->π, sqrt->√ etc.

Estendido na Sprint 11 (Geometria Analítica II) com um bloco por cônica
(circunferência/parábola/elipse/hipérbole), mesmo formato "Tipo: ...; ..."
dos blocos de reta acima — nenhuma mudança nos blocos existentes.
"""
from __future__ import annotations

from sympy import Symbol, simplify

from .circle import Circle, circle_equation
from .classification import label_for
from .ellipse import Ellipse, ellipse_eccentricity, ellipse_focuses
from .hyperbola import Hyperbola, hyperbola_asymptotes, hyperbola_eccentricity, hyperbola_focuses
from .lines import LineEquation, x_intercept, y_intercept
from .parabola import Parabola, parabola_axis, parabola_directrix

_X = Symbol("x")
_Y = Symbol("y")


def _format_optional(value) -> str:
    return "não existe" if value is None else str(value)


def render_line_block(line: LineEquation, kind: str) -> str:
    equacao_geral = line.a * _X + line.b * _Y + line.c

    campos = [
        f"Tipo: {label_for(kind)}",
        f"Equação geral: {equacao_geral} = 0",
    ]

    if line.is_vertical:
        campos.append("Equação reduzida: não existe (reta vertical)")
        campos.append("Coeficiente angular: indefinido (reta vertical)")
    else:
        m = simplify(-line.a / line.b)
        b_coef = y_intercept(line)
        campos.append(f"Equação reduzida: y = {m * _X + b_coef}")
        campos.append(f"Coeficiente angular: {m}")

    campos.append(f"Intercepto em x: {_format_optional(x_intercept(line))}")
    campos.append(f"Intercepto em y: {_format_optional(y_intercept(line))}")

    return "; ".join(campos)


def render_relation_block(kind: str) -> str:
    return f"Relação entre as retas: {label_for(kind)}"


def render_circle_block(circle: Circle, kind: str) -> str:
    lhs, rhs = circle_equation(circle)
    campos = [
        f"Tipo: {label_for(kind)}",
        f"Centro: {circle.center}",
        f"Raio: {circle.radius}",
        f"Equação: {lhs} = {rhs}",
    ]
    return "; ".join(campos)


def render_parabola_block(parabola: Parabola, kind: str) -> str:
    var, value = parabola_directrix(parabola)
    campos = [
        f"Tipo: {label_for(kind)}",
        f"Vértice: {parabola.vertex}",
        f"Foco: {parabola.focus}",
        f"Diretriz: {var} = {value}",
        f"Eixo: {parabola_axis(parabola)}",
    ]
    return "; ".join(campos)


def render_ellipse_block(ellipse: Ellipse, kind: str) -> str:
    f1, f2 = ellipse_focuses(ellipse)
    campos = [
        f"Tipo: {label_for(kind)}",
        f"Centro: {ellipse.center}",
        f"Semieixo maior: {ellipse.a}",
        f"Semieixo menor: {ellipse.b}",
        f"Focos: {f1} e {f2}",
        f"Excentricidade: {ellipse_eccentricity(ellipse)}",
    ]
    return "; ".join(campos)


def render_hyperbola_block(hyperbola: Hyperbola, kind: str) -> str:
    f1, f2 = hyperbola_focuses(hyperbola)
    asym1, asym2 = hyperbola_asymptotes(hyperbola)
    campos = [
        f"Tipo: {label_for(kind)}",
        f"Centro: {hyperbola.center}",
        f"Semieixos: a = {hyperbola.a}, b = {hyperbola.b}",
        f"Focos: {f1} e {f2}",
        f"Assíntotas: y = {asym1} e y = {asym2}",
        f"Excentricidade: {hyperbola_eccentricity(hyperbola)}",
    ]
    return "; ".join(campos)
