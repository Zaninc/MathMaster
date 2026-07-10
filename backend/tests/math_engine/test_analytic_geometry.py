"""Hardening II, Etapa 6 — cobre `analytic_geometry/` fora dos casos já
testados na suíte de compatibilidade: `reta_m`, as 3 relações entre retas
que faltavam (paralelas, coincidentes, concorrentes não perpendiculares),
reta vertical, parábola de eixo horizontal, e elipse/hipérbole com centro
deslocado da origem (só validadas manualmente e descartadas nas Sprints
10/11, nunca persistidas)."""
from __future__ import annotations

from app.formatter.pipeline import format_result
from app.formatter.renderer import render_math
from app.math_engine.dispatcher import solve_expression


def _solve(expression: str) -> str:
    raw = solve_expression(expression)
    return render_math(format_result(expression, raw))


def test_reta_m() -> None:
    assert _solve("reta_m((0,0),3)") == (
        "Tipo: reta oblíqua crescente; Equação geral: 3*x - y = 0; "
        "Equação reduzida: y = 3*x; Coeficiente angular: 3; "
        "Intercepto em x: 0; Intercepto em y: 0"
    )


def test_relacao_retas_paralelas() -> None:
    assert _solve("relacao_retas([(0,0),(2,0)],[(0,1),(2,1)])") == (
        "Relação entre as retas: Paralelas ∥"
    )


def test_relacao_retas_coincidentes() -> None:
    assert _solve("relacao_retas([(0,0),(2,0)],[(1,0),(3,0)])") == (
        "Relação entre as retas: Coincidentes"
    )


def test_relacao_retas_concorrentes_nao_perpendiculares() -> None:
    assert _solve("relacao_retas([(0,0),(1,0)],[(0,0),(1,1)])") == (
        "Relação entre as retas: Concorrentes (não perpendiculares)"
    )


def test_reta_vertical() -> None:
    assert _solve("reta((2,0),(2,5))") == (
        "Tipo: reta vertical; Equação geral: x - 2 = 0; "
        "Equação reduzida: não existe (reta vertical); "
        "Coeficiente angular: indefinido (reta vertical); "
        "Intercepto em x: 2; Intercepto em y: não existe"
    )


def test_parabola_horizontal_axis() -> None:
    assert _solve("parabola((0,0),(2,0))") == (
        "Tipo: parábola; Vértice: (0, 0); Foco: (2, 0); "
        "Diretriz: x = -2; Eixo: horizontal"
    )


def test_ellipse_with_offset_center() -> None:
    assert _solve("elipse((1,2),10,6)") == (
        "Tipo: elipse; Centro: (1, 2); Semieixo maior: 10; Semieixo menor: 6; "
        "Focos: (-7, 2) e (9, 2); Excentricidade: 4/5"
    )


def test_hyperbola_with_offset_center() -> None:
    assert _solve("hiperbole((1,-1),5,2)") == (
        "Tipo: hipérbole; Centro: (1, -1); Semieixos: a = 5, b = 2; "
        "Focos: (1 - √29, -1) e (1 + √29, -1); "
        "Assíntotas: y = 2*x/5 - 7/5 e y = -2*x/5 - 3/5; Excentricidade: √29/5"
    )
