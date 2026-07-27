"""Sprint V2.7 — cobre `combinatorics/`: fatorial, permutação simples,
arranjo, combinação, permutação com repetição, aliases PT-BR/ASCII/livro
didático (fat, C/A/P maiúsculos), dedução simbólica em cadeia de igualdades
("C(10,3) = 10!/(3!*7!) = 120" intacta através de `format_result`/
`render_math`), validações (só inteiros, n ≥ 0, k ≥ 0, k ≤ n, soma das
repetições ≤ n, contagem de argumentos) com mensagens amigáveis, ordem da
cascata e não-regressão das áreas existentes ("5!" continua na álgebra)."""
from __future__ import annotations

import pytest

from app.formatter.pipeline import format_result
from app.formatter.renderer import render_math
from app.math_engine.combinatorics.dispatcher import (
    is_combinatorics_domain_expression,
    solve_combinatorics_text,
)
from app.math_engine.dispatcher import solve_expression
from app.math_engine.errors import ExpressionError


def _solve(expression: str) -> str:
    raw = solve_expression(expression)
    return render_math(format_result(expression, raw))


# --- fatorial -----------------------------------------------------------


def test_factorial_of_zero_is_one() -> None:
    assert _solve("fatorial(0)") == "0! = 1"


def test_factorial_of_one() -> None:
    assert _solve("fatorial(1)") == "1! = 1"


def test_factorial_of_six() -> None:
    assert _solve("fatorial(6)") == "6! = 720"


def test_factorial_alias_fat() -> None:
    assert _solve("fat(5)") == "5! = 120"


def test_factorial_accepts_integer_valued_expression() -> None:
    # "4+2" resolve para o inteiro 6 no parse seguro — a validação decide
    # sobre o VALOR, não sobre a forma digitada.
    assert _solve("fatorial(4+2)") == "6! = 720"


# --- permutação simples --------------------------------------------------


def test_permutation_of_six() -> None:
    assert _solve("permutacao(6)") == "P(6) = 6! = 720"


def test_permutation_accented_alias() -> None:
    assert _solve("permutação(5)") == "P(5) = 5! = 120"


def test_permutation_textbook_alias_uppercase_p() -> None:
    assert _solve("P(5)") == "P(5) = 5! = 120"


def test_permutation_of_zero() -> None:
    assert _solve("permutacao(0)") == "P(0) = 0! = 1"


# --- arranjo -------------------------------------------------------------


def test_arrangement_shows_full_deduction_chain() -> None:
    assert _solve("arranjo(8,3)") == "A(8,3) = 8!/(8-3)! = 8!/5! = 336"


def test_arrangement_textbook_alias_uppercase_a() -> None:
    assert _solve("A(8,3)") == "A(8,3) = 8!/(8-3)! = 8!/5! = 336"


def test_arrangement_with_k_equal_to_n() -> None:
    assert _solve("arranjo(5,5)") == "A(5,5) = 5!/(5-5)! = 5!/0! = 120"


def test_arrangement_with_k_zero() -> None:
    assert _solve("arranjo(4,0)") == "A(4,0) = 4!/(4-0)! = 4!/4! = 1"


# --- combinação ----------------------------------------------------------


def test_combination_shows_full_deduction_chain() -> None:
    assert _solve("combinacao(10,3)") == "C(10,3) = 10!/(3!*7!) = 120"


def test_combination_accented_alias() -> None:
    assert _solve("combinação(10,3)") == "C(10,3) = 10!/(3!*7!) = 120"


def test_combination_textbook_alias_uppercase_c() -> None:
    assert _solve("C(10,3)") == "C(10,3) = 10!/(3!*7!) = 120"


def test_combination_twenty_choose_ten() -> None:
    assert _solve("combinacao(20,10)") == "C(20,10) = 20!/(10!*10!) = 184756"


def test_combination_with_k_zero() -> None:
    assert _solve("combinacao(5,0)") == "C(5,0) = 5!/(0!*5!) = 1"


def test_combination_with_k_equal_to_n() -> None:
    assert _solve("combinacao(5,5)") == "C(5,5) = 5!/(5!*0!) = 1"


# --- permutação com repetição -------------------------------------------


def test_permutation_with_repetition() -> None:
    assert _solve("permutacao_repeticao(8,3,2,2)") == "8!/(3!*2!*2!) = 1680"


def test_permutation_with_repetition_accented_alias() -> None:
    assert _solve("permutação_repetição(8,3,2,2)") == "8!/(3!*2!*2!) = 1680"


def test_permutation_with_repetition_single_repetition() -> None:
    assert _solve("permutacao_repeticao(4,2)") == "4!/(2!) = 12"


def test_permutation_with_repetition_sum_equal_to_n() -> None:
    # ANAGRAMA clássico de "ARARA": n = 5, A aparece 3x, R aparece 2x.
    assert _solve("permutacao_repeticao(5,3,2)") == "5!/(3!*2!) = 10"


# --- validações: mensagens amigáveis ------------------------------------


def test_combination_rejects_k_greater_than_n() -> None:
    with pytest.raises(ExpressionError, match=r"exige k ≤ n"):
        solve_expression("combinacao(3,5)")


def test_arrangement_rejects_k_greater_than_n() -> None:
    with pytest.raises(ExpressionError, match=r"exige k ≤ n"):
        solve_expression("arranjo(2,3)")


def test_factorial_rejects_negative() -> None:
    with pytest.raises(ExpressionError, match=r"não está definida para números negativos"):
        solve_expression("fatorial(-3)")


def test_combination_rejects_negative_k() -> None:
    with pytest.raises(ExpressionError, match=r"não está definida para números negativos"):
        solve_expression("combinacao(5,-2)")


def test_factorial_rejects_decimal() -> None:
    with pytest.raises(ExpressionError, match=r"sem casas decimais"):
        solve_expression("fatorial(3.5)")


def test_combination_rejects_decimal_k() -> None:
    with pytest.raises(ExpressionError, match=r"sem casas decimais"):
        solve_expression("combinacao(10,2.5)")


def test_combination_rejects_non_integer_fraction() -> None:
    with pytest.raises(ExpressionError, match=r"sem casas decimais"):
        solve_expression("combinacao(10,5/2)")


def test_factorial_rejects_symbolic_argument() -> None:
    with pytest.raises(ExpressionError, match=r"não é um número"):
        solve_expression("fatorial(x)")


def test_combination_rejects_missing_argument() -> None:
    with pytest.raises(ExpressionError, match=r"espera exatamente 2 argumentos"):
        solve_expression("combinacao(10)")


def test_arrangement_rejects_extra_argument() -> None:
    with pytest.raises(ExpressionError, match=r"espera exatamente 2 argumentos"):
        solve_expression("arranjo(8,3,1)")


def test_factorial_rejects_empty_call() -> None:
    with pytest.raises(ExpressionError, match=r"espera exatamente 1 argumento"):
        solve_expression("fatorial()")


def test_permutation_with_repetition_rejects_single_argument() -> None:
    with pytest.raises(ExpressionError, match=r"espera pelo menos 2 argumentos"):
        solve_expression("permutacao_repeticao(8)")


def test_permutation_with_repetition_rejects_sum_above_n() -> None:
    with pytest.raises(ExpressionError, match=r"soma das repetições"):
        solve_expression("permutacao_repeticao(4,3,2)")


# --- roteamento / cascata ------------------------------------------------


def test_combinatorics_predicate_accepts_anchored_calls() -> None:
    assert is_combinatorics_domain_expression("fatorial(6)")
    assert is_combinatorics_domain_expression("  combinação(10, 3)  ")
    assert is_combinatorics_domain_expression("C(10,3)")


def test_combinatorics_predicate_rejects_embedded_call() -> None:
    # Chamada no MEIO de uma expressão não é reivindicada (regex ancorado,
    # mesmo contrato de polynomials) — cai na álgebra e vira erro claro.
    assert not is_combinatorics_domain_expression("2*fatorial(3)")


def test_combinatorics_predicate_rejects_lowercase_textbook_letters() -> None:
    # "c(...)"/"a(...)"/"p(...)" minúsculos pertencem à álgebra livre.
    assert not is_combinatorics_domain_expression("c(10,3)")
    assert not is_combinatorics_domain_expression("a(8,3)")


def test_solver_rejects_non_combinatorics_text() -> None:
    with pytest.raises(ExpressionError, match=r"Não foi possível interpretar"):
        solve_combinatorics_text("x + 1")


def test_factorial_name_does_not_steal_polynomial_factor_call() -> None:
    # "fatorar(" não é prefixo casável de "fat(" (o regex exige "(" logo
    # após o alias) — polynomials continua dono de fatorar(...).
    assert not is_combinatorics_domain_expression("fatorar(x²-9)")
    assert _solve("fatorar(x²-9)") == "(x - 3)(x + 3)"


# --- não-regressão das áreas existentes ---------------------------------


def test_bare_factorial_notation_still_solved_by_algebra() -> None:
    # "5!" solto nunca foi combinatória: continua no fallback de álgebra,
    # com o MESMO resultado de antes da V2.7 (sem cadeia de dedução).
    assert not is_combinatorics_domain_expression("5!")
    assert _solve("5!") == "120"


def test_algebra_expression_still_works() -> None:
    assert _solve("2 + 2") == "4"


def test_equation_still_works() -> None:
    assert _solve("x**2 - 9 = 0") == "x₁ = -3, x₂ = 3"


def test_matrix_still_works() -> None:
    assert _solve("det([[1,2],[3,4]])") == "-2"


def test_summation_still_works() -> None:
    assert _solve("Σ(k=1..10) k") == "55"
