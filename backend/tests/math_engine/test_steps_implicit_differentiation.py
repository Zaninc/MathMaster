"""Sprint "Derivação Implícita" — cobertura de
`math_engine.steps.implicit_differentiation`: `derivada(EQUAÇÃO, x)`
onde EQUAÇÃO depende de x e de exatamente uma segunda variável (y=y(x)
implícito). Todo caso suportado é verificado contra o oráculo
`sympy.idiff` (nunca contra um valor "chutado" à mão) — mesmo espírito de
`test_steps_quotient_rule.py`, que sempre compara contra `compute_
derivative`."""
from __future__ import annotations

import pytest
from sympy import Symbol, idiff, simplify, sympify

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps

_x = Symbol("x")
_y = Symbol("y")


def _final_expression(text: str) -> str:
    return generate_steps(text)[-1].expression


def _titles(text: str) -> list[str]:
    return [s.title for s in generate_steps(text)]


def _assert_matches_oracle(call: str, lhs_text: str, rhs_text: str) -> None:
    final = _final_expression(call)
    assert final.startswith("derivada(y, x)=")
    mine = sympify(final.split("=", 1)[1], locals={"x": _x, "y": _y})
    lhs = sympify(lhs_text, locals={"x": _x, "y": _y})
    rhs = sympify(rhs_text, locals={"x": _x, "y": _y})
    oracle = idiff(lhs - rhs, _y, _x)
    assert simplify(mine - oracle) == 0


# --- Os 8 casos obrigatórios do ticket ------------------------------------


def test_linear_case_x_plus_y_equals_5() -> None:
    assert _final_expression("derivada(x+y=5, x)") == "derivada(y, x)=-1"
    _assert_matches_oracle("derivada(x+y=5, x)", "x+y", "5")


def test_circle_x_squared_plus_y_squared_equals_25() -> None:
    assert _final_expression("derivada(x**2+y**2=25, x)") == "derivada(y, x)=-x/y"
    _assert_matches_oracle("derivada(x**2+y**2=25, x)", "x**2+y**2", "25")


def test_product_rule_with_y_x_squared_plus_xy_plus_y_squared_equals_7() -> None:
    steps = generate_steps("derivada(x**2+x*y+y**2=7, x)")
    assert "Identificando um produto" in [s.title for s in steps]
    final = steps[-1].expression
    mine = sympify(final.split("=", 1)[1], locals={"x": _x, "y": _y})
    assert simplify(mine - (-(2 * _x + _y) / (_x + 2 * _y))) == 0
    _assert_matches_oracle("derivada(x**2+x*y+y**2=7, x)", "x**2+x*y+y**2", "7")


def test_chain_rule_sin_y_equals_x() -> None:
    assert _final_expression("derivada(sin(y)=x, x)") == "derivada(y, x)=1/cos(y)"
    _assert_matches_oracle("derivada(sin(y)=x, x)", "sin(y)", "x")


def test_chain_plus_product_sin_xy_equals_x_plus_y() -> None:
    steps = generate_steps("derivada(sin(x*y)=x+y, x)")
    assert "Identificando função composta" in [s.title for s in steps]
    _assert_matches_oracle("derivada(sin(x*y)=x+y, x)", "sin(x*y)", "x+y")


def test_mixed_powers_x_cubed_plus_y_cubed_equals_6xy() -> None:
    final = _final_expression("derivada(x**3+y**3=6*x*y, x)")
    mine = sympify(final.split("=", 1)[1], locals={"x": _x, "y": _y})
    assert simplify(mine - (_x**2 - 2 * _y) / (2 * _x - _y**2)) == 0
    _assert_matches_oracle("derivada(x**3+y**3=6*x*y, x)", "x**3+y**3", "6*x*y")


def test_natural_log_ln_y_equals_x() -> None:
    assert _final_expression("derivada(ln(y)=x, x)") == "derivada(y, x)=y"
    _assert_matches_oracle("derivada(ln(y)=x, x)", "log(y)", "x")


def test_exponential_exp_y_equals_x() -> None:
    assert _final_expression("derivada(exp(y)=x, x)") == "derivada(y, x)=exp(-y)"
    _assert_matches_oracle("derivada(exp(y)=x, x)", "exp(y)", "x")


# --- Caso mais simples da ticket (seção 20) -------------------------------


def test_simplest_linear_case_matches_ticket_walkthrough() -> None:
    steps = generate_steps("derivada(x+y=5, x)")
    assert steps[0].title == "Equação original"
    assert steps[0].expression == "x + y=5"
    # Coeficiente 1 (nada para fatorar/dividir) — "Subtraindo"/"Somando" já
    # devolve a derivada isolada diretamente, sem os passos "Fatorando"/
    # "Isolando a derivada" (só aparecem quando o coeficiente de dy/dx é
    # != 1, ver `x**2+y**2=25` abaixo).
    assert steps[-1].expression == "derivada(y, x)=-1"


# --- Notação: nunca vaza y(x)/Derivative(...) na apresentação ------------


def test_never_leaks_raw_function_or_derivative_notation() -> None:
    for call in [
        "derivada(x**2+y**2=25, x)",
        "derivada(sin(x*y)=x+y, x)",
        "derivada(exp(y)=x, x)",
    ]:
        for step in generate_steps(call):
            assert "y(x)" not in step.expression
            assert "Derivative" not in step.expression
            if step.title:
                assert "y(x)" not in step.title
                assert "Derivative" not in step.title


def test_every_step_is_pure_text_never_latex() -> None:
    for call in ["derivada(x+y=5, x)", "derivada(x**2+y**2=25, x)", "derivada(sin(y)=x, x)"]:
        for step in generate_steps(call):
            assert "\\" not in step.expression
            assert "$" not in step.expression
            assert "<" not in step.expression


# --- Notação natural "d/dx(...)" produz o mesmo resultado ------------------


def test_natural_notation_d_dx_equivalent_to_derivada_call() -> None:
    assert _final_expression("d/dx(x**2+y**2=25)") == _final_expression(
        "derivada(x**2+y**2=25, x)"
    )


# --- Testes negativos (seção 31) ------------------------------------------


def test_equation_without_dependent_variable_is_not_faked_as_implicit() -> None:
    with pytest.raises(ExpressionError, match="não depende de nenhuma outra variável"):
        generate_steps("derivada(x**2=4, x)")


def test_more_than_one_dependent_variable_is_rejected_cleanly() -> None:
    with pytest.raises(ExpressionError, match="mais de uma variável dependente"):
        generate_steps("derivada(x**2+y**2+z**2=1, x)")


def test_inequality_inside_derivada_never_crashes() -> None:
    with pytest.raises(ExpressionError, match="inequações"):
        generate_steps("derivada(x**2+y**2<25, x)")


def test_malformed_equation_gives_friendly_error() -> None:
    with pytest.raises(ExpressionError):
        generate_steps("derivada(x**2+y**2=, x)")


# --- Regressão: derivada explícita (sem "=") continua pela engine antiga -


def test_plain_derivative_regression_power_rule() -> None:
    assert _final_expression("derivada(x**5, x)") == "5*x**4"


def test_plain_derivative_regression_product_rule() -> None:
    assert _final_expression("derivada(x*sin(x), x)") == "x*cos(x) + sin(x)"


def test_plain_derivative_regression_chain_rule() -> None:
    assert _final_expression("derivada(sin(x**2), x)") == "2*x*cos(x**2)"


def test_plain_derivative_regression_quotient_rule() -> None:
    steps = generate_steps("derivada((x**2+1)/(x-1), x)")
    assert "Identificando um quociente" in [s.title for s in steps]


def test_plain_equation_without_derivada_wrapper_is_unaffected() -> None:
    # "x²+y²=25" sozinha (sem `derivada(...)`) nunca é derivação
    # implícita — continua caindo na exclusão geral de domínio de
    # equações de 2 incógnitas, como sempre foi.
    with pytest.raises(ExpressionError, match="uma única incógnita"):
        generate_steps("x**2+y**2=25")


# --- Hardening (seção 34): classificação SUPPORTED, sempre contra o oráculo --


@pytest.mark.parametrize(
    ("call", "lhs_text", "rhs_text"),
    [
        ("derivada(x**4+y**4=1, x)", "x**4+y**4", "1"),
        ("derivada(x**2*y+y**2*x=3, x)", "x**2*y+y**2*x", "3"),
        ("derivada(sin(x+y)=x*y, x)", "sin(x+y)", "x*y"),
        ("derivada(cos(x*y)=x**2, x)", "cos(x*y)", "x**2"),
        ("derivada(exp(x*y)=x+y, x)", "exp(x*y)", "x+y"),
        ("derivada(ln(x**2+y**2)=x, x)", "log(x**2+y**2)", "x"),
        ("derivada((x+y)/(x-y)=2, x)", "(x+y)/(x-y)", "2"),
        ("derivada(x/y=2, x)", "x/y", "2"),
    ],
)
def test_hardening_cases_match_oracle(call: str, lhs_text: str, rhs_text: str) -> None:
    _assert_matches_oracle(call, lhs_text, rhs_text)


# --- /solve continua 100% intocado ------------------------------------------


def test_solve_endpoint_now_also_supports_implicit_differentiation() -> None:
    # Hardening Global — encontrado testando a nova tecla "dy/dx" no
    # navegador: o botão "Resolver" (que chama `/solve`) devolvia 400 para
    # `derivada(EQUAÇÃO, x)`, já que só `/solve/steps` sabia lidar com
    # isso. Corrigido promovendo o núcleo de cálculo/verificação para
    # `calculus/implicit_differentiation.py`, reaproveitado por `calculus/
    # dispatcher.py:solve_calculus_text` — mesmo motor, nenhuma duplicação.
    from app.math_engine.dispatcher import solve_expression

    assert solve_expression("derivada(x**2+y**2=25, x)") == "Derivada: -x/y"


def test_solve_endpoint_regression_for_plain_derivative() -> None:
    from app.math_engine.dispatcher import solve_expression

    assert solve_expression("derivada(x*sin(x), x)") == "Derivada: x*cos(x) + sin(x)"
