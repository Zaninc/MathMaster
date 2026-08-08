"""Sprint V2.14 (Passo a Passo — Substituição / u-substitution) — cobertura
de `math_engine.steps.u_substitution`: os 6 casos obrigatórios do ticket,
o roteamento automático do dispatcher (substituição ANTES da regra da
potência, sem esconder o ensino atrás da expansão polinomial), a ausência
de regressão nas integrais básicas/definidas das V2.10.1/V2.10.2, e a
rejeição amigável (nunca erro interno) para formas fora do escopo desta
versão (integração por partes, frações parciais, substituições
trigonométricas/hiperbólicas)."""
from __future__ import annotations

import pytest

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps


def _final_expression(text: str) -> str:
    return generate_steps(text)[-1].expression


def _titles(text: str) -> list[str]:
    return [s.title for s in generate_steps(text)]


# --- Caso 1: potência composta -------------------------------------------------


def test_case_1_power_composite() -> None:
    steps = generate_steps("integral(2*x*(x**2+1)**3, x)")
    assert [s.title for s in steps] == [
        "Integral original",
        "Identificando uma substituição",
        "Derivando u",
        "Substituindo",
        "Integrando",
        "Voltando para x",
        "Adicionando a constante de integração",
    ]
    assert steps[1].expression == "u=x**2 + 1"
    assert steps[2].expression == "du=2*x*dx"
    assert steps[3].expression == "integral(u**3, u)"
    assert steps[4].expression == "u**4/4"
    assert steps[-1].expression == "x**8/4 + x**6 + 3*x**4/2 + x**2 + C"


# --- Caso 2: cosseno composto ---------------------------------------------------


def test_case_2_cosine_composite() -> None:
    steps = generate_steps("integral(cos(x**2)*2*x, x)")
    assert steps[1].expression == "u=x**2"
    assert steps[2].expression == "du=2*x*dx"
    assert steps[3].expression == "integral(cos(u), u)"
    assert steps[4].expression == "sin(u)"
    assert steps[-1].expression == "sin(x**2) + C"


# --- Caso 3: exponencial composta -----------------------------------------------


def test_case_3_exponential_composite() -> None:
    steps = generate_steps("integral(exp(3*x)*3, x)")
    assert steps[1].expression == "u=3*x"
    assert steps[2].expression == "du=3*dx"
    assert steps[3].expression == "integral(exp(u), u)"
    assert steps[4].expression == "exp(u)"
    assert steps[-1].expression == "exp(3*x) + C"


# --- Hotfix V2.15.1: paridade de Euler (e^(...) escolhe a mesma técnica) -------
#
# `2*x*e^(x**2)` digitado à mão virava `Pow(Symbol('e'), x**2)` — nunca
# reconhecido por `_outer_shape` (que compara `factor.func` contra
# `exp`), então a substituição nunca era escolhida. Corrigido no parsing
# compartilhado (`calculus/dispatcher.py:parse_integral_call`), não com
# reconhecimento especial de `Pow(Symbol("e"), ...)` dentro deste módulo.


@pytest.mark.parametrize(
    "expr", ["integral(2*x*e^(x**2), x)", "integral(2*x*e**(x**2), x)"]
)
def test_bare_e_power_composite_uses_substitution_same_as_exp(expr: str) -> None:
    steps = generate_steps(expr)
    reference = generate_steps("integral(2*x*exp(x**2), x)")
    assert [(s.title, s.expression) for s in steps] == [
        (s.title, s.expression) for s in reference
    ]
    assert steps[-1].expression == "exp(x**2) + C"


# --- Caso 4: racional composto (log natural, sem duplicar log/ln) --------------


def test_case_4_rational_composite_uses_natural_log() -> None:
    steps = generate_steps("integral(1/(2*x+1)*2, x)")
    assert steps[1].expression == "u=2*x + 1"
    assert steps[2].expression == "du=2*dx"
    assert steps[3].expression == "integral(1/u, u)"
    assert steps[4].expression == "ln(u)"
    assert steps[-1].expression == "ln(2*x + 1) + C"
    for step in steps:
        assert "log(" not in step.expression


# --- Caso 5: seno composto ------------------------------------------------------


def test_case_5_sine_composite() -> None:
    steps = generate_steps("integral(sin(5*x)*5, x)")
    assert steps[1].expression == "u=5*x"
    assert steps[2].expression == "du=5*dx"
    assert steps[3].expression == "integral(sin(u), u)"
    assert steps[4].expression == "-cos(u)"
    assert steps[-1].expression == "-cos(5*x) + C"


# --- Caso 6: combinado, coeficiente fatorado corretamente ----------------------


def test_case_6_combined_coefficient_factored() -> None:
    steps = generate_steps("integral(6*x*(x**2+1)**5, x)")
    assert steps[1].expression == "u=x**2 + 1"
    assert steps[2].expression == "du=2*x*dx"
    assert steps[3].expression == "3*integral(u**5, u)"
    assert steps[4].expression == "u**6/2"
    assert steps[-1].expression == "x**12/2 + 3*x**10 + 15*x**8/2 + 10*x**6 + 15*x**4/2 + 3*x**2 + C"


# --- O valor final sempre bate com o motor real de /solve -----------------------


@pytest.mark.parametrize(
    "expr",
    [
        "integral(2*x*(x**2+1)**3, x)",
        "integral(cos(x**2)*2*x, x)",
        "integral(exp(3*x)*3, x)",
        "integral(1/(2*x+1)*2, x)",
        "integral(sin(5*x)*5, x)",
        "integral(6*x*(x**2+1)**5, x)",
    ],
)
def test_final_step_matches_solve_result(expr: str) -> None:
    from app.math_engine.dispatcher import solve_expression

    final = _final_expression(expr)
    solved = solve_expression(expr)
    assert solved == f"Integral: {final}"


# --- Regressão: integrais básicas continuam usando o módulo antigo -------------


def test_bare_power_still_uses_old_module() -> None:
    assert _titles("integral(x**2, x)") == [
        "Integral original",
        "Integrando x² pela regra da potência",
        "Adicionando a constante de integração",
    ]


def test_polynomial_sum_still_uses_old_module() -> None:
    titles = _titles("integral(x**2+3*x, x)")
    assert "Identificando uma substituição" not in titles
    assert "Aplicando a linearidade da integral" in titles


# --- Regressão: integrais definidas continuam funcionando (fora de escopo) -----


def test_definite_integral_still_works_and_never_uses_substitution_module() -> None:
    steps = generate_steps("integral(x**2, x, 0, 2)")
    assert "Identificando uma substituição" not in [s.title for s in steps]
    assert steps[-1].expression == "8/3"


# --- Fora de escopo: rejeição amigável, nunca erro interno ---------------------


def test_integration_by_parts_shape_never_claimed_by_substitution() -> None:
    # x*sin(x) passou a ser suportado pela integração por partes (Sprint
    # V2.15) — aqui só confirmamos que a SUBSTITUIÇÃO (V2.14) nunca
    # reivindica essa forma (nenhum fator é uma composição f(g(x))·g'(x)).
    titles = [s.title for s in generate_steps("integral(x*sin(x), x)")]
    assert "Identificando uma substituição" not in titles


def test_trig_times_trig_still_rejected_with_friendly_message() -> None:
    # sin(x)*cos(x) continua fora do escopo de ambos os módulos (substituição
    # e integração por partes) nesta versão.
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("integral(sin(x)*cos(x), x)")


def test_bare_transcendental_still_rejected_with_friendly_message() -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("integral(sin(x), x)")


def test_one_over_x_still_rejected_with_friendly_message() -> None:
    # x**-1 tem base == a própria variável -> não é uma composição g(x).
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("integral(1/x, x)")
