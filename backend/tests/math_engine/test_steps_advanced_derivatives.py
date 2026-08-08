"""Sprint V2.11 (Passo a Passo — Regra do Produto e Regra da Cadeia) —
cobertura de `math_engine.steps.advanced_derivatives`: identificação
correta do método (produto/cadeia/combinação), valores sempre batendo com
`compute_derivative` (o motor real), e rejeição amigável para derivadas
fora do escopo (nunca um erro interno)."""
from __future__ import annotations

import pytest

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps


def _final_expression(text: str) -> str:
    return generate_steps(text)[-1].expression


def _titles(text: str) -> list[str]:
    return [s.title for s in generate_steps(text)]


# --- Regra do produto ------------------------------------------------------


def test_product_power_times_sin_matches_ticket_example() -> None:
    steps = generate_steps("d/dx(x**2*sin(x))")
    assert _titles("d/dx(x**2*sin(x))") == [
        "Função original",
        "Identificando um produto",
        "Aplicando a regra do produto",
        "Derivando f",
        "Derivando g",
        "Substituindo",
        "Simplificando",
    ]
    identify_step = next(s for s in steps if s.title == "Identificando um produto")
    assert identify_step.expression == "f=x**2, g=sin(x)"
    f_step = next(s for s in steps if s.title == "Derivando f")
    assert f_step.expression == "2*x"
    g_step = next(s for s in steps if s.title == "Derivando g")
    assert g_step.expression == "cos(x)"
    substitution_step = next(s for s in steps if s.title == "Substituindo")
    assert substitution_step.expression == "2*x*sin(x)+x**2*cos(x)"
    assert steps[-1].expression == "x**2*cos(x) + 2*x*sin(x)"


def test_product_two_polynomial_factors_never_hides_product_rule() -> None:
    # (x+1)(x²+3) TAMBÉM se expande pra polinômio simples, mas o objetivo é
    # ensinar a regra do produto aqui, não escondê-la atrás da expansão.
    steps = generate_steps("d/dx((x+1)*(x**2+3))")
    assert "Identificando um produto" in [s.title for s in steps]
    identify_step = next(s for s in steps if s.title == "Identificando um produto")
    assert identify_step.expression == "f=x + 1, g=x**2 + 3"
    f_step = next(s for s in steps if s.title == "Derivando f")
    assert f_step.expression == "1"
    g_step = next(s for s in steps if s.title == "Derivando g")
    assert g_step.expression == "2*x"
    substitution_step = next(s for s in steps if s.title == "Substituindo")
    assert substitution_step.expression == "1*(x**2 + 3)+(x + 1)*2*x"

    from app.math_engine.dispatcher import solve_expression

    assert steps[-1].expression == "x**2 + 2*x*(x + 1) + 3"
    assert solve_expression("d/dx((x+1)*(x**2+3))") == "Derivada: x**2 + 2*x*(x + 1) + 3"


def test_product_variable_times_exp_no_chain_needed() -> None:
    steps = generate_steps("d/dx(x*exp(x))")
    f_step = next(s for s in steps if s.title == "Derivando f")
    assert f_step.expression == "1"
    g_step = next(s for s in steps if s.title == "Derivando g")
    assert g_step.expression == "exp(x)"
    assert steps[-1].expression == "x*exp(x) + exp(x)"


# --- Regra da cadeia ---------------------------------------------------------


def test_chain_power_matches_ticket_example() -> None:
    steps = generate_steps("d/dx((x**2+1)**3)")
    assert _titles("d/dx((x**2+1)**3)") == [
        "Função original",
        "Identificando função composta",
        "Derivando a externa",
        "Derivando a interna",
        "Aplicando a regra da cadeia",
        "Simplificando",
    ]
    identify_step = next(s for s in steps if s.title == "Identificando função composta")
    assert identify_step.expression == "u=x**2 + 1, y=u**3"
    outer_step = next(s for s in steps if s.title == "Derivando a externa")
    assert outer_step.expression == "3*u**2"
    inner_step = next(s for s in steps if s.title == "Derivando a interna")
    assert inner_step.expression == "2*x"
    apply_step = next(s for s in steps if s.title == "Aplicando a regra da cadeia")
    assert apply_step.expression == "3*(x**2 + 1)**2*2*x"
    assert steps[-1].title == "Simplificando"
    assert steps[-1].expression == "6*x*(x**2 + 1)**2"


def test_chain_power_second_example() -> None:
    assert _final_expression("d/dx((3*x+2)**5)") == "15*(3*x + 2)**4"


def test_chain_sin_matches_ticket_example() -> None:
    steps = generate_steps("d/dx(sin(x**2))")
    assert _titles("d/dx(sin(x**2))") == [
        "Função original",
        "Identificando função composta",
        "Derivando a externa",
        "Derivando a interna",
        "Aplicando a regra da cadeia",
    ]
    identify_step = next(s for s in steps if s.title == "Identificando função composta")
    assert identify_step.expression == "u=x**2, y=sin(u)"
    outer_step = next(s for s in steps if s.title == "Derivando a externa")
    assert outer_step.expression == "cos(u)"
    inner_step = next(s for s in steps if s.title == "Derivando a interna")
    assert inner_step.expression == "2*x"
    assert steps[-1].expression == "2*x*cos(x**2)"


def test_chain_cos_matches_ticket_example() -> None:
    steps = generate_steps("d/dx(cos(3*x))")
    outer_step = next(s for s in steps if s.title == "Derivando a externa")
    assert outer_step.expression == "-sin(u)"
    assert steps[-1].expression == "-3*sin(3*x)"


def test_chain_exp_matches_ticket_example() -> None:
    steps = generate_steps("d/dx(exp(x**2))")
    identify_step = next(s for s in steps if s.title == "Identificando função composta")
    assert identify_step.expression == "u=x**2, y=exp(u)"
    outer_step = next(s for s in steps if s.title == "Derivando a externa")
    assert outer_step.expression == "exp(u)"
    assert steps[-1].expression == "2*x*exp(x**2)"


# --- Produto + cadeia combinados ---------------------------------------------


def test_product_and_chain_combined_matches_ticket_example() -> None:
    steps = generate_steps("d/dx((x**2+1)**3*sin(x))")
    titles = [s.title for s in steps]
    assert titles == [
        "Função original",
        "Identificando um produto",
        "Aplicando a regra do produto",
        "Identificando função composta",
        "Derivando a externa",
        "Derivando a interna",
        "Aplicando a regra da cadeia",
        "Simplificando",
        "Derivando g",
        "Substituindo",
        "Simplificando",
    ]
    substitution_step = next(s for s in steps if s.title == "Substituindo")
    assert substitution_step.expression == "6*x*(x**2 + 1)**2*sin(x)+(x**2 + 1)**3*cos(x)"
    assert steps[-1].expression == "6*x*(x**2 + 1)**2*sin(x) + (x**2 + 1)**3*cos(x)"

    from app.math_engine.dispatcher import solve_expression

    assert solve_expression("d/dx((x**2+1)**3*sin(x))") == (
        "Derivada: 6*x*(x**2 + 1)**2*sin(x) + (x**2 + 1)**3*cos(x)"
    )


# --- Regressão V2.10: derivadas polinomiais simples continuam intactas ------


@pytest.mark.parametrize(
    "expr,expected",
    [
        ("d/dx(x**2)", "2*x"),
        ("d/dx(3*x**2)", "6*x"),
        ("d/dx(x**2+3*x)", "2*x + 3"),
        ("d/dx(4*x**4+2*x**2-8*x+5)", "16*x**3 + 4*x - 8"),
        ("d/dx(-4*x**3)", "-12*x**2"),
    ],
)
def test_simple_polynomial_derivatives_still_use_v2_10_path(expr: str, expected: str) -> None:
    # Nenhuma destas deve ser roteada para produto/cadeia — continuam pela
    # regra da potência/linearidade da soma, exatamente como na V2.10.
    steps = generate_steps(expr)
    assert "Identificando um produto" not in [s.title for s in steps]
    assert "Identificando função composta" not in [s.title for s in steps]
    assert steps[-1].expression == expected


def test_bare_sin_still_rejected_no_chain_needed() -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("d/dx(sin(x))")


def test_bare_exp_still_rejected_no_chain_needed() -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("d/dx(exp(x))")


# --- Regressão: quociente tem seu próprio módulo dedicado desde a V2.13 --------


def test_quotient_has_own_dedicated_module_since_v2_13() -> None:
    # `x/sin(x)` tinha denominador != 1 e por isso ficava fora do escopo
    # da V2.11 (regra do produto/cadeia, que só trata denominador == 1);
    # desde a Sprint V2.13 tem seu próprio módulo, `quotient_rule.py` —
    # ver `test_steps_quotient_rule.py` para a cobertura completa. Aqui só
    # confirma que não cai mais na rejeição amigável genérica.
    steps = generate_steps("d/dx(x/sin(x))")
    assert steps[-1].title == "Simplificando"
    assert steps[-1].expression == "-x*cos(x)/sin(x)**2 + 1/sin(x)"


# --- Contrato geral -----------------------------------------------------------


def test_every_step_is_pure_text_never_latex() -> None:
    for expr in [
        "d/dx(x**2*sin(x))",
        "d/dx((x+1)*(x**2+3))",
        "d/dx(x*exp(x))",
        "d/dx((x**2+1)**3)",
        "d/dx((3*x+2)**5)",
        "d/dx(sin(x**2))",
        "d/dx(cos(3*x))",
        "d/dx(exp(x**2))",
        "d/dx((x**2+1)**3*sin(x))",
    ]:
        for step in generate_steps(expr):
            assert "\\" not in step.expression
            assert "$" not in step.expression
            assert "<" not in step.expression


def test_steps_numbered_sequentially_via_list_order() -> None:
    steps = generate_steps("d/dx(x**2*sin(x))")
    assert steps[0].title == "Função original"
    assert steps[-1].title == "Simplificando"
