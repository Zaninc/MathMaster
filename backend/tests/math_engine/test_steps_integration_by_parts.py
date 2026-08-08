"""Sprint V2.15 (Passo a Passo — Integração por Partes) — cobertura de
`math_engine.steps.integration_by_parts`: os 5 casos obrigatórios do
ticket (polinômio×exponencial, polinômio×seno, polinômio×cosseno,
logaritmo sozinho, polinômio×logaritmo), o roteamento automático do
dispatcher (por partes DEPOIS da substituição da V2.14 e ANTES do
fallback amigável, sem roubar integrais mais simples), a rejeição
amigável dedicada para casos que exigiriam aplicações sucessivas, e a
ausência de regressão nas integrais básicas/definidas/substituição das
V2.10.1/V2.10.2/V2.14."""
from __future__ import annotations

import pytest

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps


def _final_expression(text: str) -> str:
    return generate_steps(text)[-1].expression


def _titles(text: str) -> list[str]:
    return [s.title for s in generate_steps(text)]


_EXPECTED_TITLES = [
    "Integral original",
    "Identificando integração por partes",
    "Derivando u",
    "Integrando dv",
    "Aplicando a fórmula",
    "Substituindo",
    "Calculando a integral restante",
    "Adicionando a constante de integração",
]


# --- Caso 1: polinômio × exponencial -------------------------------------------


def test_case_1_polynomial_times_exponential() -> None:
    steps = generate_steps("integral(x*exp(x), x)")
    assert [s.title for s in steps] == _EXPECTED_TITLES
    assert steps[1].expression == "u=x, dv=exp(x)*dx"
    assert steps[2].expression == "du=dx"
    assert steps[3].expression == "v=exp(x)"
    assert steps[4].expression == "integral(u, v)=u*v-integral(v, u)"
    assert steps[5].expression == "integral(x*exp(x), x)=x*exp(x)-integral(exp(x), x)"
    assert steps[6].expression == "x*exp(x) - exp(x)"
    assert steps[-1].expression == "(x - 1)*exp(x) + C"


# --- Caso 2: polinômio × seno ----------------------------------------------------


def test_case_2_polynomial_times_sine() -> None:
    steps = generate_steps("integral(x*sin(x), x)")
    assert [s.title for s in steps] == _EXPECTED_TITLES
    assert steps[1].expression == "u=x, dv=sin(x)*dx"
    assert steps[2].expression == "du=dx"
    assert steps[3].expression == "v=-cos(x)"
    assert steps[-1].expression == "-x*cos(x) + sin(x) + C"


# --- Caso 3: polinômio × cosseno --------------------------------------------------


def test_case_3_polynomial_times_cosine() -> None:
    steps = generate_steps("integral(x*cos(x), x)")
    assert [s.title for s in steps] == _EXPECTED_TITLES
    assert steps[1].expression == "u=x, dv=cos(x)*dx"
    assert steps[2].expression == "du=dx"
    assert steps[3].expression == "v=sin(x)"
    assert steps[-1].expression == "x*sin(x) + cos(x) + C"


# --- Caso 4: logaritmo sozinho (implicitamente 1*ln(x)) --------------------------


def test_case_4_bare_logarithm() -> None:
    steps = generate_steps("integral(ln(x), x)")
    assert [s.title for s in steps] == _EXPECTED_TITLES
    assert steps[1].expression == "u=ln(x), dv=dx"
    assert steps[2].expression == "du=1/x*dx"
    assert steps[3].expression == "v=x"
    assert steps[-1].expression == "x*ln(x) - x + C"
    for step in steps:
        assert "log(" not in step.expression


# --- Caso 5: polinômio × logaritmo ------------------------------------------------


def test_case_5_polynomial_times_logarithm() -> None:
    steps = generate_steps("integral(x*ln(x), x)")
    assert [s.title for s in steps] == _EXPECTED_TITLES
    assert steps[1].expression == "u=ln(x), dv=x*dx"
    assert steps[2].expression == "du=1/x*dx"
    assert steps[3].expression == "v=x**2/2"
    assert steps[-1].expression == "x**2*ln(x)/2 - x**2/4 + C"


# --- Hotfix V2.15.1: paridade de Euler (e^x / e**x == exp(x)) --------------------
#
# `x*e^x`/`x*e**x` digitados à mão viravam `Pow(Symbol('e'), x)` — árvore
# estruturalmente diferente de `exp(x)` para `_classify_factor`, então
# caíam no fallback amigável mesmo com `x*exp(x)` funcionando. Corrigido
# em `calculus/dispatcher.py:parse_integral_call` (canonicaliza "e" antes
# de qualquer detector rodar) — não em `integration_by_parts.py`.


@pytest.mark.parametrize("expr", ["integral(x*e^x, x)", "integral(x*e**x, x)"])
def test_bare_e_power_uses_integration_by_parts_same_as_exp(expr: str) -> None:
    steps = generate_steps(expr)
    reference = generate_steps("integral(x*exp(x), x)")
    assert [(s.title, s.expression) for s in steps] == [
        (s.title, s.expression) for s in reference
    ]
    assert steps[-1].expression == "(x - 1)*exp(x) + C"


def test_find_integration_by_parts_does_not_return_none_for_bare_e_power() -> None:
    from app.math_engine.calculus.dispatcher import parse_integral_call
    from app.math_engine.steps.integration_by_parts import find_integration_by_parts

    expr, symbol = parse_integral_call("integral(x*e^x, x)")
    assert find_integration_by_parts(expr, symbol) is not None


# --- O valor final sempre bate com o motor real de /solve -------------------------


@pytest.mark.parametrize(
    "expr",
    [
        "integral(x*exp(x), x)",
        "integral(x*sin(x), x)",
        "integral(x*cos(x), x)",
        "integral(ln(x), x)",
        "integral(x*ln(x), x)",
    ],
)
def test_final_step_matches_solve_result(expr: str) -> None:
    from app.math_engine.dispatcher import solve_expression

    final = _final_expression(expr)
    solved = solve_expression(expr)
    assert solved == f"Integral: {final}"


# --- Repetição necessária: mensagem amigável dedicada, nunca finge resolver ------


@pytest.mark.parametrize(
    "expr",
    [
        "integral(x**2*exp(x), x)",
        "integral(x**2*sin(x), x)",
        "integral(x**2*cos(x), x)",
    ],
)
def test_needs_repeated_application_returns_dedicated_friendly_message(expr: str) -> None:
    with pytest.raises(ExpressionError, match="aplicações sucessivas de integração por partes"):
        generate_steps(expr)


# --- Regressão: integrais básicas/definidas/substituição continuam intocadas ----


def test_bare_power_still_uses_basic_module() -> None:
    titles = _titles("integral(x**2, x)")
    assert "Identificando integração por partes" not in titles
    assert "Identificando uma substituição" not in titles


def test_bare_exp_still_rejected_unchanged() -> None:
    # exp(x) sozinho (sem fator algébrico emparelhado) não é uma forma de
    # integração por partes — continua caindo no módulo básico, que
    # continua rejeitando (comportamento pré-existente, intocado).
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("integral(exp(x), x)")


def test_bare_sin_still_rejected_unchanged() -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("integral(sin(x), x)")


def test_substitution_case_never_stolen_by_integration_by_parts() -> None:
    titles = _titles("integral(2*x*(x**2+1)**3, x)")
    assert "Identificando uma substituição" in titles
    assert "Identificando integração por partes" not in titles


def test_definite_integral_still_works_and_never_uses_by_parts_module() -> None:
    steps = generate_steps("integral(x**2, x, 0, 2)")
    assert "Identificando integração por partes" not in [s.title for s in steps]
    assert steps[-1].expression == "8/3"


# --- Fora de escopo: rejeição amigável, nunca erro interno -----------------------


def test_trig_times_trig_rejected_with_friendly_message() -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("integral(sin(x)*cos(x), x)")


def test_exponential_times_sine_rejected_with_friendly_message() -> None:
    # ∫eˣsen(x)dx é cíclico (nunca termina com uma única aplicação) —
    # explicitamente fora de escopo desta versão.
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("integral(exp(x)*sin(x), x)")


def test_composite_argument_never_claimed_by_integration_by_parts() -> None:
    # exp(x**2)/sen(2*x) com argumento composto já pertence à V2.14
    # (substituição) — não deve ser reivindicado por integração por partes
    # mesmo se a substituição algum dia deixasse de reivindicá-lo primeiro.
    titles = _titles("integral(2*x*exp(x**2), x)")
    assert "Identificando integração por partes" not in titles


# --- Testes de erro: entradas inválidas nunca retornam erro interno --------------


def test_empty_expression_returns_friendly_error() -> None:
    with pytest.raises(ExpressionError):
        generate_steps("")


def test_invalid_integral_call_returns_friendly_error() -> None:
    with pytest.raises(ExpressionError):
        generate_steps("integral(, x)")


def test_incomplete_product_returns_friendly_error() -> None:
    with pytest.raises(ExpressionError):
        generate_steps("integral(x*, x)")
