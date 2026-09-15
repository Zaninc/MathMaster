"""Sprint V3.0.6 (Derivadas de Ordem Superior) — cobertura de
`math_engine.steps.higher_order_derivatives`: `derivada(expr, var, n)`
com n >= 2. Cada rodada reaproveita o MESMO motor de primeira ordem já
existente (regra da potência/produto/cadeia/quociente/elementar trivial)
— nenhum destes testes recalcula nada à mão; todo valor final é
comparado contra `calculus.derivatives.compute_derivative` (o mesmo
`sympy.diff(expr, symbol, n)` que `/solve` usa)."""
from __future__ import annotations

import pytest
from sympy import Symbol, cos, exp, log, sin, simplify

from app.math_engine.calculus.derivatives import compute_derivative
from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps

_x = Symbol("x")


def _final_expression(text: str) -> str:
    return generate_steps(text)[-1].expression


def _titles(text: str) -> list[str]:
    return [s.title for s in generate_steps(text)]


# --- Os 8 casos obrigatórios do ticket -------------------------------------


def test_x4_second_derivative() -> None:
    assert _final_expression("derivada(x**4, x, 2)") == "12*x**2"


def test_x5_third_derivative() -> None:
    assert _final_expression("derivada(x**5, x, 3)") == "60*x**2"


def test_sin_second_derivative() -> None:
    assert _final_expression("derivada(sin(x), x, 2)") == "-sin(x)"


def test_cos_third_derivative() -> None:
    assert _final_expression("derivada(cos(x), x, 3)") == "sin(x)"


def test_exp_second_derivative() -> None:
    assert _final_expression("derivada(exp(x), x, 2)") == "exp(x)"


def test_ln_second_derivative() -> None:
    assert _final_expression("derivada(ln(x), x, 2)") == "-1/x**2"


def test_x_times_exp_second_derivative() -> None:
    assert _final_expression("derivada(x*exp(x), x, 2)") == "x*exp(x) + 2*exp(x)"


def test_reciprocal_second_derivative() -> None:
    assert _final_expression("derivada(1/x, x, 2)") == "2/x**3"


@pytest.mark.parametrize(
    "text,expr,order",
    [
        ("derivada(x**4, x, 2)", _x**4, 2),
        ("derivada(x**5, x, 3)", _x**5, 3),
        ("derivada(sin(x), x, 2)", sin(_x), 2),
        ("derivada(cos(x), x, 3)", cos(_x), 3),
        ("derivada(exp(x), x, 2)", exp(_x), 2),
        ("derivada(ln(x), x, 2)", log(_x), 2),
        ("derivada(x*exp(x), x, 2)", _x * exp(_x), 2),
        ("derivada(1/x, x, 2)", 1 / _x, 2),
    ],
)
def test_all_8_mandatory_cases_match_sympy_diff_oracle(text: str, expr, order: int) -> None:
    from sympy import sympify

    mine = sympify(_final_expression(text), locals={"x": _x})
    oracle = compute_derivative(expr, _x, order)
    assert simplify(mine - oracle) == 0


# --- Estrutura dos passos: cada rodada é real, nunca "resultado direto" ----


def test_second_order_has_a_dedicated_header_and_two_rounds() -> None:
    steps = generate_steps("derivada(x**4, x, 2)")
    assert steps[0].title == "Derivada de segunda ordem"
    assert steps[0].expression == "derivada(x**4, x, 2)"
    round_titles = [s.title for s in steps if s.title in ("Calcule a primeira derivada", "Derive novamente")]
    assert round_titles == ["Calcule a primeira derivada", "Derive novamente"]
    assert steps[-1].title == "Resultado"
    assert steps[-1].expression == "12*x**2"


def test_third_order_has_three_real_rounds() -> None:
    # Item 7 do ticket: "para terceira ordem, devem aparecer três etapas
    # reais" — cada "Calcule a primeira derivada"/"Derive novamente"
    # é seguida de passos REAIS do motor de primeira ordem (nunca só um
    # resultado jogado na tela).
    steps = generate_steps("derivada(x**5, x, 3)")
    assert steps[0].title == "Derivada de terceira ordem"
    round_titles = [s.title for s in steps if s.title in ("Calcule a primeira derivada", "Derive novamente")]
    assert round_titles == ["Calcule a primeira derivada", "Derive novamente", "Derive novamente"]
    # Cada rodada usa o RESULTADO REAL da anterior como entrada — nunca
    # uma expressão inventada: d/dx(x^5)=5x^4, d/dx(5x^4)=20x^3, ...
    round_inputs = [s.expression for s in steps if s.title in ("Calcule a primeira derivada", "Derive novamente")]
    assert round_inputs == ["derivada(x**5, x)", "derivada(5*x**4, x)", "derivada(20*x**3, x)"]


def test_result_of_each_round_feeds_the_next_round_literally() -> None:
    # d²f/dx² = d/dx(d/dx(f)) — prova estrutural: a rodada 2 deriva
    # EXATAMENTE o resultado real da rodada 1 (4*x**3 - 6*x + 2), nunca
    # uma reconstrução textual da expressão original.
    steps = generate_steps("derivada(x**4-3*x**2+2*x, x, 2)")
    assert any(s.expression == "derivada(4*x**3 - 6*x + 2, x)" for s in steps)


# --- Ordem 1 continua pelo caminho de sempre (regressão) -------------------


def test_order_1_still_uses_the_original_single_round_path() -> None:
    # Nenhum cabeçalho "Derivada de primeira ordem" nem rodadas —
    # `derivada(expr, var)`/`derivada(expr, var, 1)` continuam 100% pelo
    # caminho já existente (`derivatives.py`/`advanced_derivatives.py`).
    steps_2arg = generate_steps("derivada(x**2, x)")
    steps_3arg_order1 = generate_steps("derivada(x**2, x, 1)")
    assert [s.expression for s in steps_2arg] == [s.expression for s in steps_3arg_order1]
    assert steps_2arg[0].title == "Função original"


# --- Ordem 0/negativa/decimal/vazia/muito alta -----------------------------


@pytest.mark.parametrize(
    "text",
    [
        "derivada(x**2, x, 0)",
        "derivada(x**2, x, -1)",
        "derivada(x**2, x, 2.5)",
        "derivada(x**2, x, )",
        "derivada(x**2, x, abc)",
        "derivada(x**2, x, 11)",
    ],
)
def test_invalid_or_out_of_range_order_raises_friendly_error_in_steps_too(text: str) -> None:
    with pytest.raises(ExpressionError):
        generate_steps(text)


def test_order_at_maximum_allowed_limit_still_produces_steps() -> None:
    steps = generate_steps("derivada(x**2, x, 10)")
    assert steps[-1].expression == "0"


# --- Regressão: composição com as regras existentes -------------------------


def test_first_order_product_rule_unaffected() -> None:
    steps = generate_steps("derivada(x*sin(x), x)")
    assert steps[-1].title == "Simplificando"


def test_first_order_quotient_rule_unaffected() -> None:
    steps = generate_steps("derivada(x/sin(x), x)")
    assert any(s.title == "Identificando um quociente" for s in steps)


def test_first_order_chain_rule_unaffected() -> None:
    steps = generate_steps("derivada((x**2+1)**3, x)")
    assert any(s.title == "Identificando função composta" for s in steps)
