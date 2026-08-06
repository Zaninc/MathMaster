"""Sprint V2.10.1 (Passo a Passo — Integrais) — cobertura de
`math_engine.steps.integrals`: regra da potência, constantes, linearidade
da soma/subtração, a constante de integração ("+ C" sempre presente), e
rejeição amigável para integrais fora do escopo (nunca um erro interno)."""
from __future__ import annotations

import pytest

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps


def _final_expression(text: str) -> str:
    return generate_steps(text)[-1].expression


# --- Constantes --------------------------------------------------------------


def test_constant_alone() -> None:
    steps = generate_steps("integral(5, x)")
    assert steps[0].title == "Integral original"
    assert steps[1].title == "A integral de uma constante é a constante multiplicada pela variável"
    assert steps[1].expression == "5*x"
    assert steps[-1].expression == "5*x + C"


def test_constant_within_polynomial_uses_integrando_title() -> None:
    steps = generate_steps("integral(x**2+5, x)")
    constant_step = next(s for s in steps if s.title.startswith("Integrando") and "5" in s.title)
    assert constant_step.expression == "5*x"


# --- Potência simples ---------------------------------------------------------


def test_bare_x() -> None:
    assert _final_expression("integral(x, x)") == "x**2/2 + C"


def test_power_rule_x_squared() -> None:
    steps = generate_steps("integral(x**2, x)")
    power_step = next(s for s in steps if "regra da potência" in s.title)
    assert power_step.expression == "x**3/3"
    assert steps[-1].expression == "x**3/3 + C"


def test_power_rule_x_fifth_matches_ticket_example() -> None:
    assert _final_expression("integral(x**5, x)") == "x**6/6 + C"


# --- Coeficiente ---------------------------------------------------------------


def test_coefficient_power() -> None:
    assert _final_expression("integral(3*x**2, x)") == "x**3 + C"


def test_negative_coefficient_power() -> None:
    assert _final_expression("integral(-4*x**3, x)") == "-x**4 + C"


# --- Soma ----------------------------------------------------------------------


def test_sum_matches_ticket_worked_example() -> None:
    steps = generate_steps("integral(x**2+3*x, x)")
    titles = [s.title for s in steps]
    assert titles[0] == "Integral original"
    assert titles[1] == "Aplicando a linearidade da integral"
    assert titles[-2] == "Somando os resultados"
    assert titles[-1] == "Adicionando a constante de integração"
    assert steps[-2].expression == "x**3/3 + 3*x**2/2"
    assert steps[-1].expression == "x**3/3 + 3*x**2/2 + C"


# --- Subtração -------------------------------------------------------------------


def test_subtraction() -> None:
    steps = generate_steps("integral(x**3-5*x, x)")
    linearity_step = next(s for s in steps if s.title == "Aplicando a linearidade da integral")
    assert linearity_step.expression == "integral(x**3, x)-integral(5*x, x)"
    assert steps[-1].expression == "x**4/4 - 5*x**2/2 + C"


# --- Polinômios completos --------------------------------------------------------


def test_full_polynomial_matches_ticket_example_and_solve_result() -> None:
    steps = generate_steps("integral(4*x**4+2*x**2-8*x+5, x)")
    titles_with_math = [s.title for s in steps if "Integrando" in s.title]
    assert titles_with_math == [
        "Integrando 4x⁴ pela regra da potência",
        "Integrando 2x² pela regra da potência",
        "Integrando -8x pela regra da potência",
        "Integrando 5",
    ]
    expressions = [s.expression for s in steps]
    assert "4*x**5/5" in expressions
    assert "2*x**3/3" in expressions
    assert "-4*x**2" in expressions
    assert "5*x" in expressions
    assert steps[-1].expression == "4*x**5/5 + 2*x**3/3 - 4*x**2 + 5*x + C"

    from app.math_engine.dispatcher import solve_expression

    # O passo a passo nunca diverge do motor real de integrais.
    assert solve_expression("integral(4*x**4+2*x**2-8*x+5, x)") == (
        "Integral: 4*x**5/5 + 2*x**3/3 - 4*x**2 + 5*x + C"
    )


# --- Constante de integração sempre presente --------------------------------------


@pytest.mark.parametrize(
    "expr",
    [
        "integral(5, x)",
        "integral(x, x)",
        "integral(x**2, x)",
        "integral(3*x**2, x)",
        "integral(x**2+3*x, x)",
        "integral(4*x**4+2*x**2-8*x+5, x)",
    ],
)
def test_plus_c_always_present_as_final_step(expr: str) -> None:
    steps = generate_steps(expr)
    assert steps[-1].title == "Adicionando a constante de integração"
    assert steps[-1].expression.endswith("+ C")
    assert steps[-1].explanation == (
        "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C."
    )


# --- Fora de escopo: erro amigável, nunca interno ---------------------------------


def test_sin_rejected_with_friendly_message() -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("integral(sin(x), x)")


def test_exp_rejected_with_friendly_message() -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("integral(exp(x), x)")


def test_ln_rejected_with_friendly_message() -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("integral(ln(x), x)")


def test_one_over_x_rejected_with_friendly_message() -> None:
    # x**-1 -> ln|x|, fora do escopo da regra da potência desta versão.
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("integral(1/x, x)")


def test_product_of_variables_rejected_with_friendly_message() -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("integral(x*sin(x), x)")


def test_sin_still_works_via_solve_despite_steps_rejection() -> None:
    from app.math_engine.dispatcher import solve_expression

    assert solve_expression("integral(sin(x), x)") == "Integral: -cos(x) + C"


def test_definite_integral_has_own_dedicated_module_since_v2_10_2() -> None:
    # 4 argumentos (definida) tinha seu próprio módulo, `definite_
    # integrals.py`, desde a Sprint V2.10.2 — ver `test_steps_definite_
    # integrals.py` para a cobertura completa; aqui só confirma que não
    # cai mais na exclusão geral de domínio de cálculo.
    steps = generate_steps("integral(x**2, x, 0, 1)")
    assert steps[-1].title == "Calculando"
    assert steps[-1].expression == "1/3"


def test_definite_integral_still_works_via_solve() -> None:
    from app.math_engine.dispatcher import solve_expression

    assert solve_expression("integral(x**2, x, 0, 1)") == "Integral definida: 1/3"


# --- Notação natural ∫...dx -------------------------------------------------------


def test_natural_notation_matches_technical_syntax() -> None:
    assert _final_expression("∫(x²+3x)dx") == "x**3/3 + 3*x**2/2 + C"
    assert _final_expression("∫x⁵dx") == "x**6/6 + C"


# --- Contrato geral ------------------------------------------------------------


def test_every_step_is_pure_text_never_latex() -> None:
    for expr in [
        "integral(5, x)",
        "integral(x**5, x)",
        "integral(3*x**2, x)",
        "integral(4*x**4+2*x**2-8*x+5, x)",
    ]:
        for step in generate_steps(expr):
            assert "\\" not in step.expression
            assert "$" not in step.expression
            assert "<" not in step.expression
