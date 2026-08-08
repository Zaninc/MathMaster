"""Sprint V2.16 (Passo a Passo — Frações Parciais) — cobertura de
`math_engine.steps.partial_fractions`: os 5 casos obrigatórios do ticket
(fatores lineares distintos, numerador não constante, outros fatores
lineares, fator x, fatores lineares repetidos), o roteamento automático
do dispatcher (frações parciais DEPOIS de substituição/partes e ANTES do
fallback amigável, sem roubar integrais mais simples), a mensagem
amigável DEDICADA para frações impróprias, a rejeição amigável genérica
para fatores irredutíveis de grau >= 2, a verificação simbólica
obrigatória de cada decomposição, e a ausência de regressão nas integrais
básicas/definidas/substituição/partes das V2.10.1–V2.15."""
from __future__ import annotations

import pytest
from sympy import Symbol, simplify, sympify

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps


def _final_expression(text: str) -> str:
    return generate_steps(text)[-1].expression


def _titles(text: str) -> list[str]:
    return [s.title for s in generate_steps(text)]


_EXPECTED_TITLES = [
    "Integral original",
    "Identificando uma função racional",
    "Fatorando o denominador",
    "Montando as frações parciais",
    "Eliminando os denominadores",
    "Determinando os coeficientes",
    "Substituindo",
    "Separando a integral",
    "Integrando",
    "Adicionando a constante de integração",
]

_x = Symbol("x")


def _assert_decomposition_equivalent(original_text: str, decomposition_text: str) -> None:
    """Requisito obrigatório do ticket: `simplify(original - decomposto)
    == 0` — nunca confiar apenas na leitura visual dos passos."""
    lhs_text, rhs_text = decomposition_text.split("=", 1)
    original = sympify(original_text)
    lhs = sympify(lhs_text)
    rhs = sympify(rhs_text)
    assert simplify(original - lhs) == 0
    assert simplify(lhs - rhs) == 0


# --- Caso 1: fatores lineares distintos -------------------------------------------


def test_case_1_distinct_linear_factors() -> None:
    steps = generate_steps("integral(1/((x+1)*(x+2)), x)")
    assert [s.title for s in steps] == _EXPECTED_TITLES
    assert steps[1].expression == "1/((x + 1)*(x + 2))"
    assert steps[2].expression == "(x + 1)*(x + 2)"
    assert steps[3].expression == "1/((x + 1)*(x + 2))=A/(x + 1) + B/(x + 2)"
    assert steps[4].expression == "1=A*(x + 2)+B*(x + 1)"
    assert steps[5].expression == "A=1, B=-1"
    assert steps[6].expression == "1/((x + 1)*(x + 2))=1/(x + 1)-1/(x + 2)"
    assert steps[7].expression == "integral(1/(x + 1), x)-integral(1/(x + 2), x)"
    assert steps[8].expression == "ln(x + 1)-ln(x + 2)"
    assert steps[-1].expression == "ln(x + 1) - ln(x + 2) + C"
    _assert_decomposition_equivalent("1/((x+1)*(x+2))", steps[6].expression)


# --- Caso 2: numerador não constante ------------------------------------------------


def test_case_2_non_constant_numerator() -> None:
    steps = generate_steps("integral((2*x+3)/((x+1)*(x+2)), x)")
    assert [s.title for s in steps] == _EXPECTED_TITLES
    assert steps[4].expression == "2*x + 3=A*(x + 2)+B*(x + 1)"
    assert steps[5].expression == "A=1, B=1"
    assert steps[6].expression == "(2*x + 3)/((x + 1)*(x + 2))=1/(x + 1)+1/(x + 2)"
    _assert_decomposition_equivalent("(2*x+3)/((x+1)*(x+2))", steps[6].expression)


# --- Caso 3: outros fatores lineares (genérico, não hardcoded) --------------------


def test_case_3_generic_other_linear_factors() -> None:
    steps = generate_steps("integral((3*x+5)/((x-1)*(x+2)), x)")
    assert [s.title for s in steps] == _EXPECTED_TITLES
    assert steps[3].expression == "(3*x + 5)/((x - 1)*(x + 2))=A/(x - 1) + B/(x + 2)"
    assert steps[5].expression == "A=8/3, B=1/3"
    assert steps[6].expression == "(3*x + 5)/((x - 1)*(x + 2))=(8/3)/(x - 1)+(1/3)/(x + 2)"
    _assert_decomposition_equivalent("(3*x+5)/((x-1)*(x+2))", steps[6].expression)
    assert steps[-1].expression == "8*ln(x - 1)/3 + ln(x + 2)/3 + C"


# --- Caso 4: fator x ---------------------------------------------------------------


def test_case_4_factor_x() -> None:
    steps = generate_steps("integral(1/(x*(x+1)), x)")
    assert [s.title for s in steps] == _EXPECTED_TITLES
    assert steps[3].expression == "1/(x*(x + 1))=A/x + B/(x + 1)"
    assert steps[5].expression == "A=1, B=-1"
    assert steps[6].expression == "1/(x*(x + 1))=1/x-1/(x + 1)"
    _assert_decomposition_equivalent("1/(x*(x+1))", steps[6].expression)
    assert steps[-1].expression == "ln(x) - ln(x + 1) + C"


# --- Fatores lineares repetidos: TODOS os graus, nunca só o maior -----------------


def test_repeated_linear_factor_includes_every_degree() -> None:
    steps = generate_steps("integral(1/(x*(x+1)**2), x)")
    assert [s.title for s in steps] == _EXPECTED_TITLES
    assert steps[3].expression == "1/(x*(x + 1)**2)=A/x + B/(x + 1) + C/(x + 1)**2"
    assert steps[5].expression == "A=1, B=-1, C=-1"
    assert steps[6].expression == "1/(x*(x + 1)**2)=1/x-1/(x + 1)-1/(x + 1)**2"
    _assert_decomposition_equivalent("1/(x*(x+1)**2)", steps[6].expression)
    assert steps[7].expression == (
        "integral(1/x, x)-integral(1/(x + 1), x)-integral(1/(x + 1)**2, x)"
    )
    assert steps[-1].expression == "ln(x) - ln(x + 1) + 1/(x + 1) + C"


# --- O valor final sempre bate com o motor real de /solve -------------------------


@pytest.mark.parametrize(
    "expr",
    [
        "integral(1/((x+1)*(x+2)), x)",
        "integral((2*x+3)/((x+1)*(x+2)), x)",
        "integral((3*x+5)/((x-1)*(x+2)), x)",
        "integral(1/(x*(x+1)), x)",
        "integral(1/(x*(x+1)**2), x)",
    ],
)
def test_final_step_matches_solve_result(expr: str) -> None:
    from app.math_engine.dispatcher import solve_expression

    final = _final_expression(expr)
    solved = solve_expression(expr)
    assert solved == f"Integral: {final}"


# --- Regressão: integrais básicas/definidas/substituição/partes intocadas --------


def test_bare_power_still_uses_basic_module() -> None:
    titles = _titles("integral(x**2, x)")
    assert "Identificando uma função racional" not in titles


def test_bare_exp_still_rejected_unchanged() -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("integral(exp(x), x)")


def test_substitution_case_never_stolen_by_partial_fractions() -> None:
    titles = _titles("integral(2*x*(x**2+1)**3, x)")
    assert "Identificando uma substituição" in titles
    assert "Identificando uma função racional" not in titles


def test_integration_by_parts_case_never_stolen_by_partial_fractions() -> None:
    titles = _titles("integral(x*exp(x), x)")
    assert "Identificando integração por partes" in titles
    assert "Identificando uma função racional" not in titles


def test_definite_integral_still_works_and_never_uses_partial_fractions_module() -> None:
    steps = generate_steps("integral(x**2, x, 0, 2)")
    assert "Identificando uma função racional" not in [s.title for s in steps]
    assert steps[-1].expression == "8/3"


# --- Frações impróprias: mensagem amigável dedicada, nunca finge dividir ---------


def test_improper_rational_function_returns_dedicated_friendly_message() -> None:
    with pytest.raises(
        ExpressionError, match="divisão polinomial antes da decomposição em frações parciais"
    ):
        generate_steps("integral((x**2+1)/(x+1), x)")


def test_solve_endpoint_unaffected_by_improper_rational_rejection() -> None:
    from app.math_engine.dispatcher import solve_expression

    assert solve_expression("integral((x**2+1)/(x+1), x)") == "Integral: x**2/2 - x + 2*ln(x + 1) + C"


# --- Quadráticas irredutíveis: fora de escopo, rejeição amigável genérica --------


def test_irreducible_quadratic_factor_rejected_with_friendly_message() -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("integral(1/((x**2+1)*(x+1)), x)")


def test_bare_irreducible_quadratic_never_claimed_as_partial_fractions() -> None:
    # 1/(x²+1) tem um ÚNICO fator (irredutível, grau 2) — nunca deve ser
    # tratado como se fosse uma forma de frações parciais lineares; cai na
    # mesma rejeição amigável genérica de sempre, nunca um erro interno.
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("integral(1/(x**2+1), x)")


def test_solve_endpoint_unaffected_by_irreducible_quadratic_rejection() -> None:
    from app.math_engine.dispatcher import solve_expression

    assert solve_expression("integral(1/(x**2+1), x)") == "Integral: atan(x) + C"


# --- Testes de erro: entradas inválidas nunca retornam erro interno --------------


def test_empty_expression_returns_friendly_error() -> None:
    with pytest.raises(ExpressionError):
        generate_steps("")


def test_invalid_integral_call_returns_friendly_error() -> None:
    with pytest.raises(ExpressionError):
        generate_steps("integral(, x)")
