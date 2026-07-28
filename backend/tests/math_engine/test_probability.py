"""Sprint V2.8 — cobre `probability/`: probabilidade clássica, complementar,
união, interseção de eventos independentes, condicional, verificação de
independência, distribuição binomial (reaproveitando `combinacao()` da
Sprint V2.7), dedução simbólica em cadeia de igualdades, validações (só
números, probabilidades em [0,1], contagem de argumentos, divisão por
zero) com mensagens amigáveis, ordem da cascata e não-regressão das áreas
existentes (incluindo a whitelist de caracteres de `safe_parsing.py`, que
agora aceita "." — Sprint V2.8 é o primeiro domínio a precisar de
literais decimais)."""
from __future__ import annotations

import pytest

from app.formatter.pipeline import format_result
from app.formatter.renderer import render_math
from app.math_engine.dispatcher import solve_expression
from app.math_engine.errors import ExpressionError
from app.math_engine.probability.dispatcher import (
    is_probability_domain_expression,
    solve_probability_text,
)


def _solve(expression: str) -> str:
    raw = solve_expression(expression)
    return render_math(format_result(expression, raw))


# --- probabilidade clássica ----------------------------------------------


def test_probabilidade_shows_full_deduction_chain() -> None:
    assert _solve("probabilidade(3,10)") == "P(A) = 3/10 = 0.3"


def test_probabilidade_twenty_five_percent() -> None:
    assert _solve("probabilidade(25,100)") == "P(A) = 25/100 = 0.25"


def test_probabilidade_repeating_decimal_rounds_to_ten_places() -> None:
    assert _solve("probabilidade(1,6)") == "P(A) = 1/6 = 0.1666666667"


def test_probabilidade_favoraveis_equal_total() -> None:
    assert _solve("probabilidade(10,10)") == "P(A) = 10/10 = 1"


def test_probabilidade_favoraveis_zero() -> None:
    assert _solve("probabilidade(0,10)") == "P(A) = 0/10 = 0"


# --- complementar ----------------------------------------------------------


def test_complementar_shows_full_deduction_chain() -> None:
    assert _solve("complementar(0.3)") == "P(Aᶜ) = 1-0.3 = 0.7"


def test_complementar_of_quarter() -> None:
    assert _solve("complementar(0.25)") == "P(Aᶜ) = 1-0.25 = 0.75"


def test_complementar_of_82_percent() -> None:
    assert _solve("complementar(0.82)") == "P(Aᶜ) = 1-0.82 = 0.18"


def test_complementar_of_zero() -> None:
    assert _solve("complementar(0)") == "P(Aᶜ) = 1-0 = 1"


def test_complementar_of_one() -> None:
    assert _solve("complementar(1)") == "P(Aᶜ) = 1-1 = 0"


# --- união -------------------------------------------------------------


def test_uniao_shows_full_deduction_chain() -> None:
    assert _solve("uniao(0.4,0.5,0.2)") == "P(A∪B) = 0.4+0.5-0.2 = 0.7"


def test_uniao_second_example() -> None:
    assert _solve("uniao(0.6,0.3,0.1)") == "P(A∪B) = 0.6+0.3-0.1 = 0.8"


# --- interseção de eventos independentes ------------------------------


def test_intersecao_independente_shows_full_deduction_chain() -> None:
    assert _solve("intersecao_independente(0.5,0.3)") == "P(A∩B) = 0.5*0.3 = 0.15"


def test_intersecao_independente_second_example() -> None:
    assert _solve("intersecao_independente(0.2,0.8)") == "P(A∩B) = 0.2*0.8 = 0.16"


# --- condicional -----------------------------------------------------------


def test_condicional_shows_full_deduction_chain() -> None:
    assert _solve("condicional(0.2,0.5)") == "P(A|B) = 0.2/0.5 = 0.4"


def test_condicional_second_example() -> None:
    assert _solve("condicional(0.12,0.4)") == "P(A|B) = 0.12/0.4 = 0.3"


# --- verificação de independência --------------------------------------


def test_independentes_true_when_product_matches_intersection() -> None:
    assert _solve("independentes(0.5,0.2,0.1)") == (
        "P(A)*P(B) = 0.5*0.2 = 0.1, P(A∩B) = 0.1 -> Eventos independentes"
    )


def test_independentes_false_when_product_does_not_match_intersection() -> None:
    assert _solve("independentes(0.5,0.2,0.08)") == (
        "P(A)*P(B) = 0.5*0.2 = 0.1, P(A∩B) = 0.08 -> Eventos dependentes"
    )


# --- distribuição binomial ----------------------------------------------


def test_binomial_shows_full_deduction_chain() -> None:
    assert _solve("binomial(10,3,0.5)") == (
        "P(X=3) = C(10,3)*0.5³*0.5⁷ = 120*0.125*0.0078125 = 0.1171875"
    )


def test_binomial_reuses_combination_evaluator() -> None:
    # Confirma que o C(n,k) da cadeia é literalmente o mesmo valor que
    # `combinacao(20,5)` (Sprint V2.7) devolveria — reuso direto, não
    # recálculo manual (exigência explícita do escopo da sprint).
    assert "C(20,5)" in _solve("binomial(20,5,0.3)")
    assert "15504" in _solve("binomial(20,5,0.3)")


def test_binomial_k_zero() -> None:
    assert _solve("binomial(5,0,0.5)") == (
        "P(X=0) = C(5,0)*0.5⁰*0.5⁵ = 1*1*0.03125 = 0.03125"
    )


def test_binomial_k_equal_to_n() -> None:
    assert _solve("binomial(4,4,0.5)") == (
        "P(X=4) = C(4,4)*0.5⁴*0.5⁰ = 1*0.0625*1 = 0.0625"
    )


# --- validações: mensagens amigáveis ------------------------------------


def test_probabilidade_rejects_zero_total() -> None:
    with pytest.raises(ExpressionError, match=r"exige total > 0"):
        solve_expression("probabilidade(3,0)")


def test_probabilidade_rejects_negative_favoraveis() -> None:
    with pytest.raises(ExpressionError, match=r"não está definida para números negativos"):
        solve_expression("probabilidade(-1,10)")


def test_probabilidade_rejects_favoraveis_greater_than_total() -> None:
    with pytest.raises(ExpressionError, match=r"exige favoráveis ≤ total"):
        solve_expression("probabilidade(11,10)")


def test_complementar_rejects_negative_probability() -> None:
    with pytest.raises(ExpressionError, match=r"probabilidades negativas"):
        solve_expression("complementar(-0.1)")


def test_uniao_rejects_probability_above_one() -> None:
    with pytest.raises(ExpressionError, match=r"entre 0 e 1"):
        solve_expression("uniao(1.5,0.2,0.1)")


def test_binomial_rejects_negative_n() -> None:
    with pytest.raises(ExpressionError, match=r"não está definida para números negativos"):
        solve_expression("binomial(-1,3,0.5)")


def test_binomial_rejects_negative_k() -> None:
    with pytest.raises(ExpressionError, match=r"não está definida para números negativos"):
        solve_expression("binomial(10,-1,0.5)")


def test_binomial_rejects_k_greater_than_n() -> None:
    with pytest.raises(ExpressionError, match=r"exige k ≤ n"):
        solve_expression("binomial(3,5,0.5)")


def test_binomial_rejects_negative_p() -> None:
    with pytest.raises(ExpressionError, match=r"probabilidades negativas"):
        solve_expression("binomial(10,3,-0.1)")


def test_binomial_rejects_p_above_one() -> None:
    with pytest.raises(ExpressionError, match=r"entre 0 e 1"):
        solve_expression("binomial(10,3,1.5)")


def test_binomial_rejects_decimal_n() -> None:
    with pytest.raises(ExpressionError, match=r"sem casas decimais"):
        solve_expression("binomial(10.5,3,0.5)")


def test_binomial_rejects_decimal_k() -> None:
    with pytest.raises(ExpressionError, match=r"sem casas decimais"):
        solve_expression("binomial(10,3.5,0.5)")


def test_probabilidade_rejects_decimal_favoraveis() -> None:
    with pytest.raises(ExpressionError, match=r"sem casas decimais"):
        solve_expression("probabilidade(3.5,10)")


def test_condicional_rejects_division_by_zero() -> None:
    with pytest.raises(ExpressionError, match=r"divisão por zero"):
        solve_expression("condicional(0.2,0)")


def test_complementar_rejects_symbolic_argument() -> None:
    with pytest.raises(ExpressionError, match=r"não é um número"):
        solve_expression("complementar(x)")


def test_probabilidade_rejects_missing_argument() -> None:
    with pytest.raises(ExpressionError, match=r"espera exatamente 2 argumentos"):
        solve_expression("probabilidade(3)")


def test_probabilidade_rejects_extra_argument() -> None:
    with pytest.raises(ExpressionError, match=r"espera exatamente 2 argumentos"):
        solve_expression("probabilidade(3,10,5)")


def test_probabilidade_rejects_empty_call() -> None:
    with pytest.raises(ExpressionError, match=r"espera exatamente 2 argumentos"):
        solve_expression("probabilidade()")


def test_independentes_rejects_extra_argument() -> None:
    with pytest.raises(ExpressionError, match=r"espera exatamente 3 argumentos"):
        solve_expression("independentes(0.5,0.2,0.1,0.9)")


def test_uniao_rejects_missing_argument() -> None:
    with pytest.raises(ExpressionError, match=r"espera exatamente 3 argumentos"):
        solve_expression("uniao(0.4,0.5)")


# --- roteamento / cascata ------------------------------------------------


def test_probability_predicate_accepts_anchored_calls() -> None:
    assert is_probability_domain_expression("probabilidade(3,10)")
    assert is_probability_domain_expression("  binomial(10, 3, 0.5)  ")
    assert is_probability_domain_expression("independentes(0.5,0.2,0.1)")


def test_probability_predicate_rejects_embedded_call() -> None:
    # Chamada no MEIO de uma expressão não é reivindicada (regex ancorado,
    # mesmo contrato de combinatorics/polynomials).
    assert not is_probability_domain_expression("2*probabilidade(3,10)")


def test_solver_rejects_non_probability_text() -> None:
    with pytest.raises(ExpressionError, match=r"Não foi possível interpretar"):
        solve_probability_text("x + 1")


def test_probability_does_not_collide_with_combinatorics() -> None:
    # "combinacao(10,3)" continua 100% em combinatorics, mesmo com os dois
    # domínios ativos na mesma cascata.
    assert not is_probability_domain_expression("combinacao(10,3)")
    assert _solve("combinacao(10,3)") == "C(10,3) = 10!/(3!*7!) = 120"


# --- não-regressão das áreas existentes ---------------------------------


def test_algebra_expression_still_works() -> None:
    assert _solve("2 + 2") == "4"


def test_equation_still_works() -> None:
    assert _solve("x**2 - 9 = 0") == "x₁ = -3, x₂ = 3"


def test_matrix_still_works() -> None:
    assert _solve("det([[1,2],[3,4]])") == "-2"


def test_summation_still_works() -> None:
    assert _solve("Σ(k=1..10) k") == "55"


def test_combinatorics_still_works() -> None:
    assert _solve("fatorial(6)") == "6! = 720"


def test_polynomial_still_works() -> None:
    assert _solve("fatorar(x²-9)") == "(x - 3)(x + 3)"
