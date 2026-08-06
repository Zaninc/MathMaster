"""Sprint V2.12.2 (Passo a Passo — Regra de L'Hôpital) — cobertura de
`math_engine.steps.lhopital`: indeterminações 0/0 (ponto finito) e ∞/∞
(`x→∞`) com uma única aplicação, sempre o ÚLTIMO recurso da cascata de
limites (depois de substituição direta/fatoração/cancelamento, limites
trigonométricos fundamentais e comparação de graus), e rejeição amigável
para o que ainda não é suportado (nunca um erro interno)."""
from __future__ import annotations

import pytest

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps


def _final_expression(text: str) -> str:
    return generate_steps(text)[-1].expression


def _titles(text: str) -> list[str]:
    return [s.title for s in generate_steps(text)]


# --- Caso 1: 0/0 em ponto finito -----------------------------------------------


def test_zero_over_zero_matches_ticket_example() -> None:
    steps = generate_steps("limite((exp(x)-1)/x, x, 0)")
    assert _titles("limite((exp(x)-1)/x, x, 0)") == [
        "Expressão original",
        "Substituindo o limite",
        "Reconhecemos uma forma indeterminada.",
        "Derivando o numerador",
        "Derivando o denominador",
        "Aplicando a Regra de L'Hôpital (novo limite)",
        "Substituindo",
        "Calculando",
    ]
    substituting_step = steps[1]
    assert substituting_step.expression == "0/0"
    recognize_step = steps[2]
    assert recognize_step.expression == "0/0"
    assert recognize_step.explanation is not None
    assert "L'Hôpital" in recognize_step.explanation

    numer_step = next(s for s in steps if s.title == "Derivando o numerador")
    assert numer_step.expression == "exp(x)"
    denom_step = next(s for s in steps if s.title == "Derivando o denominador")
    assert denom_step.expression == "1"

    new_limit_step = next(s for s in steps if s.title == "Aplicando a Regra de L'Hôpital (novo limite)")
    assert new_limit_step.expression == "limite(exp(x)/1, x, 0)"

    substituted_step = steps[-2]
    assert substituted_step.title == "Substituindo"
    assert substituted_step.expression == "exp((0))"

    assert steps[-1].expression == "1"

    from app.math_engine.dispatcher import solve_expression

    # O passo a passo nunca diverge do motor real de limites.
    assert solve_expression("limite((exp(x)-1)/x, x, 0)") == "Limite: 1"


def test_natural_notation_matches_technical_syntax() -> None:
    assert _final_expression("lim x→0 (exp(x)-1)/x") == "1"


# --- Caso 2: infinito/infinito, quociente tende a 0 ----------------------------


def test_ln_over_x_matches_ticket_example() -> None:
    steps = generate_steps("limite(ln(x)/x, x, oo)")
    assert _titles("limite(ln(x)/x, x, oo)") == [
        "Expressão original",
        "Substituindo o limite",
        "Reconhecemos uma forma indeterminada.",
        "Derivando o numerador",
        "Derivando o denominador",
        "Aplicando a Regra de L'Hôpital (novo limite)",
        "Calculando",
    ]
    substituting_step = steps[1]
    assert substituting_step.expression == "oo/oo"
    numer_step = next(s for s in steps if s.title == "Derivando o numerador")
    assert numer_step.expression == "1/x"
    denom_step = next(s for s in steps if s.title == "Derivando o denominador")
    assert denom_step.expression == "1"
    assert steps[-1].expression == "0"

    from app.math_engine.dispatcher import solve_expression

    assert solve_expression("limite(ln(x)/x, x, oo)") == "Limite: 0"


# --- Caso 3: infinito/infinito, exponencial no denominador --------------------


def test_x_over_exp_x_matches_ticket_example() -> None:
    steps = generate_steps("limite(x/exp(x), x, oo)")
    numer_step = next(s for s in steps if s.title == "Derivando o numerador")
    assert numer_step.expression == "1"
    denom_step = next(s for s in steps if s.title == "Derivando o denominador")
    assert denom_step.expression == "exp(x)"
    assert steps[-1].expression == "0"


# --- Caso 4: exige aplicações sucessivas — fora de escopo ----------------------


def test_x_squared_over_exp_x_requires_multiple_applications() -> None:
    with pytest.raises(
        ExpressionError,
        match="requer aplicações sucessivas",
    ):
        generate_steps("limite(x**2/exp(x), x, oo)")


def test_x_squared_over_exp_x_still_works_via_solve() -> None:
    from app.math_engine.dispatcher import solve_expression

    assert solve_expression("limite(x**2/exp(x), x, oo)") == "Limite: 0"


# --- Regressão: métodos antigos continuam tendo prioridade ---------------------


def test_sin_over_x_still_uses_trigonometric_fundamental_path() -> None:
    steps = generate_steps("limite(sin(x)/x, x, 0)")
    titles = [s.title for s in steps]
    assert "Reconhecendo o limite fundamental" in titles
    assert "Aplicando a Regra de L'Hôpital (novo limite)" not in titles
    assert steps[-1].expression == "1"


def test_one_minus_cos_over_x_squared_still_uses_trigonometric_identity_path() -> None:
    steps = generate_steps("limite((1-cos(x))/x**2, x, 0)")
    titles = [s.title for s in steps]
    assert "Aplicando a identidade 1-cos(θ)=2sen²(θ/2)" in titles
    assert "Aplicando a Regra de L'Hôpital (novo limite)" not in titles
    assert steps[-1].expression == "1/2"


def test_zero_over_zero_polynomial_still_uses_factoring_path() -> None:
    steps = generate_steps("limite((x**2-4)/(x-2), x, 2)")
    titles = [s.title for s in steps]
    assert "Fatorando" in titles
    assert "Aplicando a Regra de L'Hôpital (novo limite)" not in titles
    assert steps[-1].expression == "4"


def test_infinite_polynomial_ratio_still_uses_degree_comparison_path() -> None:
    steps = generate_steps("limite((3*x**2+1)/(x**2-5), x, oo)")
    titles = [s.title for s in steps]
    assert "Dividindo o numerador e o denominador por x**2" in titles
    assert "Aplicando a Regra de L'Hôpital (novo limite)" not in titles
    assert steps[-1].expression == "3"


# --- Fora de escopo: erro amigável, nunca interno ---------------------------


def test_zero_times_infinity_rejected_with_friendly_message() -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("limite(x*ln(x), x, 0)")


def test_lhopital_never_claims_pure_polynomial_ratio() -> None:
    from app.math_engine.steps.lhopital import is_lhopital_shape
    from sympy import symbols

    x = symbols("x")
    assert is_lhopital_shape((x**2 - 4) / (x - 2), x, 2) is False
    assert is_lhopital_shape((3 * x**2 + 1) / (x**2 - 5), x, __import__("sympy").oo) is False


# --- Contrato geral -----------------------------------------------------------


def test_every_step_is_pure_text_never_latex() -> None:
    for expr in [
        "limite((exp(x)-1)/x, x, 0)",
        "limite(ln(x)/x, x, oo)",
        "limite(x/exp(x), x, oo)",
    ]:
        for step in generate_steps(expr):
            assert "\\" not in step.expression
            assert "$" not in step.expression
            assert "<" not in step.expression


def test_steps_numbered_sequentially_via_list_order() -> None:
    steps = generate_steps("limite((exp(x)-1)/x, x, 0)")
    assert steps[0].title == "Expressão original"
    assert steps[-1].title == "Calculando"
