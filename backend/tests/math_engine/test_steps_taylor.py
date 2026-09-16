"""Sprint V3.0.7 (Séries de Taylor e Maclaurin) — cobertura de
`math_engine.steps.taylor`. Cada valor mostrado em cada passo (derivadas,
avaliações, resultado final) é comparado contra o motor REAL
(`calculus.taylor`/`calculus.derivatives`), nunca contra uma string
"chutada" à mão — mesmo espírito de `test_steps_implicit_
differentiation.py`."""
from __future__ import annotations

from sympy import Symbol, cos, diff, exp, pi, sin, simplify, sympify

from app.math_engine.calculus.derivatives import compute_derivative
from app.math_engine.steps import generate_steps

_x = Symbol("x")


def _steps(text: str):
    return generate_steps(text)


def _final_expression(text: str) -> str:
    return generate_steps(text)[-1].expression


# --- Estrutura geral ---------------------------------------------------------


def test_first_step_is_the_taylor_formula_reference() -> None:
    steps = _steps("taylor(exp(x), x, 0, 4)")
    assert steps[0].title == "Fórmula de Taylor"


def test_second_step_is_the_original_function() -> None:
    steps = _steps("taylor(exp(x), x, 0, 4)")
    assert steps[1].title == "Função original"
    assert steps[1].expression == "f(x)=exp(x)"


def test_last_step_is_the_simplified_result_matching_solve() -> None:
    from app.math_engine.dispatcher import solve_expression

    steps = _steps("taylor(exp(x), x, 0, 4)")
    assert steps[-1].title == "Simplificando"
    solve_result = solve_expression("taylor(exp(x), x, 0, 4)")
    assert solve_result == f"Taylor: {steps[-1].expression.split('=', 1)[1]}"


def test_one_step_per_derivative_order_shows_the_real_computed_derivative() -> None:
    steps = _steps("taylor(sin(x), x, 0, 4)")
    derivative_steps = [s for s in steps if s.title.startswith("Calculando")]
    assert len(derivative_steps) == 4  # k=1..4 (k=0 é "Função original")
    expected = [
        compute_derivative(sin(_x), _x, k) for k in range(1, 5)
    ]
    for step, exp_derivative in zip(derivative_steps, expected):
        shown = sympify(step.expression.split("=", 1)[1], locals={"x": _x})
        assert simplify(shown - exp_derivative) == 0


def test_one_evaluation_step_per_order_including_zero_terms() -> None:
    # Item 11 do ticket: o passo a passo precisa mostrar POR QUE os termos
    # ímpares zeram — as avaliações de f'(pi/2), f'''(pi/2) precisam
    # aparecer explicitamente como 0, nunca omitidas silenciosamente.
    steps = _steps("taylor(sin(x), x, pi/2, 4)")
    evaluation_steps = [s for s in steps if s.title.startswith("Avaliando")]
    assert len(evaluation_steps) == 5  # k=0..4
    values = [sympify(s.expression.split("=", 1)[1], locals={"pi": pi}) for s in evaluation_steps]
    assert values == [1, 0, -1, 0, 1]


# --- Teste de ouro (item 11) -------------------------------------------------


def test_golden_test_final_result() -> None:
    final = _final_expression("taylor(sin(x), x, pi/2, 4)")
    text = final.split("=", 1)[1]
    mine = sympify(text, locals={"x": _x, "pi": pi})
    expected = sympify("1 - (x-pi/2)**2/2 + (x-pi/2)**4/24", locals={"x": _x, "pi": pi})
    assert simplify(mine - expected) == 0


def test_golden_test_matches_solve_endpoint() -> None:
    from app.math_engine.dispatcher import solve_expression

    steps_final = _final_expression("taylor(sin(x), x, pi/2, 4)").split("=", 1)[1]
    solve_result = solve_expression("taylor(sin(x), x, pi/2, 4)").removeprefix("Taylor: ")
    assert steps_final == solve_result


# --- Consistência: passos e /solve nunca divergem para os 6 casos obrigatórios


def test_all_6_mandatory_cases_steps_match_solve() -> None:
    from app.math_engine.dispatcher import solve_expression

    cases = [
        "taylor(exp(x), x, 0, 4)",
        "taylor(sin(x), x, 0, 5)",
        "taylor(cos(x), x, 0, 6)",
        "taylor(ln(1+x), x, 0, 4)",
        "taylor(1/(1-x), x, 0, 5)",
        "taylor(ln(x), x, 1, 4)",
    ]
    for text in cases:
        steps_final = _final_expression(text).split("=", 1)[1]
        solve_result = solve_expression(text).removeprefix("Taylor: ")
        assert steps_final == solve_result, text


# --- Ordem 0 (P_0(x) = f(a)) — item 14 --------------------------------------


def test_order_0_has_no_derivative_steps_only_evaluation_and_result() -> None:
    steps = _steps("taylor(x**2, x, 3, 0)")
    derivative_steps = [s for s in steps if s.title.startswith("Calculando")]
    assert derivative_steps == []
    assert steps[-1].expression == "P_0(x)=9"
