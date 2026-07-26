"""Sprint V2.5 — Motor de Sistemas Polinomiais Não Lineares.

Cobre a camada nova (`equations/nonlinear.py`,
`equations/nonlinear_validation.py`, `equations/nonlinear_formatter.py`)
de ponta a ponta via `solve_expression`/`format_result`/`render_math`
(mesmo helper `_solve` de `test_equations.py`), além de testes unitários
isolados dos módulos de validação/formatação. `equations/systems.py`
(motor linear original) nunca é importado aqui — a suíte de regressão
linear já existe em `test_equations.py` e é reexecutada intocada.
"""
from __future__ import annotations

from sympy import Eq, Symbol

from app.formatter.pipeline import format_result
from app.formatter.renderer import render_math
from app.math_engine.dispatcher import solve_expression
from app.math_engine.equations.nonlinear_formatter import format_nonlinear_solutions
from app.math_engine.equations.nonlinear_validation import (
    is_linear_system,
    is_polynomial_system,
)
from app.math_engine.errors import ExpressionError

import pytest


def _solve(expression: str) -> str:
    raw = solve_expression(expression)
    return render_math(format_result(expression, raw))


# --- Casos-alvo da sprint (KaTeX/preview validados à parte no frontend) --


def test_parabola_and_line() -> None:
    assert _solve("x**2+y=5\nx-y=1") == "x = -3, y = -4 ou x = 2, y = 1"


def test_circle_and_line() -> None:
    assert _solve("x**2+y**2=25\nx-y=1") == "x = -3, y = -4 ou x = 4, y = 3"


def test_product_between_unknowns() -> None:
    # "xy=6" (sem "*") é rejeitado deliberadamente pelo parser (Sprint
    # Parser, `safe_parsing.py:_reject_ambiguous_identifiers` — evita a
    # ambiguidade "xy" -> quebrar letra a letra e multiplicar às cegas);
    # sintaxe correta e já suportada: "x*y=6".
    assert _solve("x*y=6\nx+y=5") == "x = 2, y = 3 ou x = 3, y = 2"


def test_explicit_parabola() -> None:
    assert _solve("y=x**2\nx+y=6") == "x = -3, y = 9 ou x = 2, y = 4"


def test_factored_product_equation() -> None:
    assert _solve("(x+1)*(y-2)=0\nx-y=0") == "x = -1, y = -1 ou x = 2, y = 2"


def test_simple_cubic_when_nonlinsolve_resolves_naturally() -> None:
    # Nenhum código dedicado a grau 3 — se o `nonlinsolve` resolver
    # naturalmente (como resolve para este sistema), o resultado é
    # aceito como está, incluindo as duas raízes complexas.
    result = _solve("x**3+y=9\nx+y=3")
    assert result == (
        "x = -1 - √2*i, y = 4 + √2*i ou x = -1 + √2*i, y = 4 - √2*i ou x = 2, y = 1"
    )


def test_multiple_solutions_each_appears_as_its_own_branch() -> None:
    result = _solve("x**2+y=5\nx-y=1")
    assert " ou " in result
    assert result.count(" ou ") == 1  # duas soluções == um separador


def test_complex_only_solutions_render_normally() -> None:
    # x**2+y**2=-1 (nenhuma solução real) combinado com uma reta —
    # confirma que soluções puramente complexas não são tratadas como
    # "sem solução" nem escondidas.
    result = _solve("x**2+y**2=-1\nx-y=0")
    assert result == "x = -√2*i/2, y = -√2*i/2 ou x = √2*i/2, y = √2*i/2"


def test_no_solution_returns_friendly_message_not_a_crash() -> None:
    assert _solve("x**2+y**2=1\nx**2+y**2=4") == "Sistema sem solução"


def test_underdetermined_nonlinear_system_returns_coherent_message() -> None:
    assert (
        _solve("x**2+y=5\n2*x**2+2*y=10")
        == "Sistema com infinitas soluções (indeterminado)."
    )


def test_transcendental_function_that_escapes_earlier_domain_routing_is_rejected() -> None:
    # "Abs(" não é reconhecido por nenhum domínio anterior a equations no
    # roteador (`math_engine/dispatcher.py`) — chega de fato até
    # `solve_nonlinear_system`, que precisa recusar por conta própria
    # (`is_polynomial_system` como guarda de correção, não só cosmética:
    # `nonlinsolve` "resolveria" isto silenciosamente errado se não fosse
    # barrado antes).
    with pytest.raises(ExpressionError, match="funções transcendentais"):
        _solve("Abs(x)+y=5\nx-y=1")


def test_no_closed_form_solution_is_rejected_instead_of_leaking_crootof() -> None:
    # Sistema cujo grau força soluções sem forma radical fechada (SymPy
    # devolveria `CRootOf(...)`) — nunca deve vazar como texto para o
    # usuário ("nada de dumps do SymPy").
    with pytest.raises(ExpressionError, match="forma fechada"):
        _solve("x**5+x+y=1\nx-y=1")


# --- Regressão: sistemas lineares e equações únicas continuam intactos --


def test_linear_system_regression_still_uses_linsolve_path() -> None:
    assert _solve("x+y=5\nx-y=1") == "x = 3, y = 2"
    assert _solve("x+y+z=6\nx-y=0\ny-z=1") == "x = 7/3, y = 7/3, z = 4/3"


def test_linear_system_no_solution_and_indeterminate_regression() -> None:
    assert _solve("x+y=2\nx+y=3") == "Sistema sem solução"
    assert _solve("x+y=2\n2x+2y=4") == "x = 2 - y, y = y"


def test_single_equation_regression_unaffected() -> None:
    assert _solve("x - 5 = 0") == "x = 5"
    assert _solve("x**2 - 4 = 0") == "x₁ = -2, x₂ = 2"
    # Grau 3 de UMA incógnita já vai por `solve_polynomial` (pré-existente,
    # `sympy.solve`, todas as raízes sobre os complexos) — caminho
    # totalmente diferente do sistema não linear desta sprint, nunca
    # tocado por ela.
    assert _solve("x**3 - 8 = 0") == "x₁ = -1 - √3*i, x₂ = -1 + √3*i, x₃ = 2"


# --- Determinismo (ordem de iteração de um FiniteSet não é garantia) ----


def test_multi_solution_ordering_is_deterministic_across_calls() -> None:
    results = {_solve("x**2+y=5\nx-y=1") for _ in range(5)}
    assert len(results) == 1


# --- nonlinear_validation.py (testes unitários, árvore SymPy) -----------


def test_is_linear_system_true_only_for_total_degree_one() -> None:
    x, y, z = Symbol("x"), Symbol("y"), Symbol("z")
    assert is_linear_system([Eq(x + y, 5), Eq(x - y, 1)], [x, y]) is True
    assert is_linear_system([Eq(2 * x - 3 * y, 1)], [x, y]) is True
    assert is_linear_system([Eq(3 * x + 4 * y - 2 * z, 7)], [x, y, z]) is True
    assert is_linear_system([Eq(x**2 + y, 5), Eq(x - y, 1)], [x, y]) is False
    assert is_linear_system([Eq(x * y, 6)], [x, y]) is False


def test_is_polynomial_system_false_for_transcendental_terms() -> None:
    import sympy

    x, y = Symbol("x"), Symbol("y")
    assert is_polynomial_system([Eq(x**2 + y, 5)], [x, y]) is True
    assert is_polynomial_system([Eq(sympy.sin(x) + y, 1)], [x, y]) is False
    assert is_polynomial_system([Eq(sympy.Abs(x) + y, 5)], [x, y]) is False
    assert is_polynomial_system([Eq(sympy.exp(x) + y, 5)], [x, y]) is False


# --- nonlinear_formatter.py (testes unitários, sem tocar solve_expression) --


def test_format_nonlinear_solutions_empty_set_returns_no_solution_message() -> None:
    from sympy import EmptySet

    x, y = Symbol("x"), Symbol("y")
    assert format_nonlinear_solutions(EmptySet, [x, y]) == "Sistema sem solução"


def test_format_nonlinear_solutions_single_tuple_no_ou_separator() -> None:
    from sympy import FiniteSet, Tuple

    x, y = Symbol("x"), Symbol("y")
    solutions = FiniteSet(Tuple(2, 3))
    assert format_nonlinear_solutions(solutions, [x, y]) == "x = 2, y = 3"


def test_format_nonlinear_solutions_multiple_tuples_joined_with_ou_sorted() -> None:
    from sympy import FiniteSet, Tuple

    x, y = Symbol("x"), Symbol("y")
    # Fora de ordem de propósito — a formatação deve ordenar
    # deterministicamente (por parte real, depois imaginária).
    solutions = FiniteSet(Tuple(3, 2), Tuple(-3, -4), Tuple(2, 1))
    assert (
        format_nonlinear_solutions(solutions, [x, y])
        == "x = -3, y = -4 ou x = 2, y = 1 ou x = 3, y = 2"
    )


def test_format_nonlinear_solutions_rejects_crootof_with_expression_error() -> None:
    from sympy import FiniteSet, Tuple
    from sympy.polys.rootoftools import CRootOf

    x, y = Symbol("x"), Symbol("y")
    root = CRootOf(Symbol("t") ** 5 + Symbol("t") + 1, 0)
    solutions = FiniteSet(Tuple(root, root + 1))
    with pytest.raises(ExpressionError, match="forma fechada"):
        format_nonlinear_solutions(solutions, [x, y])


def test_format_nonlinear_solutions_detects_underdetermined_via_free_symbols() -> None:
    from sympy import FiniteSet, Tuple, sqrt

    x, y = Symbol("x"), Symbol("y")
    solutions = FiniteSet(Tuple(sqrt(25 - y**2), y), Tuple(-sqrt(25 - y**2), y))
    assert (
        format_nonlinear_solutions(solutions, [x, y])
        == "Sistema com infinitas soluções (indeterminado)."
    )


def test_format_nonlinear_solutions_rejects_unexpected_structure() -> None:
    from sympy import Symbol as SympySymbol

    x, y = Symbol("x"), Symbol("y")
    # Não é um FiniteSet — estrutura que `nonlinsolve` não deveria devolver
    # nesta forma, mas a guarda precisa recusar sem RuntimeError mesmo assim.
    not_a_finiteset = SympySymbol("nao_e_um_finiteset")
    with pytest.raises(ExpressionError):
        format_nonlinear_solutions(not_a_finiteset, [x, y])
