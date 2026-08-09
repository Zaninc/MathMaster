"""Sprint V2.19 (Passo a Passo — Substituição Trigonométrica) — cobertura
de `math_engine.steps.trig_substitution`: os 7 casos obrigatórios do
ticket (√(9-x²), 1/√(9-x²), 1/√(x²+4), 1/√(x²-9), √(25-x²) — prova de
não-hardcode —, 1/√(x²+9), 1/√(x²-16)), o roteamento automático do
dispatcher (substituição trigonométrica DEPOIS de todas as técnicas
anteriores e ANTES do fallback amigável, sem roubar `x/√(x²+4)`/
`x·√(x²+4)`, que continuam pertencendo à V2.14), a verificação simbólica
obrigatória de cada transformação (incl. o tratamento de domínio/sinal de
√(cos²θ)/√(sec²θ)/√(tan²θ) via `refine`+`Q.positive`) e da "volta para x"
(derivada do resultado comparada ao integrando original), a ausência de
regressão nas integrais básicas/substituição/partes/frações parciais/
trigonométricas/divisão polinomial das V2.10.1–V2.18, e a exclusão
estrutural das formas fora de escopo (√(x²+a²)/√(x²-a²) sem "1/", que
levariam a ∫sec³(θ)dθ; a² sem raiz exata)."""
from __future__ import annotations

import pytest
from sympy import Symbol, diff, simplify, sympify

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps

_x = Symbol("x")


def _final_expression(text: str) -> str:
    return generate_steps(text)[-1].expression


def _titles(text: str) -> list[str]:
    return [s.title for s in generate_steps(text)]


def _assert_derivative_matches_integrand(final_expression: str, integrand_text: str) -> None:
    """Requisito obrigatório do ticket: `simplify(diff(F, x) - integrand)
    == 0` — nunca confiar apenas na leitura visual do resultado."""
    primitive = sympify(final_expression.replace("+ C", "").replace("+C", ""))
    integrand = sympify(integrand_text)
    assert simplify(diff(primitive, _x) - integrand) == 0


# --- Caso 1: √(9-x²) — forma direta, reaproveita a identidade da V2.17 -----------


def test_case_1_sqrt_a_squared_minus_x_squared_direct() -> None:
    steps = generate_steps("integral(sqrt(9-x**2), x)")
    titles = [s.title for s in steps]
    assert titles == [
        "Integral original",
        "Identificando o padrão",
        "Encontrando a",
        "Escolhendo a substituição",
        "Calculando dx",
        "Substituindo no radical",
        "Fatorando",
        "Usando a identidade pitagórica",
        "Considerando o intervalo escolhido",
        "Concluindo a substituição do radical",
        "Substituindo na integral",
        "Aplicando a identidade de redução de potência",
        "Integrando em θ",
        "Voltando para x",
        "Adicionando a constante de integração",
    ]
    assert steps[2].expression == "a**2=9, a=3"
    assert steps[3].expression == "x=3*sin(theta)"
    assert steps[4].expression == "dx=3*cos(theta)*dtheta"
    assert steps[9].expression == "sqrt(9 - x**2)=3*cos(theta)"
    assert steps[11].expression == "cos(theta)**2=(1+cos(2*theta))/2"
    assert steps[-1].expression == "x*sqrt(9 - x**2)/2 + 9*asin(x/3)/2 + C"
    _assert_derivative_matches_integrand(steps[-1].expression, "sqrt(9-x**2)")


# --- Caso 2: 1/√(9-x²) — teste ouro, simplificação elegante até θ+C -------------


def test_case_2_inverse_a_squared_minus_x_squared() -> None:
    steps = generate_steps("integral(1/sqrt(9-x**2), x)")
    titles = [s.title for s in steps]
    assert "Aplicando a identidade de redução de potência" not in titles
    assert steps[10].expression == "integral(1/sqrt(9 - x**2), x)=integral(1, theta)"
    assert steps[11].expression == "theta"
    assert steps[12].expression == "asin(x/3)"
    assert steps[-1].expression == "asin(x/3) + C"
    _assert_derivative_matches_integrand(steps[-1].expression, "1/sqrt(9-x**2)")


# --- Caso 3: 1/√(x²+4) — substituição x=a·tan(θ), reusa compute_indefinite_integral


def test_case_3_inverse_x_squared_plus_a_squared() -> None:
    steps = generate_steps("integral(1/sqrt(x**2+4), x)")
    assert steps[3].expression == "x=2*tan(theta)"
    assert steps[4].expression == "dx=2*sec(theta)**2*dtheta"
    assert steps[9].expression == "sqrt(x**2 + 4)=2*sec(theta)"
    assert steps[10].expression == "integral(1/sqrt(x**2 + 4), x)=integral(sec(theta), theta)"
    assert steps[-1].expression == "asinh(x/2) + C"
    _assert_derivative_matches_integrand(steps[-1].expression, "1/sqrt(x**2+4)")


# --- Caso 4: 1/√(x²-9) — substituição x=a·sec(θ), usa acos (nunca asec) ---------


def test_case_4_inverse_x_squared_minus_a_squared() -> None:
    steps = generate_steps("integral(1/sqrt(x**2-9), x)")
    assert steps[3].expression == "x=3*sec(theta)"
    assert steps[9].expression == "sqrt(x**2 - 9)=3*tan(theta)"
    assert steps[10].expression == "integral(1/sqrt(x**2 - 9), x)=integral(sec(theta), theta)"
    assert steps[-1].expression == "ln(x + sqrt(x**2 - 9)) + C"
    assert "asec" not in steps[-2].expression
    _assert_derivative_matches_integrand(steps[-1].expression, "1/sqrt(x**2-9)")


# --- Caso 5: √(25-x²) — prova de que a=3 NÃO está hardcoded ---------------------


def test_case_5_no_hardcode_a_equals_5() -> None:
    steps = generate_steps("integral(sqrt(25-x**2), x)")
    assert steps[2].expression == "a**2=25, a=5"
    assert steps[3].expression == "x=5*sin(theta)"
    assert steps[-1].expression == "x*sqrt(25 - x**2)/2 + 25*asin(x/5)/2 + C"
    _assert_derivative_matches_integrand(steps[-1].expression, "sqrt(25-x**2)")


# --- Caso 6: 1/√(x²+9) — prova de não-hardcode do padrão B ----------------------


def test_case_6_no_hardcode_pattern_b() -> None:
    steps = generate_steps("integral(1/sqrt(x**2+9), x)")
    assert steps[2].expression == "a**2=9, a=3"
    assert steps[3].expression == "x=3*tan(theta)"
    assert steps[-1].expression == "asinh(x/3) + C"
    _assert_derivative_matches_integrand(steps[-1].expression, "1/sqrt(x**2+9)")


# --- Caso 7: 1/√(x²-16) — prova de não-hardcode do padrão C ---------------------


def test_case_7_no_hardcode_pattern_c() -> None:
    steps = generate_steps("integral(1/sqrt(x**2-16), x)")
    assert steps[2].expression == "a**2=16, a=4"
    assert steps[3].expression == "x=4*sec(theta)"
    assert steps[-1].expression == "ln(x + sqrt(x**2 - 16)) + C"
    _assert_derivative_matches_integrand(steps[-1].expression, "1/sqrt(x**2-16)")


# --- O valor final sempre bate com o motor real de /solve -------------------------


@pytest.mark.parametrize(
    "expr",
    [
        "integral(sqrt(9-x**2), x)",
        "integral(1/sqrt(9-x**2), x)",
        "integral(sqrt(25-x**2), x)",
        "integral(1/sqrt(x**2+4), x)",
        "integral(1/sqrt(x**2+9), x)",
        "integral(1/sqrt(x**2-9), x)",
        "integral(1/sqrt(x**2-16), x)",
    ],
)
def test_final_step_matches_solve_result(expr: str) -> None:
    from app.math_engine.dispatcher import solve_expression

    final = _final_expression(expr)
    solved = solve_expression(expr)
    assert solved == f"Integral: {final}"


# --- Regressão: básicas/substituição/partes/frações/trig/divisão intocadas ------


def test_bare_power_still_uses_basic_module() -> None:
    assert "Identificando o padrão" not in _titles("integral(x**2, x)")


def test_substitution_case_never_stolen_by_trig_substitution() -> None:
    titles = _titles("integral(2*x*(x**2+1)**3, x)")
    assert "Identificando uma substituição" in titles


def test_integration_by_parts_case_never_stolen_by_trig_substitution() -> None:
    titles = _titles("integral(x*exp(x), x)")
    assert "Identificando integração por partes" in titles


def test_partial_fractions_case_never_stolen_by_trig_substitution() -> None:
    titles = _titles("integral(1/((x+1)*(x+2)), x)")
    assert "Identificando uma função racional" in titles


def test_polynomial_division_case_never_stolen_by_trig_substitution() -> None:
    titles = _titles("integral((x**2+1)/(x+1), x)")
    assert "Identificando uma fração imprópria" in titles


def test_trig_power_case_never_stolen_by_trig_substitution() -> None:
    titles = _titles("integral(sin(x)**2, x)")
    assert "Identificando uma potência trigonométrica" in titles


def test_definite_integral_still_works_and_never_uses_trig_substitution_module() -> None:
    steps = generate_steps("integral(x**2, x, 0, 2)")
    assert "Identificando o padrão" not in [s.title for s in steps]
    assert steps[-1].expression == "8/3"


# --- Prioridade: √(x²+a²) multiplicado por outro fator NUNCA é reivindicado -----
# por esta sprint (é `Mul` no topo, nunca `Pow` — ver docstring do módulo).
# Achado real (documentado no relatório, fora de escopo corrigir aqui):
# `u_substitution.find_substitution` também não reivindica estes dois casos
# hoje — `_outer_shape` só aceita expoente INTEIRO (`factor.exp.is_Integer`),
# nunca `Rational(1,2)`/`Rational(-1,2)` — uma lacuna PRÉ-EXISTENTE da V2.14,
# não introduzida por esta sprint (confirmado: `find_substitution` já
# devolvia `None` para os dois ANTES de `trig_substitution.py` existir).
# `/solve` resolve os dois corretamente de qualquer forma (motor real,
# nunca afetado por nenhuma das duas lacunas de step-by-step).


@pytest.mark.parametrize(
    "expr",
    [
        "integral(x/sqrt(x**2+4), x)",
        "integral(x*sqrt(x**2+4), x)",
    ],
)
def test_priority_trig_substitution_never_claims_multiplied_radical(expr: str) -> None:
    titles = _titles(expr) if _is_supported(expr) else []
    assert "Identificando o padrão" not in titles

    from app.math_engine.dispatcher import solve_expression

    assert solve_expression(expr).startswith("Integral:")


def _is_supported(expr: str) -> bool:
    try:
        generate_steps(expr)
        return True
    except ExpressionError:
        return False


# --- Fora de escopo: sempre rejeição amigável, nunca erro interno ---------------


@pytest.mark.parametrize(
    "expr",
    [
        "integral(sqrt(x**2+4), x)",  # levaria a sec³(θ), fora de escopo
        "integral(sqrt(x**2-9), x)",  # idem
        "integral(sqrt(10-x**2), x)",  # a² sem raiz exata
        "integral(1/sqrt(x**2+10), x)",  # idem
    ],
)
def test_out_of_scope_shapes_rejected_with_friendly_message(expr: str) -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps(expr)


def test_solve_endpoint_unaffected_by_out_of_scope_rejection() -> None:
    from app.math_engine.dispatcher import solve_expression

    # /solve continua resolvendo mesmo quando /solve/steps rejeita — o
    # motor real usa uma técnica interna diferente de sec³(θ), nunca trava.
    result = solve_expression("integral(sqrt(x**2+4), x)")
    assert result.startswith("Integral:")


# --- Testes de erro: entradas inválidas nunca retornam erro interno --------------


def test_empty_expression_returns_friendly_error() -> None:
    with pytest.raises(ExpressionError):
        generate_steps("")


def test_invalid_integral_call_returns_friendly_error() -> None:
    with pytest.raises(ExpressionError):
        generate_steps("integral(, x)")
