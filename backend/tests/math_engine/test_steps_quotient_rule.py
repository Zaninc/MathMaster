"""Sprint V2.13 (Passo a Passo — Regra do Quociente) — cobertura de
`math_engine.steps.quotient_rule`: `(f/g)' = (f'g - fg')/g²`, sempre
verificada contra `compute_derivative` (o motor real), com reuso
automático de potência/cadeia/produto para a derivada do numerador e do
denominador. Denominador constante continua pelas regras antigas (V2.10/
V2.11); nenhuma regressão nelas."""
from __future__ import annotations

import pytest

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps


def _final_expression(text: str) -> str:
    return generate_steps(text)[-1].expression


def _titles(text: str) -> list[str]:
    return [s.title for s in generate_steps(text)]


# --- Caso 1: x/sen(x) ---------------------------------------------------------


def test_x_over_sin_x_matches_ticket_example() -> None:
    steps = generate_steps("d/dx(x/sin(x))")
    assert _titles("d/dx(x/sin(x))") == [
        "Função original",
        "Identificando um quociente",
        "Aplicando a Regra do Quociente",
        "Calculando f'",
        "Calculando g'",
        "Substituindo",
        "Simplificando",
    ]
    identify_step = next(s for s in steps if s.title == "Identificando um quociente")
    assert identify_step.expression == "f=x, g=sin(x)"
    f_step = next(s for s in steps if s.title == "Calculando f'")
    assert f_step.expression == "1"
    g_step = next(s for s in steps if s.title == "Calculando g'")
    assert g_step.expression == "cos(x)"
    substitution_step = next(s for s in steps if s.title == "Substituindo")
    assert substitution_step.expression == "(sin(x)-x*cos(x))/(sin(x)**2)"
    assert steps[-1].expression == "-x*cos(x)/sin(x)**2 + 1/sin(x)"


# --- Caso 2: (x²+1)/(x-3) -------------------------------------------------------


def test_polynomial_over_polynomial_matches_ticket_example() -> None:
    steps = generate_steps("d/dx((x**2+1)/(x-3))")
    identify_step = next(s for s in steps if s.title == "Identificando um quociente")
    assert identify_step.expression == "f=x**2 + 1, g=x - 3"
    f_step = next(s for s in steps if s.title == "Calculando f'")
    assert f_step.expression == "2*x"
    g_step = next(s for s in steps if s.title == "Calculando g'")
    assert g_step.expression == "1"
    substitution_step = next(s for s in steps if s.title == "Substituindo")
    assert substitution_step.expression == "(2*x*(x - 3)-(x**2 + 1))/((x - 3)**2)"

    from app.math_engine.dispatcher import solve_expression

    # O passo a passo nunca diverge do motor real de derivadas.
    assert solve_expression("d/dx((x**2+1)/(x-3))") == (
        "Derivada: 2*x/(x - 3) - (x**2 + 1)/(x - 3)**2"
    )


# --- Caso 3: ln(x)/x — nunca mostra "log(" (convenção log=base10/ln=natural) ---


def test_ln_over_x_matches_ticket_example() -> None:
    steps = generate_steps("d/dx(ln(x)/x)")
    identify_step = next(s for s in steps if s.title == "Identificando um quociente")
    assert identify_step.expression == "f=ln(x), g=x"
    f_step = next(s for s in steps if s.title == "Calculando f'")
    assert f_step.expression == "1/x"
    substitution_step = next(s for s in steps if s.title == "Substituindo")
    assert substitution_step.expression == "(1/x*x-ln(x))/(x**2)"
    assert steps[-1].expression == "-ln(x)/x**2 + x**(-2)"

    for step in steps:
        assert "log(" not in step.expression


# --- Caso 4: e^x/x² -------------------------------------------------------------


def test_exp_over_x_squared_matches_ticket_example() -> None:
    steps = generate_steps("d/dx(exp(x)/x**2)")
    identify_step = next(s for s in steps if s.title == "Identificando um quociente")
    assert identify_step.expression == "f=exp(x), g=x**2"
    f_step = next(s for s in steps if s.title == "Calculando f'")
    assert f_step.expression == "exp(x)"
    g_step = next(s for s in steps if s.title == "Calculando g'")
    assert g_step.expression == "2*x"
    substitution_step = next(s for s in steps if s.title == "Substituindo")
    assert substitution_step.expression == "(exp(x)*x**2-exp(x)*2*x)/(x**4)"
    assert steps[-1].expression == "exp(x)/x**2 - 2*exp(x)/x**3"


# --- Caso combinado: (x²+1)³/(x+2) — numerador usa a regra da cadeia (V2.11) ----


def test_chain_shaped_numerator_reuses_v2_11_chain_rule() -> None:
    steps = generate_steps("d/dx((x**2+1)**3/(x+2))")
    titles = [s.title for s in steps]
    assert titles == [
        "Função original",
        "Identificando um quociente",
        "Aplicando a Regra do Quociente",
        "Identificando função composta",
        "Derivando a externa",
        "Derivando a interna",
        "Aplicando a regra da cadeia",
        "Simplificando",
        "Calculando g'",
        "Substituindo",
        "Simplificando",
    ]
    chain_identify_step = next(s for s in steps if s.title == "Identificando função composta")
    assert chain_identify_step.expression == "u=x**2 + 1, y=u**3"
    substitution_step = next(s for s in steps if s.title == "Substituindo")
    assert substitution_step.expression == (
        "(6*x*(x**2 + 1)**2*(x + 2)-(x**2 + 1)**3)/((x + 2)**2)"
    )
    assert steps[-1].expression == "6*x*(x**2 + 1)**2/(x + 2) - (x**2 + 1)**3/(x + 2)**2"


def test_product_shaped_numerator_reuses_v2_11_product_rule() -> None:
    steps = generate_steps("d/dx((x+1)*(x**2+3)/(x-1))")
    titles = [s.title for s in steps]
    assert titles == [
        "Função original",
        "Identificando um quociente",
        "Aplicando a Regra do Quociente",
        "Identificando um produto",
        "Aplicando a regra do produto",
        "Derivando f",
        "Derivando g",
        "Substituindo",
        "Simplificando",
        "Calculando g'",
        "Substituindo",
        "Simplificando",
    ]
    product_identify_step = next(s for s in steps if s.title == "Identificando um produto")
    assert product_identify_step.expression == "f=x + 1, g=x**2 + 3"

    from app.math_engine.dispatcher import solve_expression

    assert solve_expression("d/dx((x+1)*(x**2+3)/(x-1))") == (
        "Derivada: 2*x*(x + 1)/(x - 1) + (x**2 + 3)/(x - 1) - (x + 1)*(x**2 + 3)/(x - 1)**2"
    )


# --- Regressão: denominador constante continua pelas regras antigas ------------


def test_constant_denominator_still_uses_power_rule_path() -> None:
    steps = generate_steps("d/dx(x**2/5)")
    titles = [s.title for s in steps]
    assert "Identificando um quociente" not in titles
    assert steps[-1].expression == "2*x/5"


def test_symbol_independent_of_derivative_variable_in_denominator_stays_power_rule() -> None:
    # "y" é independente de x — tratado como coeficiente comum, mesmo
    # espírito de denominador numérico constante.
    steps = generate_steps("d/dx(x**2/y)")
    assert "Identificando um quociente" not in [s.title for s in steps]


# --- Generalização correta: x**(-1)/1/x agora suportado pela regra do quociente --


def test_negative_one_exponent_now_supported_via_quotient_rule() -> None:
    # x**(-1) e "1/x" são a MESMA árvore SymPy (numer=1, denom=x) — a
    # detecção estrutural da regra do quociente naturalmente passa a
    # cobrir esse caso, que a V2.10 rejeitava por não ser "coeficiente*x^n
    # com expoente >= 0". Generalização correta, não um bug (mesmo
    # precedente da V2.12.2 com tan(x)/x).
    steps = generate_steps("d/dx(x**(-1))")
    assert steps[-1].title == "Simplificando"
    assert steps[-1].expression == "-1/x**2"


def test_fractional_exponent_still_rejected() -> None:
    # sqrt(x) = x**(1/2): as_numer_denom() dá denominador 1 (não é
    # quociente), continua rejeitado pela V2.10 (expoente não-inteiro).
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("d/dx(x**(1/2))")


# --- Regressão: cadeia e produto puros (sem quociente) continuam intactos ------


def test_pure_chain_rule_without_quotient_still_works() -> None:
    assert _final_expression("d/dx((x**2+1)**3)") == "6*x*(x**2 + 1)**2"


def test_pure_product_rule_without_quotient_still_works() -> None:
    assert _final_expression("d/dx(x**2*sin(x))") == "x**2*cos(x) + 2*x*sin(x)"


def test_simple_polynomial_derivative_still_works() -> None:
    assert _final_expression("d/dx(x**2+3*x)") == "2*x + 3"


# --- Achado empírico: fração aninhada é achatada pelo próprio SymPy ------------


def test_nested_fraction_is_flattened_by_sympy_before_classification() -> None:
    # `(x/sin(x))/(x+1)` — SymPy já achata automaticamente qualquer razão
    # de razões numa ÚNICA `Mul`/`Pow` antes de qualquer classificação
    # nossa (`as_numer_denom()` nunca vê "fração de fração" de verdade):
    # aqui vira numer=x, denom=(x+1)*sin(x) — um quociente comum cujo
    # denominador é, por sua vez, um produto (reaproveitando a regra do
    # produto automaticamente). Não é o "mais de um nível de fração
    # aninhada" que o ticket pede pra rejeitar — essa forma simplesmente
    # não existe na árvore real do SymPy, então nunca chega a ser um caso
    # de rejeição; é uma generalização correta, não um bug.
    steps = generate_steps("d/dx((x/sin(x))/(x+1))")
    identify_step = next(s for s in steps if s.title == "Identificando um quociente")
    assert identify_step.expression == "f=x, g=(x + 1)*sin(x)"
    assert "Identificando um produto" in [s.title for s in steps]

    from app.math_engine.calculus.derivatives import compute_derivative
    from app.math_engine.calculus.dispatcher import parse_derivative_call

    expr, symbol = parse_derivative_call("derivada(x/((x+1)*sin(x)), x)")
    assert steps[-1].expression == str(compute_derivative(expr, symbol))


# --- Contrato geral -----------------------------------------------------------


def test_every_step_is_pure_text_never_latex() -> None:
    for expr in [
        "d/dx(x/sin(x))",
        "d/dx((x**2+1)/(x-3))",
        "d/dx(ln(x)/x)",
        "d/dx(exp(x)/x**2)",
        "d/dx((x**2+1)**3/(x+2))",
        "d/dx((x+1)*(x**2+3)/(x-1))",
    ]:
        for step in generate_steps(expr):
            assert "\\" not in step.expression
            assert "$" not in step.expression
            assert "<" not in step.expression


def test_steps_numbered_sequentially_via_list_order() -> None:
    steps = generate_steps("d/dx(x/sin(x))")
    assert steps[0].title == "Função original"
    assert steps[-1].title == "Simplificando"
