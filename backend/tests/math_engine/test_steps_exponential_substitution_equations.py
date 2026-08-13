"""Sprint "Exponenciais e Logaritmos" — cobertura de
`math_engine.steps.exponential_substitution_equations`: equações
exponenciais resolvidas via substituição u=base**x, reaproveitando
`quadratic_equations.py` (a quadrática EM u) e
`exponential_equations.resolve_exponential_target` (a volta para x em
cada raiz real e positiva de u)."""
from __future__ import annotations

import pytest

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps


def _final_x_values(text: str) -> set[str]:
    return {s.expression for s in generate_steps(text) if s.expression.startswith("x=")}


def test_ticket_worked_example_e_2x_5ex_plus_6() -> None:
    steps = generate_steps("e^(2x)-5e^x+6=0")
    titles = " ".join(s.title or "" for s in steps)
    assert "substituição u=exp(x)" in titles
    assert "Fatorando" in titles
    assert _final_x_values("e^(2x)-5e^x+6=0") == {"x=ln(2)", "x=ln(3)"}


def test_shows_quadratic_in_u_equation() -> None:
    steps = generate_steps("e^(2x)-5e^x+6=0")
    expressions = [s.expression for s in steps]
    assert "u**2 - 5*u + 6=0" in expressions


def test_filters_negative_root_of_u_extraneous_solution() -> None:
    # u**2-3u-4=0 -> u=4 (válido, u=e^x>0) ou u=-1 (descartado: e^x nunca
    # é negativo) -- só x=ln(4) deve aparecer como resposta final.
    steps = generate_steps("e^(2x)-3e^x-4=0")
    titles = " ".join(s.title or "" for s in steps)
    assert "u=-1" not in [s.expression for s in steps if s.title and "retomando" in s.title]
    assert _final_x_values("e^(2x)-3e^x-4=0") == {"x=ln(4)"}


def test_numeric_base_substitution_also_supported() -> None:
    # "também teste casos análogos de base numérica" (ticket item 6):
    # 2^(2x)-6*2^x+8=0, u=2^x -> u²-6u+8=0 -> u=2 ou u=4 (ambos positivos).
    result = _final_x_values("2^(2x)-6*2^x+8=0")
    assert result == {"x=1", "x=2"}


def test_no_positive_root_of_u_raises_friendly_error() -> None:
    # u**2+3u+2=0 -> u=-1 ou u=-2, nenhum positivo -- sem solução real em x.
    with pytest.raises(ExpressionError, match="não possui solução real"):
        generate_steps("e^(2x)+3e^x+2=0")


def test_already_in_standard_form_skips_reorganizing_step() -> None:
    steps = generate_steps("e^(2x)-5e^x+6=0")
    titles = [s.title for s in steps]
    assert "Organizando a equação (tudo em um lado, igualado a zero)" not in titles


def test_not_yet_in_standard_form_shows_reorganizing_step() -> None:
    steps = generate_steps("e^(2x)-5e^x=-6")
    titles = [s.title for s in steps]
    assert "Organizando a equação (tudo em um lado, igualado a zero)" in titles
    assert _final_x_values("e^(2x)-5e^x=-6") == {"x=ln(2)", "x=ln(3)"}


# --- Fora de escopo (nunca "chuta") ------------------------------------------


def test_single_exponential_term_is_not_substitution_shape() -> None:
    # Sem termo em u² (só e^x), é uma equação exponencial simples --
    # roteada para `exponential_equations.py`, não para este módulo.
    steps = generate_steps("e^x=5")
    titles = " ".join(s.title or "" for s in steps)
    assert "substituição" not in titles.lower()


def test_mismatched_exponent_ratio_is_out_of_scope() -> None:
    # e^(3x) não é o dobro de e^x -- fora do padrão u=base**x/u²=base**(2x)
    # explicitamente suportado nesta sprint.
    with pytest.raises(ExpressionError):
        generate_steps("e^(3x)-5e^x+6=0")


# --- Contrato geral ------------------------------------------------------------


def test_every_step_is_pure_text_never_latex() -> None:
    for expr in ["e^(2x)-5e^x+6=0", "e^(2x)-3e^x-4=0"]:
        for step in generate_steps(expr):
            assert "\\" not in step.expression
            assert "$" not in step.expression


# --- Regressão do /solve ------------------------------------------------------


def test_regression_solve_substitution_equation_gives_correct_real_answers() -> None:
    from app.math_engine.dispatcher import solve_expression

    result = solve_expression("e^(2x)-5e^x+6=0")
    assert "log(2)" in result or "ln(2)" in result
    assert "log(3)" in result or "ln(3)" in result
    assert "I" not in result
