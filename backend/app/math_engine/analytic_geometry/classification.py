"""Classificação de retas (Sprint 10): posição de uma reta (horizontal/
vertical/oblíqua) e relação entre duas retas (paralelas/perpendiculares/
coincidentes/concorrentes). Mesmo padrão de constantes + label_for() de
functions/classification.py e logarithms/classification.py.

Os rótulos aqui são sempre texto semântico em português — os símbolos
Unicode ∥/⊥ NÃO são usados nesta camada (decisão registrada no plano da
Sprint 10): eles só são aplicados depois, na camada de apresentação
(app/formatter/unicode_math.py), sobre o texto já pronto.
"""
from __future__ import annotations

from sympy import simplify

from .lines import LineEquation

HORIZONTAL = "horizontal"
VERTICAL = "vertical"
CRESCENTE = "crescente"
DECRESCENTE = "decrescente"

PARALELAS = "paralelas"
PERPENDICULARES = "perpendiculares"
COINCIDENTES = "coincidentes"
CONCORRENTES = "concorrentes"

# Sprint 11 (Geometria Analítica II) — kinds das quatro cônicas, mesmo
# padrão (constante + label_for()) usado acima para retas. HORIZONTAL/
# VERTICAL já existentes são reaproveitados por parabola.py para
# descrever o eixo (mesmo valor de string, significado análogo: orientação
# em relação aos eixos coordenados), sem redefinição.
CIRCUNFERENCIA = "circunferencia"
PARABOLA = "parabola"
ELIPSE = "elipse"
HIPERBOLE = "hiperbole"

_LABELS = {
    HORIZONTAL: "reta horizontal",
    VERTICAL: "reta vertical",
    CRESCENTE: "reta oblíqua crescente",
    DECRESCENTE: "reta oblíqua decrescente",
    PARALELAS: "Paralelas",
    PERPENDICULARES: "Perpendiculares",
    COINCIDENTES: "Coincidentes",
    CONCORRENTES: "Concorrentes (não perpendiculares)",
    CIRCUNFERENCIA: "circunferência",
    PARABOLA: "parábola",
    ELIPSE: "elipse",
    HIPERBOLE: "hipérbole",
}


def label_for(kind: str) -> str:
    return _LABELS[kind]


def classify_line(line: LineEquation) -> str:
    if line.is_vertical:
        return VERTICAL
    if line.is_horizontal:
        return HORIZONTAL
    m = simplify(-line.a / line.b)
    return CRESCENTE if m > 0 else DECRESCENTE


def _coincident_given_parallel(line1: LineEquation, line2: LineEquation) -> bool:
    # (a1,b1) e (a2,b2) já são proporcionais neste ponto (quem chama já
    # checou); k é a razão de proporcionalidade, usada para testar se c
    # também é proporcional — cross-multiplication, nunca divide por um
    # coeficiente que possa ser zero (line1.a e line1.b não são ambos
    # zero, por construção de LineEquation).
    if line1.a != 0:
        k = line2.a / line1.a
    else:
        k = line2.b / line1.b
    return simplify(line2.c - k * line1.c) == 0


def classify_relation(line1: LineEquation, line2: LineEquation) -> str:
    if simplify(line1.a * line2.b - line2.a * line1.b) == 0:
        return COINCIDENTES if _coincident_given_parallel(line1, line2) else PARALELAS
    if simplify(line1.a * line2.a + line1.b * line2.b) == 0:
        return PERPENDICULARES
    return CONCORRENTES
