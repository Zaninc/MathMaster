"""Sprint V2.12.1 (Passo a Passo — Limites Trigonométricos Fundamentais)
— cobertura de `math_engine.steps.trigonometric_limits`: sen(ax)/x,
x/sen(x), sen(ax)/sen(bx), (1-cos(ax))/x², sempre reduzidos ao limite
fundamental `lim u→0 sen(u)/u = 1`, e rejeição amigável para o que ainda
não é suportado (nunca um erro interno)."""
from __future__ import annotations

import pytest

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps


def _final_expression(text: str) -> str:
    return generate_steps(text)[-1].expression


def _titles(text: str) -> list[str]:
    return [s.title for s in generate_steps(text)]


# --- sen(x)/x (caso base, a=1) -----------------------------------------------


def test_sin_over_x_matches_ticket_example() -> None:
    steps = generate_steps("limite(sin(x)/x, x, 0)")
    assert _titles("limite(sin(x)/x, x, 0)") == [
        "Expressão original",
        "Reconhecendo o limite fundamental",
        "Calculando",
    ]
    recognize_step = steps[1]
    assert recognize_step.expression == "limite(sin(x)/x, x, 0)=1"
    assert recognize_step.explanation is not None
    assert steps[-1].expression == "1"


# --- x/sen(x) -----------------------------------------------------------------


def test_x_over_sin_x_matches_ticket_example() -> None:
    steps = generate_steps("limite(x/sin(x), x, 0)")
    assert _titles("limite(x/sin(x), x, 0)") == [
        "Expressão original",
        "Reconhecendo o limite fundamental (forma recíproca)",
        "Calculando",
    ]
    assert steps[-1].expression == "1"


# --- sen(ax)/x -----------------------------------------------------------------


def test_sin_of_ax_over_x_matches_ticket_example() -> None:
    steps = generate_steps("limite(sin(3*x)/x, x, 0)")
    assert _titles("limite(sin(3*x)/x, x, 0)") == [
        "Expressão original",
        "Reconhecendo o limite fundamental",
        "Reescrevendo para isolar o limite fundamental",
        "Aplicando o limite fundamental",
        "Calculando",
    ]
    rewrite_step = next(s for s in steps if s.title == "Reescrevendo para isolar o limite fundamental")
    assert rewrite_step.expression == "3*sin(3*x)/(3*x)"
    apply_step = next(s for s in steps if s.title == "Aplicando o limite fundamental")
    assert apply_step.expression == "3*1"
    assert steps[-1].expression == "3"


def test_sin_of_ax_over_x_natural_notation() -> None:
    assert _final_expression("lim x→0 sin(3*x)/x") == "3"


# --- sen(ax)/sen(bx) -------------------------------------------------------------


def test_sin_over_sin_matches_ticket_example() -> None:
    steps = generate_steps("limite(sin(5*x)/sin(2*x), x, 0)")
    assert _titles("limite(sin(5*x)/sin(2*x), x, 0)") == [
        "Expressão original",
        "Reconhecendo o limite fundamental",
        "Reescrevendo como produto de limites fundamentais",
        "Aplicando o limite fundamental",
        "Calculando",
    ]
    rewrite_step = next(
        s for s in steps if s.title == "Reescrevendo como produto de limites fundamentais"
    )
    assert rewrite_step.expression == "(5/2)*(sin(5*x)/(5*x))*((2*x)/sin(2*x))"
    apply_step = next(s for s in steps if s.title == "Aplicando o limite fundamental")
    assert apply_step.expression == "5/2*1*1"
    assert steps[-1].expression == "5/2"

    from app.math_engine.dispatcher import solve_expression

    # O passo a passo nunca diverge do motor real de limites.
    assert solve_expression("limite(sin(5*x)/sin(2*x), x, 0)") == "Limite: 5/2"


# --- (1-cos(x))/x² (caso base, a=1) --------------------------------------------


def test_one_minus_cos_over_x_squared_matches_ticket_example() -> None:
    steps = generate_steps("limite((1-cos(x))/x**2, x, 0)")
    assert _titles("limite((1-cos(x))/x**2, x, 0)") == [
        "Expressão original",
        "Aplicando a identidade 1-cos(θ)=2sen²(θ/2)",
        "Reorganizando a fração",
        "Reconhecendo o limite fundamental",
        "Aplicando o limite fundamental",
        "Calculando",
    ]
    identity_step = steps[1]
    assert identity_step.expression == "1-cos(x)=2*sin(x/2)**2"
    reorganize_step = steps[2]
    assert reorganize_step.expression == "1/2*(sin(x/2)/(x/2))**2"
    assert steps[-1].expression == "1/2"


# --- (1-cos(ax))/x² -------------------------------------------------------------


def test_one_minus_cos_of_ax_over_x_squared_matches_ticket_example() -> None:
    steps = generate_steps("limite((1-cos(3*x))/x**2, x, 0)")
    identity_step = next(s for s in steps if s.title == "Aplicando a identidade 1-cos(θ)=2sen²(θ/2)")
    assert identity_step.expression == "1-cos(3*x)=2*sin(3*x/2)**2"
    reorganize_step = next(s for s in steps if s.title == "Reorganizando a fração")
    assert reorganize_step.expression == "9/2*(sin(3*x/2)/(3*x/2))**2"
    apply_step = next(s for s in steps if s.title == "Aplicando o limite fundamental")
    assert apply_step.expression == "9/2*1**2"
    assert steps[-1].expression == "9/2"

    from app.math_engine.dispatcher import solve_expression

    assert solve_expression("limite((1-cos(3*x))/x**2, x, 0)") == "Limite: 9/2"


# --- Fora de escopo: erro amigável, nunca interno ---------------------------


@pytest.mark.parametrize(
    "expr",
    [
        "limite(tan(x)/x, x, 0)",
        "limite(sin(x**2)/x, x, 0)",
        "limite(cos(x**2), x, 0)",
        "limite(tan(3*x), x, 0)",
        "limite(sin(x)*cos(x), x, 0)",
        "limite(sin(x)+cos(x), x, 0)",
    ],
)
def test_out_of_scope_trigonometric_expressions_rejected_with_friendly_message(expr: str) -> None:
    # sec/csc/cot nem chegam a este ponto: não são nomes reconhecidos pelo
    # parser existente (`safe_parsing.py`), a mesma limitação de sempre —
    # já rejeitados (com uma mensagem diferente, de parsing) muito antes de
    # qualquer classificação de domínio, em qualquer expressão que os use,
    # não só limites. Fora de escopo desta sprint (motor intocado).
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps(expr)


def test_sin_over_x_at_nonzero_point_rejected_with_friendly_message() -> None:
    # As identidades só valem em x->0; em outro ponto não são reivindicadas
    # aqui e caem no caminho racional existente (sin(x) não é polinômio).
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("limite(sin(x)/x, x, 1)")


def test_out_of_scope_still_works_via_solve_despite_steps_rejection() -> None:
    from app.math_engine.dispatcher import solve_expression

    assert solve_expression("limite(tan(x)/x, x, 0)") == "Limite: 1"


# --- Regressão: limites racionais/polinomiais continuam pelo caminho da V2.12 ----


def test_rational_limit_still_uses_v2_12_path() -> None:
    steps = generate_steps("limite((x**2-4)/(x-2), x, 2)")
    titles = [s.title for s in steps]
    assert "Reconhecendo o limite fundamental" not in titles
    assert steps[-1].expression == "4"


def test_polynomial_direct_substitution_still_works() -> None:
    assert _final_expression("limite(x**2+1, x, 2)") == "5"


# --- Contrato geral -----------------------------------------------------------


def test_every_step_is_pure_text_never_latex() -> None:
    for expr in [
        "limite(sin(x)/x, x, 0)",
        "limite(x/sin(x), x, 0)",
        "limite(sin(3*x)/x, x, 0)",
        "limite(sin(5*x)/sin(2*x), x, 0)",
        "limite((1-cos(x))/x**2, x, 0)",
        "limite((1-cos(3*x))/x**2, x, 0)",
    ]:
        for step in generate_steps(expr):
            assert "\\" not in step.expression
            assert "$" not in step.expression
            assert "<" not in step.expression


def test_steps_numbered_sequentially_via_list_order() -> None:
    steps = generate_steps("limite(sin(x)/x, x, 0)")
    assert steps[0].title == "Expressão original"
    assert steps[-1].title == "Calculando"
