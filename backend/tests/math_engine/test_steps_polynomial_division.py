"""Sprint V2.18 (Passo a Passo — Divisão Polinomial + Frações Parciais
Avançadas) — cobertura de `math_engine.steps.polynomial_division`: os 3
exemplos do ticket (divisão com resto não-nulo reaproveitando um único
fator elementar, divisão exata sem forçar frações parciais, divisão
combinada com decomposição em frações parciais de verdade — Exemplo 3),
o roteamento automático do dispatcher (divisão polinomial DEPOIS de
substituição/partes e ANTES de frações parciais/potências trigonométricas
— mutuamente exclusiva com `find_partial_fractions` por construção, já
que toda fração imprópria falha o teste de propriedade), a verificação
simbólica obrigatória P(x)=D(x)*Q(x)+R(x), a exclusão de formas fora de
escopo (fator irredutível grau >= 3, múltiplos fatores quadráticos,
numerador/denominador não-polinomial) sempre com rejeição amigável
(nunca erro interno), e a ausência de regressão nas integrais
básicas/substituição/partes/frações parciais/potências trigonométricas
das V2.10.1–V2.17. A extensão de `partial_fractions.py` para um único
fator quadrático irredutível (Parte B do ticket, golden example 2) é
coberta em `test_steps_partial_fractions.py`."""
from __future__ import annotations

import pytest
from sympy import Symbol, simplify, sympify

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps

_x = Symbol("x")


def _final_expression(text: str) -> str:
    return generate_steps(text)[-1].expression


def _titles(text: str) -> list[str]:
    return [s.title for s in generate_steps(text)]


def _assert_division_identity(numer_text: str, denom_text: str, identity_text: str) -> None:
    """Requisito obrigatório do ticket: `simplify(numer - (denom*quociente
    +resto)) == 0` — nunca confiar apenas na leitura visual do passo."""
    lhs_text, rhs_text = identity_text.split("=", 1)
    numer = sympify(numer_text)
    lhs = sympify(lhs_text)
    rhs = sympify(rhs_text)
    assert simplify(numer - lhs) == 0
    assert simplify(lhs - rhs) == 0


# --- Exemplo 1 do ticket: resto não-nulo, denominador com um único fator ---------


def test_example_1_non_zero_remainder_single_factor() -> None:
    steps = generate_steps("integral((x**2+1)/(x+1), x)")
    assert [s.title for s in steps] == [
        "Integral original",
        "Identificando uma fração imprópria",
        "Dividindo os polinômios",
        "Verificando a divisão",
        "Reescrevendo a integral",
        "Separando a integral",
        "Integrando",
        "Adicionando a constante de integração",
    ]
    assert len(steps) == 8
    assert steps[2].expression == "Q=x - 1, R=2"
    assert steps[3].expression == "x**2 + 1=(x + 1)*(x - 1)+2"
    _assert_division_identity("x**2+1", "x+1", steps[3].expression)
    assert steps[4].expression == "(x**2 + 1)/(x + 1)=x - 1+2/(x + 1)"
    assert steps[5].expression == "integral(x - 1, x)+integral(2/(x + 1), x)"
    assert steps[-1].expression == "x**2/2 - x + 2*ln(x + 1) + C"
    # Nenhum passo de frações parciais aparece — um único fator não
    # precisa de ansatz (mesmo raciocínio já usado pela V2.16 para
    # `1/(x+1)²` sozinho).
    assert "Fatorando o denominador" not in _titles("integral((x**2+1)/(x+1), x)")


# --- Exemplo 2 do ticket: divisão exata, NUNCA força frações parciais ------------


def test_example_2_exact_division_never_forces_partial_fractions() -> None:
    steps = generate_steps("integral((x**3+1)/(x+1), x)")
    titles = [s.title for s in steps]
    assert titles == [
        "Integral original",
        "Identificando uma fração imprópria",
        "Dividindo os polinômios",
        "Verificando a divisão",
        "Reescrevendo a integral",
        "Integrando",
        "Adicionando a constante de integração",
    ]
    assert "Separando a integral" not in titles
    assert "Fatorando o denominador" not in titles
    assert steps[2].expression == "Q=x**2 - x + 1, R=0"
    assert steps[3].expression == "x**3 + 1=(x + 1)*(x**2 - x + 1)"
    assert steps[4].expression == "(x**3 + 1)/(x + 1)=x**2 - x + 1"
    assert steps[-1].expression == "x**3/3 - x**2/2 + x + C"


# --- Exemplo 3 do ticket: divisão + frações parciais, fluxo coerente ------------


def test_example_3_combined_division_and_partial_fractions() -> None:
    steps = generate_steps("integral((x**3+2*x**2+1)/(x**2-1), x)")
    titles = [s.title for s in steps]
    assert titles == [
        "Integral original",
        "Identificando uma fração imprópria",
        "Dividindo os polinômios",
        "Verificando a divisão",
        "Reescrevendo a integral",
        "Fatorando o denominador",
        "Montando as frações parciais",
        "Eliminando os denominadores",
        "Determinando os coeficientes",
        "Substituindo",
        "Separando a integral",
        "Integrando",
        "Adicionando a constante de integração",
    ]
    assert steps[2].expression == "Q=x + 2, R=x + 3"
    assert steps[3].expression == "x**3 + 2*x**2 + 1=(x**2 - 1)*(x + 2)+x + 3"
    _assert_division_identity("x**3+2*x**2+1", "x**2-1", steps[3].expression)
    assert steps[4].expression == "(x**3 + 2*x**2 + 1)/(x**2 - 1)=x + 2+(x + 3)/(x**2 - 1)"
    assert steps[6].expression == "(x + 3)/(x**2 - 1)=A/(x - 1) + B/(x + 1)"
    assert steps[8].expression == "A=2, B=-1"
    assert steps[10].expression == "integral(x + 2, x)+integral(2/(x - 1), x)-integral(1/(x + 1), x)"
    assert steps[-1].expression == "x**2/2 + 2*x + 2*ln(x - 1) - ln(x + 1) + C"
    # Reaproveita o MESMO texto/estrutura de `partial_fractions.py` —
    # nunca uma segunda implementação de "Fatorando"/"Montando"/etc.
    assert steps[5].expression == "x**2 - 1"


# --- O valor final sempre bate com o motor real de /solve -------------------------


@pytest.mark.parametrize(
    "expr",
    [
        "integral((x**2+1)/(x+1), x)",
        "integral((x**3+1)/(x+1), x)",
        "integral((x**3+2*x**2+1)/(x**2-1), x)",
        "integral((2*x**2+3*x+1)/(x+2), x)",
    ],
)
def test_final_step_matches_solve_result(expr: str) -> None:
    from app.math_engine.dispatcher import solve_expression

    final = _final_expression(expr)
    solved = solve_expression(expr)
    assert solved == f"Integral: {final}"


# --- Regressão: básicas/substituição/partes/frações parciais/trig intocadas ------


def test_bare_power_still_uses_basic_module() -> None:
    assert "Identificando uma fração imprópria" not in _titles("integral(x**2, x)")


def test_substitution_case_never_stolen_by_polynomial_division() -> None:
    titles = _titles("integral(2*x*(x**2+1)**3, x)")
    assert "Identificando uma substituição" in titles
    assert "Identificando uma fração imprópria" not in titles


def test_integration_by_parts_case_never_stolen_by_polynomial_division() -> None:
    titles = _titles("integral(x*exp(x), x)")
    assert "Identificando integração por partes" in titles
    assert "Identificando uma fração imprópria" not in titles


def test_proper_partial_fraction_case_never_stolen_by_polynomial_division() -> None:
    # Fração PRÓPRIA (grau numerador < grau denominador) — nunca deveria
    # ser reivindicada por `find_polynomial_division` (que exige
    # impropriedade); continua pertencendo a `partial_fractions.py`.
    titles = _titles("integral(1/((x+1)*(x+2)), x)")
    assert "Identificando uma função racional" in titles
    assert "Identificando uma fração imprópria" not in titles


def test_trig_power_case_never_stolen_by_polynomial_division() -> None:
    titles = _titles("integral(sin(x)**2, x)")
    assert "Identificando uma potência trigonométrica" in titles
    assert "Identificando uma fração imprópria" not in titles


def test_definite_integral_still_works_and_never_uses_polynomial_division_module() -> None:
    steps = generate_steps("integral(x**2, x, 0, 2)")
    assert "Identificando uma fração imprópria" not in [s.title for s in steps]
    assert steps[-1].expression == "8/3"


# --- Fator único repetido (mesmo quadrático) usa o fallback atômico -------------
# do Exemplo 1 — nunca tenta um ansatz de 2 termos pra um único fator, mas
# também nunca recusa: o motor real ainda integra a fração inteira de uma
# vez (mesmo raciocínio já usado pela V2.16 para `1/(x+1)²` sozinho).


def test_single_repeated_quadratic_factor_uses_atomic_fallback_not_rejection() -> None:
    from app.math_engine.dispatcher import solve_expression

    expr = "integral((x**5+1)/(x**2+1)**2, x)"
    steps = generate_steps(expr)
    assert "Fatorando o denominador" not in [s.title for s in steps]
    assert solve_expression(expr) == f"Integral: {steps[-1].expression}"


# --- Fora de escopo: sempre rejeição amigável, nunca erro interno ---------------


@pytest.mark.parametrize(
    "expr",
    [
        "integral(1/((x**2+1)*(x**2+4)), x)",  # múltiplas quadráticas diferentes
        "integral((x**5+1)/((x+1)*(x**2+1)**2), x)",  # quadrática repetida (com outro fator)
        "integral((x**4+1)/((x+1)*(x**3+2)), x)",  # fator irredutível grau >= 3
    ],
)
def test_out_of_scope_shapes_rejected_with_friendly_message(expr: str) -> None:
    with pytest.raises(ExpressionError, match="ainda não foi implementado"):
        generate_steps(expr)


@pytest.mark.parametrize(
    "expr",
    [
        "integral(exp(x)/(x+1), x)",
        "integral(sin(x)/(x+1), x)",
        "integral(ln(x)/(x+1), x)",
        "integral(x/sin(x), x)",
    ],
)
def test_non_polynomial_numerator_or_denominator_never_claimed(expr: str) -> None:
    # Nenhuma dessas é uma fração POLINOMIAL genuína (`.is_polynomial`
    # falha para a parte transcendental) — nunca deve ser tratada como
    # divisão polinomial, mesmo sendo tecnicamente "imprópria" em algum
    # sentido informal.
    titles = _titles(expr) if _is_supported(expr) else None
    if titles is not None:
        assert "Identificando uma fração imprópria" not in titles


def _is_supported(expr: str) -> bool:
    try:
        generate_steps(expr)
        return True
    except ExpressionError:
        return False


# --- Reducível não deve ser tratada como quadrática irredutível ------------------


def test_reducible_quadratic_alone_uses_linear_decomposition_not_division() -> None:
    # x²-1 é PRÓPRIA (grau numerador 0 < grau denominador 2) — nunca passa
    # por `polynomial_division.py`; e fatora em 2 lineares reais, então
    # `partial_fractions.py` nunca tenta um ansatz quadrático pra ela.
    titles = _titles("integral(1/(x**2-1), x)")
    assert "Identificando uma fração imprópria" not in titles
    assert "Reconhecendo fator quadrático irredutível" not in titles
    assert "A/(x - 1) + B/(x + 1)" in generate_steps("integral(1/(x**2-1), x)")[3].expression


# --- Testes de erro: entradas inválidas nunca retornam erro interno --------------


def test_empty_expression_returns_friendly_error() -> None:
    with pytest.raises(ExpressionError):
        generate_steps("")


def test_invalid_integral_call_returns_friendly_error() -> None:
    with pytest.raises(ExpressionError):
        generate_steps("integral(, x)")
