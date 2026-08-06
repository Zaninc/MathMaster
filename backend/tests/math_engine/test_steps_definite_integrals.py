"""Sprint V2.10.2 (Passo a Passo — Integrais Definidas) — cobertura de
`math_engine.steps.definite_integrals`: o Teorema Fundamental do Cálculo
(F(b) - F(a)), nunca "+ C", limites iguais/invertidos, e rejeição amigável
para integrais fora do escopo (nunca um erro interno)."""
from __future__ import annotations

import re

import pytest

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps


def _final_expression(text: str) -> str:
    return generate_steps(text)[-1].expression


# --- Potência simples ---------------------------------------------------------


def test_power_rule_matches_ticket_example() -> None:
    steps = generate_steps("integral(x**2, x, 0, 2)")
    titles = [s.title for s in steps]
    assert titles == [
        "Integral original",
        "Integrando x² pela regra da potência",
        "Aplicando o Teorema Fundamental do Cálculo",
        "Substituindo os limites",
        "Calculando",
    ]
    assert steps[-1].expression == "8/3"


def test_power_rule_second_example() -> None:
    assert _final_expression("integral(x**2, x, 1, 3)") == "26/3"


# --- Coeficiente ---------------------------------------------------------------


def test_coefficient_power() -> None:
    assert _final_expression("integral(4*x**2, x, 0, 2)") == "32/3"


# --- Soma / subtração ------------------------------------------------------------


def test_sum() -> None:
    steps = generate_steps("integral(x**2+3*x, x, 0, 2)")
    titles = [s.title for s in steps]
    assert "Aplicando a linearidade da integral" in titles
    assert "Somando os resultados" in titles
    assert steps[-1].expression == "26/3"


def test_subtraction() -> None:
    assert _final_expression("integral(x**3-5*x, x, 0, 2)") == "-6"


# --- Polinômio completo ---------------------------------------------------------


def test_full_polynomial_matches_solve_result() -> None:
    steps = generate_steps("integral(4*x**4+2*x**2-8*x+5, x, 0, 2)")
    assert steps[-1].expression == "374/15"

    from app.math_engine.dispatcher import solve_expression

    # O passo a passo nunca diverge do motor real de integrais definidas.
    assert solve_expression("integral(4*x**4+2*x**2-8*x+5, x, 0, 2)") == "Integral definida: 374/15"


# --- Nunca +C --------------------------------------------------------------------


@pytest.mark.parametrize(
    "expr",
    [
        "integral(x**2, x, 0, 2)",
        "integral(4*x**2, x, 0, 2)",
        "integral(x**2+3*x, x, 0, 2)",
        "integral(5, x, 2, 6)",
        "integral(4*x**4+2*x**2-8*x+5, x, 0, 2)",
    ],
)
def test_never_adds_plus_c(expr: str) -> None:
    for step in generate_steps(expr):
        assert "+ C" not in step.expression
        assert "C" not in re.findall(r"[A-Za-z]+", step.expression)


# --- Limites iguais ----------------------------------------------------------------


def test_equal_bounds_returns_zero_with_explanation() -> None:
    steps = generate_steps("integral(x**2, x, 3, 3)")
    assert steps[-1].expression == "0"
    assert "comprimento nulo" in steps[-1].title
    assert steps[-1].explanation is not None
    assert "zero" in steps[-1].explanation
    # Nenhum passo de "encontrar primitiva" é gerado — desnecessário.
    assert len(steps) == 2


# --- Limites invertidos (área orientada, nunca valor absoluto) ---------------------


def test_inverted_bounds_preserves_sign_never_absolute_value() -> None:
    steps = generate_steps("integral(x**2, x, 2, 0)")
    assert steps[-1].expression == "-8/3"
    ftc_step = next(s for s in steps if "Teorema Fundamental" in s.title)
    assert ftc_step.expression == "F(0)-F(2)"


# --- Constantes --------------------------------------------------------------------


def test_constant_matches_ticket_example() -> None:
    steps = generate_steps("integral(5, x, 2, 6)")
    assert steps[1].title == "A integral de uma constante é a constante multiplicada pela variável"
    assert steps[1].expression == "5*x"
    assert steps[-1].expression == "20"


# --- Bug real pego durante o desenvolvimento: substituição de limite inferior ------


def test_substitution_step_correctly_negates_multi_term_lower_bound() -> None:
    """`_substitute_bound_text` sem parênteses em volta do limite inferior
    gerava uma string matematicamente ERRADA quando a primitiva tem 2+
    termos e o limite inferior não é zero (o sinal de "-" só se
    distribuía no primeiro termo) — pego empiricamente antes de escrever
    este teste, corrigido envolvendo o limite inferior em parênteses."""
    steps = generate_steps("integral(x**2+3*x, x, 1, 2)")
    substitution_step = next(s for s in steps if s.title == "Substituindo os limites")
    assert substitution_step.expression == "(2)**3/3 + 3*(2)**2/2-((1)**3/3 + 3*(1)**2/2)"
    assert steps[-1].expression == "41/6"


# --- Fora de escopo: erro amigável, nunca interno ---------------------------------


def test_sin_rejected_with_friendly_message() -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("integral(sin(x), x, 0, 1)")


def test_sin_still_works_via_solve_despite_steps_rejection() -> None:
    from app.math_engine.dispatcher import solve_expression

    assert solve_expression("integral(sin(x), x, 0, 1)") == "Integral definida: 1 - cos(1)"


# --- Notação natural ∫ₐᵇ...dx -------------------------------------------------------


def test_natural_notation_matches_technical_syntax() -> None:
    assert _final_expression("∫₀²x²dx") == "8/3"


# --- Contrato geral ------------------------------------------------------------


def test_every_step_is_pure_text_never_latex() -> None:
    for expr in [
        "integral(x**2, x, 0, 2)",
        "integral(4*x**2, x, 0, 2)",
        "integral(x**2+3*x, x, 0, 2)",
        "integral(x**2, x, 3, 3)",
        "integral(x**2, x, 2, 0)",
    ]:
        for step in generate_steps(expr):
            assert "\\" not in step.expression
            assert "$" not in step.expression
            assert "<" not in step.expression


def test_steps_numbered_sequentially_via_list_order() -> None:
    steps = generate_steps("integral(x**2, x, 0, 2)")
    assert len(steps) == 5
    assert steps[0].title == "Integral original"
    assert steps[-1].title == "Calculando"
