"""Sprint V2.17 (Passo a Passo — Integrais Trigonométricas) — cobertura de
`math_engine.steps.trig_integrals`: os 8 casos obrigatórios do ticket
(sen², cos², sen³, cos³, produtos mistos sen³cos²/sen²cos³, sen²cos², e
tan²), o roteamento automático do dispatcher (trig DEPOIS de substituição/
partes/frações parciais e ANTES do fallback amigável, sem roubar
integrais mais simples), a verificação simbólica obrigatória de cada
identidade/transformação, sintaxes alternativas de entrada (`sin(x)^2`,
`sin(x)**2`, `sin(x)²`), e a ausência de regressão nas integrais
básicas/definidas/substituição/partes/frações parciais das V2.10.1–V2.16."""
from __future__ import annotations

import pytest
from sympy import Symbol, cos, sec, simplify, sin, tan, trigsimp

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps

_x = Symbol("x")


def _final_expression(text: str) -> str:
    return generate_steps(text)[-1].expression


def _titles(text: str) -> list[str]:
    return [s.title for s in generate_steps(text)]


def _trig_equivalent(a, b) -> bool:
    return simplify(trigsimp(a - b)) == 0


# --- Verificação simbólica obrigatória das identidades (nunca só string) --------


def test_identity_sin_squared() -> None:
    assert _trig_equivalent(sin(_x) ** 2, (1 - cos(2 * _x)) / 2)


def test_identity_cos_squared() -> None:
    assert _trig_equivalent(cos(_x) ** 2, (1 + cos(2 * _x)) / 2)


def test_identity_sin_cubed() -> None:
    assert _trig_equivalent(sin(_x) ** 3, sin(_x) * (1 - cos(_x) ** 2))


def test_identity_cos_cubed() -> None:
    assert _trig_equivalent(cos(_x) ** 3, cos(_x) * (1 - sin(_x) ** 2))


def test_identity_sin_squared_cos_squared() -> None:
    assert _trig_equivalent(sin(_x) ** 2 * cos(_x) ** 2, (1 - cos(4 * _x)) / 8)


def test_identity_tan_squared() -> None:
    assert _trig_equivalent(tan(_x) ** 2, sec(_x) ** 2 - 1)


# --- Caso 1: sin²(x) ---------------------------------------------------------------


def test_case_1_sin_squared() -> None:
    steps = generate_steps("integral(sin(x)**2, x)")
    assert [s.title for s in steps] == [
        "Integral original",
        "Identificando uma potência trigonométrica",
        "Aplicando a identidade de redução de potência",
        "Substituindo na integral",
        "Fatorando a constante",
        "Integrando",
        "Adicionando a constante de integração",
    ]
    assert steps[2].expression == "sin(x)**2=(1-cos(2*x))/2"
    assert steps[5].expression == "x/2 - sin(2*x)/4"
    assert steps[-1].expression == "x/2 - sin(x)*cos(x)/2 + C"


# --- Caso 2: cos²(x) ---------------------------------------------------------------


def test_case_2_cos_squared() -> None:
    steps = generate_steps("integral(cos(x)**2, x)")
    assert steps[2].expression == "cos(x)**2=(1+cos(2*x))/2"
    assert steps[5].expression == "x/2 + sin(2*x)/4"
    assert steps[-1].expression == "x/2 + sin(x)*cos(x)/2 + C"


# --- Caso 3: sin³(x) — separação + identidade pitagórica + substituição ----------


def test_case_3_sin_cubed() -> None:
    steps = generate_steps("integral(sin(x)**3, x)")
    assert [s.title for s in steps] == [
        "Integral original",
        "Identificando uma potência ímpar de sin",
        "Separando um fator sin(x)",
        "Aplicando sin²(x)=1-cos²(x)",
        "Reescrevendo a integral",
        "Aplicando a substituição",
        "Integrando",
        "Voltando para x",
        "Adicionando a constante de integração",
    ]
    assert steps[2].expression == "sin(x)**3=sin(x)*sin(x)**2"
    assert steps[5].expression == "u=cos(x), du=-sin(x)*dx"
    assert steps[-1].expression == "cos(x)**3/3 - cos(x) + C"


# --- Caso 4: cos³(x) ----------------------------------------------------------------


def test_case_4_cos_cubed() -> None:
    steps = generate_steps("integral(cos(x)**3, x)")
    assert steps[5].expression == "u=sin(x), du=cos(x)*dx"
    assert steps[-1].expression == "-sin(x)**3/3 + sin(x) + C"


# --- Caso 5: sin³(x)cos²(x) — preserva um fator sin(x) ----------------------------


def test_case_5_sin_cubed_cos_squared_preserves_sin() -> None:
    steps = generate_steps("integral(sin(x)**3*cos(x)**2, x)")
    assert steps[1].title == "Identificando produto com potência ímpar de sin"
    assert steps[1].explanation is not None
    assert "u=cos(x)" in steps[1].explanation
    assert steps[2].expression == "sin(x)**3*cos(x)**2=sin(x)*sin(x)**2*cos(x)**2"
    assert steps[-1].expression == "cos(x)**5/5 - cos(x)**3/3 + C"


# --- Caso 6: sin²(x)cos³(x) — preserva um fator cos(x) ----------------------------


def test_case_6_sin_squared_cos_cubed_preserves_cos() -> None:
    steps = generate_steps("integral(sin(x)**2*cos(x)**3, x)")
    assert steps[1].title == "Identificando produto com potência ímpar de cos"
    assert "u=sin(x)" in (steps[1].explanation or "")
    assert steps[-1].expression == "-sin(x)**5/5 + sin(x)**3/3 + C"


# --- Caso 7: sin²(x)cos²(x) — teste ouro, ângulo duplo + redução de potência -----


def test_case_7_sin_squared_cos_squared_golden_test() -> None:
    steps = generate_steps("integral(sin(x)**2*cos(x)**2, x)")
    assert [s.title for s in steps] == [
        "Integral original",
        "Identificando potências pares de seno e cosseno",
        "Utilizando a identidade de ângulo duplo",
        "Elevando ao quadrado",
        "Aplicando redução de potência",
        "Reescrevendo",
        "Substituindo na integral",
        "Integrando",
        "Adicionando a constante de integração",
    ]
    assert steps[2].expression == "sin(x)*cos(x)=sin(2*x)/2"
    assert steps[3].expression == "sin(x)**2*cos(x)**2=sin(2*x)**2/4"
    assert steps[4].expression == "sin(2*x)**2=(1-cos(4*x))/2"
    assert steps[5].expression == "sin(x)**2*cos(x)**2=(1-cos(4*x))/8"
    assert steps[7].expression == "x/8 - sin(4*x)/32"
    assert steps[-1].expression == "x/8 - sin(2*x)*cos(2*x)/16 + C"


# --- Caso 8: tan²(x) -----------------------------------------------------------------


def test_case_8_tan_squared() -> None:
    steps = generate_steps("integral(tan(x)**2, x)")
    assert [s.title for s in steps] == [
        "Integral original",
        "Identificando uma potência de tangente",
        "Aplicando tan²(x)=sec²(x)-1",
        "Substituindo na integral",
        "Separando a integral",
        "Integrando",
        "Adicionando a constante de integração",
    ]
    assert steps[2].expression == "tan(x)**2=sec(x)**2-1"
    assert steps[4].expression == "integral(sec(x)**2, x)-integral(1, x)"
    assert steps[-1].expression == "-x + sin(x)/cos(x) + C"


# --- O valor final sempre bate com o motor real de /solve -------------------------


@pytest.mark.parametrize(
    "expr",
    [
        "integral(sin(x)**2, x)",
        "integral(cos(x)**2, x)",
        "integral(sin(x)**3, x)",
        "integral(cos(x)**3, x)",
        "integral(sin(x)**3*cos(x)**2, x)",
        "integral(sin(x)**2*cos(x)**3, x)",
        "integral(sin(x)**2*cos(x)**2, x)",
        "integral(tan(x)**2, x)",
    ],
)
def test_final_step_matches_solve_result(expr: str) -> None:
    from app.math_engine.dispatcher import solve_expression

    final = _final_expression(expr)
    solved = solve_expression(expr)
    assert solved == f"Integral: {final}"


# --- Sintaxes alternativas de entrada (já oficialmente aceitas) -------------------


def test_sin_squared_alternative_syntaxes_are_equivalent() -> None:
    forms = ["integral(sin(x)**2, x)", "integral(sin(x)^2, x)", "integral(sin(x)², x)"]
    results = [generate_steps(f) for f in forms]
    reference = [(s.title, s.expression) for s in results[0]]
    for steps in results[1:]:
        assert [(s.title, s.expression) for s in steps] == reference


def test_cos_squared_alternative_syntaxes_are_equivalent() -> None:
    forms = ["integral(cos(x)**2, x)", "integral(cos(x)^2, x)", "integral(cos(x)², x)"]
    results = [generate_steps(f) for f in forms]
    reference = [(s.title, s.expression) for s in results[0]]
    for steps in results[1:]:
        assert [(s.title, s.expression) for s in steps] == reference


# --- Regressão: integrais básicas/substituição/partes/frações parciais intocadas -


def test_bare_power_still_uses_basic_module() -> None:
    assert "Identificando uma potência trigonométrica" not in _titles("integral(x**2, x)")


def test_substitution_case_never_stolen_by_trig_integrals() -> None:
    titles = _titles("integral(2*x*(x**2+1)**3, x)")
    assert "Identificando uma substituição" in titles


def test_substitution_of_trig_argument_never_stolen_by_trig_integrals() -> None:
    titles = _titles("integral(2*x*sin(x**2), x)")
    assert "Identificando uma substituição" in titles
    assert "Identificando uma potência trigonométrica" not in titles


def test_integration_by_parts_case_never_stolen_by_trig_integrals() -> None:
    titles = _titles("integral(x*sin(x), x)")
    assert "Identificando integração por partes" in titles


def test_partial_fractions_case_never_stolen_by_trig_integrals() -> None:
    titles = _titles("integral(1/((x+1)*(x+2)), x)")
    assert "Identificando uma função racional" in titles


def test_bare_sin_still_rejected_unchanged() -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("integral(sin(x), x)")


def test_bare_cos_still_rejected_unchanged() -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps("integral(cos(x), x)")


def test_definite_integral_still_works_and_never_uses_trig_module() -> None:
    steps = generate_steps("integral(x**2, x, 0, 2)")
    assert "Identificando uma potência trigonométrica" not in [s.title for s in steps]
    assert steps[-1].expression == "8/3"


# --- Fora de escopo: rejeição amigável, nunca erro interno -----------------------


@pytest.mark.parametrize(
    "expr",
    [
        "integral(tan(x)**3, x)",
        "integral(sin(3*x)*cos(7*x), x)",
        "integral(sin(x)**8*cos(x)**6, x)",
        "integral(sin(x)**3*cos(x)**3, x)",
    ],
)
def test_out_of_scope_shapes_rejected_with_friendly_message(expr: str) -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps(expr)


@pytest.mark.parametrize(
    "expr",
    [
        "integral(sec(x)**3, x)",
        "integral(sec(x)*tan(x), x)",
    ],
)
def test_sec_based_shapes_never_return_internal_error(expr: str) -> None:
    # "sec" nem está na whitelist de entrada do parser (`safe_parsing.py`)
    # — cai numa rejeição amigável de PARSING (mensagem diferente da
    # rejeição "fora de escopo" desta sprint), nunca um erro interno/500.
    with pytest.raises(ExpressionError):
        generate_steps(expr)


# --- Testes de erro: entradas inválidas nunca retornam erro interno --------------


def test_empty_expression_returns_friendly_error() -> None:
    with pytest.raises(ExpressionError):
        generate_steps("")


def test_invalid_integral_call_returns_friendly_error() -> None:
    with pytest.raises(ExpressionError):
        generate_steps("integral(, x)")
