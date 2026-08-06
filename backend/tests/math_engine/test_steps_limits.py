"""Sprint V2.12 (Passo a Passo — Limites) — cobertura de
`math_engine.steps.limits`: substituição direta (funções contínuas,
incluindo racionais sem indeterminação), indeterminação 0/0 por
fatoração/cancelamento, limites no infinito por comparação de graus, e
rejeição amigável para limites fora do escopo (nunca um erro interno)."""
from __future__ import annotations

import pytest

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps


def _final_expression(text: str) -> str:
    return generate_steps(text)[-1].expression


def _titles(text: str) -> list[str]:
    return [s.title for s in generate_steps(text)]


# --- Limites diretos (polinômios) -------------------------------------------


def test_direct_substitution_polynomial_matches_ticket_example() -> None:
    steps = generate_steps("limite(x**2+1, x, 2)")
    assert _titles("limite(x**2+1, x, 2)") == [
        "Expressão original",
        "Como a função é contínua em x=2, podemos substituir diretamente.",
        "Calculando",
    ]
    substitution_step = steps[1]
    assert substitution_step.expression == "(2)**2 + 1"
    assert steps[-1].expression == "5"


def test_direct_substitution_polynomial_second_example() -> None:
    assert _final_expression("limite(x**3-2*x+1, x, 3)") == "22"


# --- Constantes --------------------------------------------------------------


def test_constant_finite_point() -> None:
    steps = generate_steps("limite(5, x, 2)")
    assert steps[1].title == "Como a expressão não depende de x, o limite é a própria constante."
    assert steps[1].expression == "5"
    assert steps[-1].expression == "5"


def test_constant_infinite_point() -> None:
    assert _final_expression("limite(7, x, oo)") == "7"


# --- Funções racionais sem indeterminação ------------------------------------


def test_rational_no_indetermination_matches_ticket_example() -> None:
    steps = generate_steps("limite((x+1)/(x+3), x, 2)")
    substitution_step = steps[1]
    assert substitution_step.expression == "((2) + 1)/((2) + 3)"
    assert steps[-1].expression == "3/5"


# --- Indeterminação 0/0 por fatoração -----------------------------------------


def test_zero_over_zero_matches_ticket_example() -> None:
    steps = generate_steps("limite((x**2-4)/(x-2), x, 2)")
    assert _titles("limite((x**2-4)/(x-2), x, 2)") == [
        "Expressão original",
        "Substituindo",
        "Reconhecemos uma indeterminação.",
        "Fatorando",
        "Cancelando o fator comum",
        "Substituindo",
    ]
    assert steps[1].expression == "0/0"
    assert steps[2].expression == "0/0"
    assert steps[2].explanation is not None
    assert "indeterminada" in steps[2].explanation
    factoring_step = steps[3]
    assert factoring_step.expression == "(x - 2)*(x + 2)"
    cancel_step = steps[4]
    assert cancel_step.expression == "x + 2"
    assert steps[-1].expression == "4"


def test_zero_over_zero_second_example() -> None:
    steps = generate_steps("limite((x**2-9)/(x-3), x, 3)")
    factoring_step = next(s for s in steps if s.title == "Fatorando")
    assert factoring_step.expression == "(x - 3)*(x + 3)"
    assert steps[-1].expression == "6"

    from app.math_engine.dispatcher import solve_expression

    # O passo a passo nunca diverge do motor real de limites.
    assert solve_expression("limite((x**2-9)/(x-3), x, 3)") == "Limite: 6"


# --- Limites no infinito por comparação de graus ------------------------------


def test_infinite_limit_equal_degrees_matches_ticket_example() -> None:
    steps = generate_steps("limite((3*x**2+2)/(x**2-1), x, oo)")
    assert _titles("limite((3*x**2+2)/(x**2-1), x, oo)") == [
        "Expressão original",
        "O maior grau do numerador é 2 e o maior grau do denominador é 2.",
        "Dividindo o numerador e o denominador por x**2",
        "Quando x→∞, os termos com x no denominador tendem a zero.",
        "Simplificando",
    ]
    divide_step = steps[2]
    assert divide_step.expression == "(3 + 2/x**2)/(1 - 1/x**2)"
    zero_step = steps[3]
    assert zero_step.expression == "3/1"
    assert steps[-1].expression == "3"


def test_infinite_limit_equal_degrees_second_example() -> None:
    assert _final_expression("limite((5*x**3-2)/(2*x**3+7), x, oo)") == "5/2"

    from app.math_engine.dispatcher import solve_expression

    assert solve_expression("limite((5*x**3-2)/(2*x**3+7), x, oo)") == "Limite: 5/2"


def test_infinite_limit_numerator_smaller_degree_matches_ticket_example() -> None:
    steps = generate_steps("limite((x**2+1)/(x**3+5), x, oo)")
    degree_step = steps[1]
    assert degree_step.title == "O maior grau do numerador é 2 e o maior grau do denominador é 3."
    divide_step = steps[2]
    assert divide_step.expression == "(1/x + x**(-3))/(1 + 5/x**3)"
    zero_step = steps[3]
    assert zero_step.expression == "0/1"
    assert steps[-1].expression == "0"


# --- Fora de escopo: erro amigável, nunca interno ---------------------------


def test_sin_over_x_has_own_dedicated_module_since_v2_12_1() -> None:
    # sen(x)/x (e os demais limites trigonométricos fundamentais) tinha
    # seu próprio módulo, `trigonometric_limits.py`, desde a Sprint
    # V2.12.1 — ver `test_steps_trigonometric_limits.py` para a cobertura
    # completa; aqui só confirma que não cai mais na rejeição amigável do
    # caminho racional desta sprint (V2.12).
    steps = generate_steps("limite(sin(x)/x, x, 0)")
    assert steps[-1].title == "Calculando"
    assert steps[-1].expression == "1"


def test_sin_over_x_still_works_via_solve() -> None:
    from app.math_engine.dispatcher import solve_expression

    assert solve_expression("limite(sin(x)/x, x, 0)") == "Limite: 1"


def test_numerator_bigger_degree_diverges_rejected_with_friendly_message() -> None:
    # (x³+1)/(x²-1) diverge quando x->oo — fora do escopo desta versão
    # (sem exemplo de divergência no ticket).
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("limite((x**3+1)/(x**2-1), x, oo)")


def test_negative_infinity_rejected_with_friendly_message() -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("limite((3*x**2+2)/(x**2-1), x, -oo)")


# --- Notação natural lim x→p ... -----------------------------------------------


def test_natural_notation_matches_technical_syntax() -> None:
    assert _final_expression("lim x→2 x**2+1") == "5"


# --- Contrato geral ------------------------------------------------------------


def test_every_step_is_pure_text_never_latex() -> None:
    for expr in [
        "limite(x**2+1, x, 2)",
        "limite((x+1)/(x+3), x, 2)",
        "limite((x**2-4)/(x-2), x, 2)",
        "limite((3*x**2+2)/(x**2-1), x, oo)",
        "limite((x**2+1)/(x**3+5), x, oo)",
    ]:
        for step in generate_steps(expr):
            assert "\\" not in step.expression
            assert "$" not in step.expression
            assert "<" not in step.expression


def test_steps_numbered_sequentially_via_list_order() -> None:
    steps = generate_steps("limite(x**2+1, x, 2)")
    assert steps[0].title == "Expressão original"
    assert steps[-1].title == "Calculando"
