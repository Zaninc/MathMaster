"""Sprint V2.3 — cobre `complex/`: unidade imaginária (i/I), aritmética
(soma, subtração, multiplicação, divisão, potência), funções (conjugado/
conj, modulo/abs, argumento/arg, polar + aliases PT-BR/EN), validações
(polar de z=0), ordem da cascata (complex depois de matrix, antes de
calculus/functions/trigonometry/logarithms/equations), não-colisão com a
variável de laço "i" do somatório, e não-regressão das áreas existentes."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.formatter.pipeline import format_result
from app.formatter.renderer import render_math
from app.math_engine.calculus.dispatcher import is_calculus_domain_expression
from app.math_engine.complex.dispatcher import (
    is_complex_domain_expression,
    solve_complex_text,
)
from app.math_engine.complex.parsing import (
    contains_complex_call,
    contains_polar_call,
    extract_whole_polar_argument,
)
from app.math_engine.complex.validation import validate_nonzero_for_polar
from app.math_engine.dispatcher import solve_expression
from app.math_engine.equations.dispatcher import is_equation_domain_expression
from app.math_engine.errors import ExpressionError
from app.math_engine.functions.dispatcher import is_function_domain_expression
from app.math_engine.logarithms.dispatcher import is_logarithm_domain_expression
from app.math_engine.matrix.dispatcher import is_matrix_domain_expression
from app.math_engine.summation.dispatcher import is_summation_domain_expression
from app.math_engine.trigonometry.dispatcher import is_trigonometry_domain_expression


def _solve(expression: str) -> str:
    raw = solve_expression(expression)
    return render_math(format_result(expression, raw))


# --- Unidade imaginária / forma retangular --------------------------------


def test_bare_i_is_the_imaginary_unit() -> None:
    assert _solve("i") == "i"


def test_bare_uppercase_i_is_also_the_imaginary_unit() -> None:
    assert _solve("I") == "i"


def test_i_squared_is_minus_one() -> None:
    assert _solve("i^2") == "-1"


@pytest.mark.parametrize(
    ("expression", "expected"),
    [
        ("2+i", "2 + i"),
        ("3-4i", "3 - 4*i"),
        ("-5+2i", "-5 + 2*i"),
        ("4i", "4*i"),
        ("-4i", "-4*i"),
    ],
)
def test_rectangular_form_literals(expression: str, expected: str) -> None:
    assert _solve(expression) == expected


# --- Operações -------------------------------------------------------------


def test_complex_multiplication() -> None:
    assert _solve("(2+i)*(3-i)") == "7 + i"


def test_complex_multiplication_without_explicit_operator() -> None:
    # Multiplicação implícita entre parênteses adjacentes ("(2+i)(3-i)"),
    # mesma capacidade já usada pelo resto do motor (implicit_multiplication_
    # application) — nenhum código específico desta área precisou disso.
    assert _solve("(2+i)(3-i)") == "7 + i"


def test_complex_subtraction() -> None:
    assert _solve("(2+i)-(3-i)") == "-1 + 2*i"


def test_complex_power() -> None:
    assert _solve("(1+i)^5") == "-4 - 4*i"


def test_complex_division_rationalizes_to_standard_form() -> None:
    assert _solve("(3+4i)/(1-i)") == "-1/2 + 7*i/2"


def test_complex_division_from_sprint_examples() -> None:
    assert _solve("(5+2i)/(1-i)") == "3/2 + 7*i/2"


def test_i_times_i_is_minus_one() -> None:
    assert _solve("i*i") == "-1"


# --- Funções: conjugado ------------------------------------------------


@pytest.mark.parametrize("name", ["conjugado", "conj"])
def test_conjugate(name: str) -> None:
    assert _solve(f"{name}(3+4i)") == "3 - 4*i"


def test_conjugate_composes_with_other_operations() -> None:
    assert _solve("2*conjugado(1+i)") == "2 - 2*i"


# --- Funções: módulo ---------------------------------------------------


@pytest.mark.parametrize("name", ["modulo", "abs"])
def test_modulus(name: str) -> None:
    assert _solve(f"{name}(3+4i)") == "5"


def test_modulus_composes_with_other_operations() -> None:
    assert _solve("modulo(3+4i) + 1") == "6"


# --- Funções: argumento -------------------------------------------------


@pytest.mark.parametrize("name", ["argumento", "arg"])
def test_argument(name: str) -> None:
    assert _solve(f"{name}(1+i)") == "π/4"


def test_argument_of_negative_one_is_pi() -> None:
    assert _solve("argumento(-1)") == "π"


# --- Funções: forma polar ------------------------------------------------


def test_polar_form_is_a_symbolic_trig_expression() -> None:
    # Requisito explícito da sprint (revisão de arquitetura, Theo): NUNCA
    # uma string improvisada — sempre r*(cos(θ)+i*sin(θ)) via SymPy, e por
    # isso `compute_polar_components` devolve os dois `Expr` separados.
    assert _solve("polar(1+i)") == "√2(cos(π/4)+i·sin(π/4))"


def test_polar_form_negative_angle() -> None:
    assert _solve("polar(1-i)") == "√2(cos(-π/4)+i·sin(-π/4))"


def test_polar_form_without_a_nice_angle_stays_symbolic() -> None:
    # arg(3+4i) não tem forma fechada em frações de π — permanece
    # simbólico (atan(4/3)), nunca aproximado/arredondado.
    assert _solve("polar(3+4i)") == "5(cos(atan(4/3))+i·sin(atan(4/3)))"


def test_polar_of_zero_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="z = 0"):
        _solve("polar(0)")


def test_polar_combined_with_other_operations_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="expressão inteira"):
        _solve("2*polar(1+i)")


def test_polar_added_to_something_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="expressão inteira"):
        _solve("polar(1+i)+1")


def test_validate_nonzero_for_polar_direct() -> None:
    from sympy import Integer

    with pytest.raises(ExpressionError, match="z = 0"):
        validate_nonzero_for_polar(Integer(0))


# --- Parsing: helpers diretos ---------------------------------------------


def test_contains_complex_call_recognizes_all_aliases() -> None:
    for name in ("conjugado", "conj", "modulo", "abs", "argumento", "arg", "polar"):
        assert contains_complex_call(f"{name}(1+i)") is True


def test_contains_complex_call_is_false_without_any_known_name() -> None:
    assert contains_complex_call("2+i") is False


def test_extract_whole_polar_argument_full_match() -> None:
    assert extract_whole_polar_argument("polar(1+i)") == "1+i"


def test_extract_whole_polar_argument_tolerates_surrounding_whitespace() -> None:
    assert extract_whole_polar_argument("  polar( 1+i ) ") == " 1+i "


def test_extract_whole_polar_argument_none_when_composed() -> None:
    assert extract_whole_polar_argument("2*polar(1+i)") is None
    assert extract_whole_polar_argument("polar(1+i)+1") is None


def test_extract_whole_polar_argument_none_when_unclosed() -> None:
    assert extract_whole_polar_argument("polar(1+i") is None


def test_contains_polar_call_detects_partial_composition() -> None:
    assert contains_polar_call("2*polar(1+i)") is True
    assert contains_polar_call("modulo(1+i)") is False


# --- Convenção log/ln reaproveitada ----------------------------------------


def test_complex_expression_follows_log_base10_convention() -> None:
    # Mesma convenção de produto usada em matrix/summation/logarithms —
    # "log" dentro de uma expressão complexa é base 10, não o natural
    # nativo do SymPy.
    assert _solve("log(100) + i") == "2 + i"


# --- Não-colisão com a variável de laço "i" do somatório --------------------


def test_summation_loop_variable_i_is_unaffected() -> None:
    assert _solve("Σ(i=1..10) i") == "55"


def test_summation_body_using_i_is_unaffected() -> None:
    assert _solve("Σ(i=1..5) sin(i)^2 + cos(i)^2") == "5"


def test_summation_prefix_is_checked_before_complex_and_wins() -> None:
    expression = "Σ(i=1..3) i"
    assert is_summation_domain_expression(expression) is True
    assert is_complex_domain_expression(expression) is False


# --- "=" nunca é reivindicado por esta área (preserva comportamento já
# existente de equações/definições de função) -------------------------------


def test_expression_with_equals_sign_is_never_claimed_by_complex_domain() -> None:
    assert is_complex_domain_expression("modulo(x) = 5") is False
    assert is_complex_domain_expression("abs(x) = 5") is False
    assert is_complex_domain_expression("i = 5") is False


# --- Ordem da cascata: complex depois de matrix, antes de calculus/
# functions/trigonometry/logarithms/equations -------------------------------


def test_complex_expression_is_claimed_by_complex_domain_only() -> None:
    expression = "(2+i)*(3-i)"
    assert is_complex_domain_expression(expression) is True
    assert is_matrix_domain_expression(expression) is False
    assert is_calculus_domain_expression(expression) is False
    assert is_function_domain_expression(expression) is False
    assert is_trigonometry_domain_expression(expression) is False
    assert is_logarithm_domain_expression(expression) is False
    assert is_equation_domain_expression(expression) is False


def test_complex_function_call_anywhere_in_text_is_claimed() -> None:
    assert is_complex_domain_expression("2 * conjugado(1+i)") is True
    assert is_complex_domain_expression("modulo(3+4i)") is True


def test_i_glued_to_a_digit_is_still_recognized() -> None:
    # Regressão do desenvolvimento: `\b[iI]\b` sozinho NÃO reconhece "i"
    # colado a um dígito ("4i") porque dígito também é caractere de
    # palavra para `\b` — ver docstring de `dispatcher.py`.
    assert is_complex_domain_expression("3-4i") is True
    assert is_complex_domain_expression("4i") is True


def test_i_inside_a_longer_identifier_is_not_mistaken_for_the_imaginary_unit() -> None:
    # "i" faz parte de "circunferencia" — não pode disparar o domínio
    # complexo sozinho, nem mudar o resultado da geometria analítica.
    assert is_complex_domain_expression("circunferencia((0,0),5)") is False
    assert "circunferência" in _solve("circunferencia((0,0),5)")


def test_trigonometry_without_i_is_unaffected() -> None:
    assert is_complex_domain_expression("sin(x)") is False
    assert _solve("sin(π/6)") == "Tipo: valor notável; Resultado: 1/2"


def test_unknown_complex_function_is_rejected() -> None:
    with pytest.raises(ExpressionError):
        _solve("rank(1+i)")


# --- Não-regressão de outras áreas ------------------------------------------


def test_matrix_literal_still_resolves_through_matrix_domain() -> None:
    assert _solve("[[1,2],[3,4]]") == "[[1, 2], [3, 4]]"


def test_quadratic_equation_still_resolves_through_equations_domain() -> None:
    assert _solve("x^2 - 4 = 0") == "x₁ = -2, x₂ = 2"


def test_summation_expression_still_resolves() -> None:
    assert _solve("Σ(i=1..10) i") == "55"


# --- Contrato HTTP -----------------------------------------------------


def test_solve_endpoint_preserves_original_complex_syntax_verbatim(client: TestClient) -> None:
    response = client.post("/solve", json={"expression": "3+4i"})
    assert response.status_code == 200
    assert response.json() == {
        "expression": "3+4i",
        "result": "3 + 4*i",
        "approx": None,
    }


def test_solve_endpoint_evaluates_conjugate(client: TestClient) -> None:
    response = client.post("/solve", json={"expression": "conjugado(3+4i)"})
    assert response.status_code == 200
    assert response.json() == {
        "expression": "conjugado(3+4i)",
        "result": "3 - 4*i",
        "approx": None,
    }


def test_solve_endpoint_evaluates_polar(client: TestClient) -> None:
    response = client.post("/solve", json={"expression": "polar(1+i)"})
    assert response.status_code == 200
    assert response.json() == {
        "expression": "polar(1+i)",
        "result": "√2(cos(π/4)+i·sin(π/4))",
        "approx": None,
    }
