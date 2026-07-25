"""Sprint V2.2 — cobre `matrix/`: literal de matriz, operações (soma,
subtração, multiplicação, escalar, potência inteira), funções (det/inv/
transpose/trace + aliases PT-BR determinante/inversa/transposta/traço),
validações (matriz vazia, linhas de tamanhos diferentes, dimensões
incompatíveis, matriz não quadrada, matriz singular, potência inválida),
ordem da cascata (matrix depois de summation, antes de calculus/functions/
trigonometry/logarithms/equations) e não-regressão das áreas existentes."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sympy import Integer, Rational

from app.formatter.pipeline import format_result
from app.formatter.renderer import render_math
from app.math_engine.analytic_geometry.dispatcher import (
    is_analytic_geometry_domain_expression,
)
from app.math_engine.calculus.dispatcher import is_calculus_domain_expression
from app.math_engine.dispatcher import solve_expression
from app.math_engine.equations.dispatcher import is_equation_domain_expression
from app.math_engine.errors import ExpressionError
from app.math_engine.functions.dispatcher import is_function_domain_expression
from app.math_engine.logarithms.dispatcher import is_logarithm_domain_expression
from app.math_engine.matrix.dispatcher import is_matrix_domain_expression
from app.math_engine.matrix.parsing import (
    MatrixBinaryOpNode,
    MatrixCallNode,
    MatrixLiteralNode,
    ScalarNode,
    parse_matrix_expression,
)
from app.math_engine.matrix.validation import validate_power_exponent
from app.math_engine.summation.dispatcher import is_summation_domain_expression
from app.math_engine.trigonometry.dispatcher import is_trigonometry_domain_expression


def _solve(expression: str) -> str:
    raw = solve_expression(expression)
    return render_math(format_result(expression, raw))


# --- Literal de matriz -------------------------------------------------


def test_matrix_literal_roundtrips_verbatim() -> None:
    assert _solve("[[1,2],[3,4]]") == "[[1, 2], [3, 4]]"


def test_matrix_literal_tolerates_internal_whitespace_and_multiline_style() -> None:
    assert _solve("[[ 1 , 2 ],\n [ 3 , 4 ]]") == "[[1, 2], [3, 4]]"


def test_matrix_literal_accepts_rational_cells() -> None:
    assert _solve("[[1/2, 3],[4, 5]]") == "[[1/2, 3], [4, 5]]"


def test_matrix_literal_accepts_simple_symbolic_cells() -> None:
    assert _solve("[[a, 1],[0, a]]") == "[[a, 1], [0, a]]"


def test_matrix_literal_row_vector() -> None:
    assert _solve("[[1,2,3]]") == "[[1, 2, 3]]"


def test_matrix_literal_column_vector() -> None:
    assert _solve("[[1],[2],[3]]") == "[[1], [2], [3]]"


def test_matrix_cell_follows_log_base10_convention() -> None:
    # Mesma convenção de produto usada em `summation`/`logarithms` — "log"
    # dentro de uma célula é base 10, não o natural nativo do SymPy.
    assert _solve("[[log(100), 0],[0, 1]]") == "[[2, 0], [0, 1]]"


# --- Operações -----------------------------------------------------------


def test_matrix_addition() -> None:
    assert _solve("[[1,2],[3,4]] + [[5,6],[7,8]]") == "[[6, 8], [10, 12]]"


def test_matrix_subtraction() -> None:
    assert _solve("[[1,2],[3,4]] - [[5,6],[7,8]]") == "[[-4, -4], [-4, -4]]"


def test_matrix_multiplication() -> None:
    assert _solve("[[1,2],[3,4]] * [[5,6],[7,8]]") == "[[19, 22], [43, 50]]"


def test_scalar_times_matrix() -> None:
    assert _solve("2 * [[1,2],[3,4]]") == "[[2, 4], [6, 8]]"


def test_matrix_times_scalar() -> None:
    assert _solve("[[1,2],[3,4]] * 2") == "[[2, 4], [6, 8]]"


def test_matrix_power_zero_is_identity() -> None:
    assert _solve("[[1,2],[3,4]] ^ 0") == "[[1, 0], [0, 1]]"


def test_matrix_power_one_is_itself() -> None:
    assert _solve("[[1,2],[3,4]] ^ 1") == "[[1, 2], [3, 4]]"


def test_matrix_power_two() -> None:
    assert _solve("[[1,2],[3,4]] ^ 2") == "[[7, 10], [15, 22]]"


def test_matrix_power_three() -> None:
    assert _solve("[[1,2],[3,4]] ^ 3") == "[[37, 54], [81, 118]]"


def test_chained_matrix_addition_and_scalar_multiplication() -> None:
    # Precedência padrão ("*" antes de "+") funciona de graça — o parser é
    # uma descida recursiva genérica, não um casamento de dois operandos só.
    assert _solve("[[1,0],[0,1]] + [[1,1],[1,1]] * 2") == "[[3, 2], [2, 3]]"


# --- Funções (canônicas + aliases PT-BR) ----------------------------------


@pytest.mark.parametrize("name", ["det", "determinante"])
def test_determinant(name: str) -> None:
    assert _solve(f"{name}([[1,2],[3,4]])") == "-2"


@pytest.mark.parametrize("name", ["inv", "inversa"])
def test_inverse(name: str) -> None:
    assert _solve(f"{name}([[1,2],[3,4]])") == "[[-2, 1], [3/2, -1/2]]"


@pytest.mark.parametrize("name", ["transpose", "transposta"])
def test_transpose(name: str) -> None:
    assert _solve(f"{name}([[1,2,3],[4,5,6]])") == "[[1, 4], [2, 5], [3, 6]]"


@pytest.mark.parametrize("name", ["trace", "traço"])
def test_trace(name: str) -> None:
    assert _solve(f"{name}([[1,2],[3,4]])") == "5"


def test_determinant_of_symbolic_matrix() -> None:
    assert _solve("det([[a, 1],[0, a]])") == "a²"  # "a²" (superscript aplicado por render_math)


def test_inverse_of_identity_is_itself() -> None:
    assert _solve("inv([[1,0],[0,1]])") == "[[1, 0], [0, 1]]"


# --- Validação: parsing ----------------------------------------------------


def test_empty_matrix_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="vazia"):
        _solve("[[]]")


def test_matrix_with_empty_row_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="linha vazia"):
        _solve("[[1,2],[]]")


def test_matrix_with_uneven_row_lengths_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="mesmo número de colunas"):
        _solve("[[1,2],[3]]")


def test_matrix_row_not_wrapped_in_brackets_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="entre colchetes"):
        _solve("[[1,2],3]")


def test_unclosed_bracket_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="não fechado"):
        _solve("[[1,2],[3,4]")


def test_unknown_matrix_function_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="desconhecida"):
        _solve("rank([[1,2],[3,4]])")


# --- Validação: semântica (matriz já avaliada) ------------------------------


def test_addition_with_incompatible_dimensions_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="dimensões diferentes"):
        _solve("[[1,2],[3,4]] + [[1,2,3],[4,5,6]]")


def test_subtraction_with_incompatible_dimensions_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="dimensões diferentes"):
        _solve("[[1,2],[3,4]] - [[1,2,3],[4,5,6]]")


def test_multiplication_with_incompatible_dimensions_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="dimensões incompatíveis"):
        _solve("[[1,2],[3,4]] * [[1,2,3],[4,5,6],[7,8,9]]")


def test_adding_scalar_to_matrix_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="escalar"):
        _solve("1 + [[1,2],[3,4]]")


def test_determinant_of_non_square_matrix_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="matriz quadrada"):
        _solve("det([[1,2,3],[4,5,6]])")


def test_trace_of_non_square_matrix_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="matriz quadrada"):
        _solve("trace([[1,2,3],[4,5,6]])")


def test_inverse_of_non_square_matrix_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="matriz quadrada"):
        _solve("inv([[1,2,3],[4,5,6]])")


def test_inverse_of_singular_matrix_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="singular"):
        _solve("inv([[1,2],[2,4]])")


def test_power_of_non_square_matrix_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="matriz quadrada"):
        _solve("[[1,2,3],[4,5,6]] ^ 2")


def test_non_integer_power_is_rejected() -> None:
    # Exponente simbólico (não um `Integer` do SymPy) é o caminho que de
    # fato alcança `validate_power_exponent` através do pipeline completo —
    # um literal decimal ("2.5") já é rejeitado antes, pela whitelist de
    # caracteres de `safe_parsing.py` (nenhuma área do motor aceita ponto
    # decimal hoje, ver docstring de lá), com uma mensagem genérica que não
    # é responsabilidade deste módulo testar.
    with pytest.raises(ExpressionError, match="inteiro"):
        _solve("[[1,2],[3,4]] ^ a")


def test_matrix_as_power_exponent_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="não pode ser uma matriz"):
        _solve("[[1,2],[3,4]] ^ [[1,2],[3,4]]")


def test_excessive_power_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="maior que"):
        _solve("[[1,2],[3,4]] ^ 1000")


def test_negative_power_is_rejected_with_clear_message() -> None:
    # A sintaxe suportada hoje não tem menos unário, então um expoente
    # negativo nunca chega aqui vindo do parser — este guard existe para uma
    # futura extensão de sintaxe (ver docstring de `validation.py`) e é
    # testado diretamente para não ficar sem cobertura até lá.
    with pytest.raises(ExpressionError, match="negativas"):
        validate_power_exponent(Integer(-1))


def test_non_integer_power_expression_is_rejected_directly() -> None:
    with pytest.raises(ExpressionError, match="inteiro"):
        validate_power_exponent(Rational(1, 2))


# --- Parser: árvore produzida (preparação para evolução futura) ------------


def test_parser_produces_binary_op_tree_for_matrix_addition() -> None:
    node = parse_matrix_expression("[[1,2],[3,4]] + [[5,6],[7,8]]")
    assert isinstance(node, MatrixBinaryOpNode)
    assert node.operator == "+"
    assert isinstance(node.left, MatrixLiteralNode)
    assert isinstance(node.right, MatrixLiteralNode)


def test_parser_produces_call_node_for_det() -> None:
    node = parse_matrix_expression("det([[1,2],[3,4]])")
    assert isinstance(node, MatrixCallNode)
    assert node.name == "det"
    assert isinstance(node.argument, MatrixLiteralNode)


def test_parser_canonicalizes_portuguese_alias() -> None:
    node = parse_matrix_expression("determinante([[1,2],[3,4]])")
    assert isinstance(node, MatrixCallNode)
    assert node.name == "det"


def test_parser_produces_scalar_node_for_bare_identifier() -> None:
    node = parse_matrix_expression("a * [[1,2],[3,4]]")
    assert isinstance(node, MatrixBinaryOpNode)
    assert isinstance(node.left, ScalarNode)
    assert node.left.text == "a"


# --- Ordem da cascata: matrix depois de summation, antes de calculus/
# functions/trigonometry/logarithms/equations -------------------------------


def test_matrix_literal_is_claimed_by_matrix_domain_only() -> None:
    expression = "[[1,2],[3,4]] + [[5,6],[7,8]]"
    assert is_matrix_domain_expression(expression) is True
    assert is_calculus_domain_expression(expression) is False
    assert is_function_domain_expression(expression) is False
    assert is_trigonometry_domain_expression(expression) is False
    assert is_logarithm_domain_expression(expression) is False
    assert is_equation_domain_expression(expression) is False


def test_matrix_function_call_anywhere_in_text_is_claimed() -> None:
    # Mesmo critério de trigonometry/logarithms: `.search()`, não só prefixo
    # — necessário porque "2 * [[...]]" não começa com "[[" nem com o nome
    # da função.
    assert is_matrix_domain_expression("2 * [[1,2],[3,4]]") is True
    assert is_matrix_domain_expression("det([[1,2],[3,4]])") is True


def test_summation_is_checked_before_matrix_and_still_wins_its_own_prefix() -> None:
    expression = "Σ(i=1..3) i"
    assert is_summation_domain_expression(expression) is True
    assert is_matrix_domain_expression(expression) is False


def test_single_bracket_point_lists_are_not_claimed_by_matrix_domain() -> None:
    # `analytic_geometry` usa colchete simples para listas de pontos — só
    # colchete DUPLO ("[[") é o marcador de matriz.
    expression = "relacao_retas([(0,0),(1,0)],[(0,0),(0,1)])"
    assert is_analytic_geometry_domain_expression(expression) is True
    assert is_matrix_domain_expression(expression) is False


def test_relacao_retas_still_resolves_through_analytic_geometry() -> None:
    assert "Perpendiculares" in _solve(
        "relacao_retas([(0,0),(1,0)],[(0,0),(0,1)])"
    )


# --- Contrato HTTP -----------------------------------------------------


def test_solve_endpoint_preserves_original_matrix_syntax_verbatim(client: TestClient) -> None:
    response = client.post("/solve", json={"expression": "[[1,2],[3,4]]"})
    assert response.status_code == 200
    assert response.json() == {
        "expression": "[[1,2],[3,4]]",
        "result": "[[1, 2], [3, 4]]",
        "approx": None,
    }


def test_solve_endpoint_evaluates_determinant(client: TestClient) -> None:
    response = client.post("/solve", json={"expression": "det([[1,2],[3,4]])"})
    assert response.status_code == 200
    assert response.json() == {
        "expression": "det([[1,2],[3,4]])",
        "result": "-2",
        "approx": None,
    }


def test_solve_endpoint_returns_400_for_singular_inverse(client: TestClient) -> None:
    response = client.post("/solve", json={"expression": "inv([[1,2],[2,4]])"})
    assert response.status_code == 400
    assert "singular" in response.json()["detail"]


def test_solve_endpoint_returns_400_for_incompatible_dimensions(client: TestClient) -> None:
    response = client.post(
        "/solve", json={"expression": "[[1,2],[3,4]] + [[1,2,3],[4,5,6]]"}
    )
    assert response.status_code == 400
    assert "dimensões" in response.json()["detail"]


# --- Não-regressão das áreas existentes -------------------------------------


def test_existing_algebra_still_works() -> None:
    assert _solve("2+2") == "4"


def test_existing_summation_still_works() -> None:
    assert _solve("Σ(i=1..10) i") == "55"


def test_existing_calculus_still_works() -> None:
    assert _solve("integral(x**2, x)") == "Integral: x³/3 + C"


def test_existing_equations_still_work() -> None:
    assert _solve("x**2 - 4 = 0") == "x₁ = -2, x₂ = 2"


def test_existing_analytic_geometry_still_works() -> None:
    assert "Perpendiculares" in _solve(
        "relacao_retas([(0,0),(1,0)],[(0,0),(0,1)])"
    )


# --- Segurança: extração de parâmetros livres nunca abre brecha nova -------


@pytest.mark.parametrize(
    "expression",
    [
        "[[__import__('os').system('dir'), 1],[0, 1]]",
        "[[os.system(1), 1],[0, 1]]",
        "[[foo.bar, 1],[0, 1]]",
        "[[i__class__, 1],[0, 1]]",
        "[[().__class__.__bases__, 1],[0, 1]]",
        "det([[__import__('os').system('dir'), 1],[0, 1]])",
    ],
)
def test_matrix_cell_never_bypasses_security_layers(expression: str) -> None:
    with pytest.raises(ExpressionError):
        _solve(expression)
