"""Sprint V2.2.1 — Variáveis Locais para Matrizes: atribuições dentro de
uma única expressão ("A=[[1,2],[3,4]]\\nB=[[5,6],[7,8]]\\nA*B"), separador
de instrução por quebra de linha OU ";" fora de colchetes/parênteses,
validações (variável duplicada, inexistente, nome inválido, nome
reservado), ausência de estado entre chamadas, e não-regressão de tudo o
que a Sprint V2.2 (sem variáveis) já cobria."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sympy import Integer, Rational

from app.formatter.pipeline import format_result
from app.formatter.renderer import render_math
from app.math_engine.dispatcher import solve_expression
from app.math_engine.errors import ExpressionError
from app.math_engine.matrix.evaluator import evaluate_matrix_program
from app.math_engine.matrix.parsing import (
    AssignmentNode,
    MatrixBinaryOpNode,
    MatrixLiteralNode,
    ProgramNode,
    ScalarNode,
    parse_matrix_program,
)
from app.math_engine.matrix.validation import validate_assignment_is_matrix


def _solve(expression: str) -> str:
    raw = solve_expression(expression)
    return render_math(format_result(expression, raw))


# --- Sintaxes suportadas: quebra de linha e ";" -----------------------


def test_assignment_then_reference() -> None:
    assert _solve("A=[[1,2],[3,4]]\nA") == "[[1, 2], [3, 4]]"


def test_assignment_then_determinant() -> None:
    assert _solve("A=[[1,2],[3,4]]\ndet(A)") == "-2"


def test_assignment_then_inverse() -> None:
    assert _solve("A=[[2,0],[0,2]]\ninv(A)") == "[[1/2, 0], [0, 1/2]]"


def test_two_assignments_addition() -> None:
    assert _solve("A=[[1,2],[3,4]]\nB=[[5,6],[7,8]]\nA+B") == "[[6, 8], [10, 12]]"


def test_two_assignments_subtraction() -> None:
    assert _solve("A=[[1,2],[3,4]]\nB=[[5,6],[7,8]]\nA-B") == "[[-4, -4], [-4, -4]]"


def test_two_assignments_multiplication() -> None:
    assert _solve("A=[[1,2],[3,4]]\nB=[[5,6],[7,8]]\nA*B") == "[[19, 22], [43, 50]]"


def test_assignment_then_power() -> None:
    assert _solve("A=[[1,2],[3,4]]\nA^2") == "[[7, 10], [15, 22]]"


def test_assignment_then_transpose() -> None:
    assert _solve("A=[[1,2,3],[4,5,6]]\ntranspose(A)") == "[[1, 4], [2, 5], [3, 6]]"


def test_assignment_then_trace() -> None:
    assert _solve("A=[[1,2],[3,4]]\ntrace(A)") == "5"


def test_semicolons_are_an_equally_valid_separator() -> None:
    assert (
        _solve("A=[[1,2],[3,4]]; B=[[5,6],[7,8]]; A*B")
        == _solve("A=[[1,2],[3,4]]\nB=[[5,6],[7,8]]\nA*B")
    )


def test_mixing_newlines_and_semicolons() -> None:
    assert _solve("A=[[1,2],[3,4]]\nB=[[5,6],[7,8]]; A*B") == "[[19, 22], [43, 50]]"


def test_blank_lines_between_assignments_are_ignored() -> None:
    assert _solve("A=[[1,2],[3,4]]\n\nB=[[5,6],[7,8]]\n\nA*B") == "[[19, 22], [43, 50]]"


def test_optional_surrounding_whitespace() -> None:
    assert _solve("  A = [[1,2],[3,4]]  \n  A  ") == "[[1, 2], [3, 4]]"


def test_later_assignment_can_reference_an_earlier_one() -> None:
    assert _solve("A=[[1,2],[3,4]]\nB=A^2\nB") == "[[7, 10], [15, 22]]"


def test_multi_character_variable_name() -> None:
    assert _solve("Matriz2=[[1,0],[0,1]]\nMatriz2") == "[[1, 0], [0, 1]]"


def test_assignment_right_hand_side_can_be_a_full_expression_not_just_a_literal() -> None:
    assert _solve("A=[[1,2],[3,4]] + [[1,1],[1,1]]\nA") == "[[2, 3], [4, 5]]"


# --- Validações ------------------------------------------------------


def test_undefined_variable_referenced_alongside_a_defined_one() -> None:
    with pytest.raises(ExpressionError, match="Variável 'B' não definida"):
        _solve("A=[[1,2],[3,4]]\nA+B")


def test_undefined_variable_alone_after_an_unrelated_assignment() -> None:
    with pytest.raises(ExpressionError, match="Variável 'B' não definida"):
        _solve("A=[[1,2],[3,4]]\nB")


def test_duplicate_variable_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="'A' já foi definida"):
        _solve("A=[[1,2],[3,4]]\nA=[[5,6],[7,8]]\nA")


def test_invalid_name_starting_with_digit_is_rejected() -> None:
    with pytest.raises(ExpressionError, match="[Nn]ome de variável inválido"):
        _solve("1A=[[1]]\n1A")


def test_lowercase_name_is_rejected_as_invalid_matrix_variable_name() -> None:
    # Minúsculo nunca é nome de variável de matriz (continua sendo
    # parâmetro escalar livre) — "a=[[...]]" não é uma atribuição válida.
    with pytest.raises(ExpressionError, match="[Nn]ome de variável inválido"):
        _solve("a=[[1,2],[3,4]]\na")


@pytest.mark.parametrize("name", ["Det", "DET", "Inv", "Transpose", "Trace", "Determinante"])
def test_reserved_name_case_insensitive_is_rejected(name: str) -> None:
    with pytest.raises(ExpressionError, match="nome reservado"):
        _solve(f"{name}=[[1,2],[3,4]]\n{name}")


def test_lowercase_reserved_word_hits_the_invalid_name_check_first() -> None:
    # "det" (minúsculo) nunca passa no padrão de nome (exige maiúscula
    # inicial) — cai no erro de nome inválido antes de chegar no de nome
    # reservado, que só é alcançável por um nome que JÁ é maiúsculo.
    with pytest.raises(ExpressionError, match="[Nn]ome de variável inválido"):
        _solve("det=[[1,2],[3,4]]\ndet")


def test_assignment_of_a_scalar_is_rejected() -> None:
    # "B=5" sozinho não tem "[[" em lugar nenhum do texto, então nem
    # entraria no domínio de matriz (ver
    # `test_bare_undefined_uppercase_reference_without_any_assignment_falls_back_to_algebra`
    # mais abaixo) — a matriz literal em "A=..." é o que garante que o
    # texto INTEIRO seja roteado para cá antes de "B=5" ser validado.
    with pytest.raises(ExpressionError, match="precisa ser uma matriz"):
        _solve("A=[[1,2],[3,4]]\nB=5\nA*B")


def test_assignment_missing_expression_is_rejected() -> None:
    with pytest.raises(ExpressionError):
        _solve("A=\nA")


# --- Ausência de estado entre chamadas --------------------------------


def test_no_state_persists_between_calls() -> None:
    # Define "A" com um valor bem distintivo numa chamada...
    assert _solve("A=[[9,9],[9,9]]\nA") == "[[9, 9], [9, 9]]"
    # ...e confirma que uma chamada SEGUINTE, que só define "B" e nunca
    # "A", não enxerga o "A" da chamada anterior — se algum estado tivesse
    # sobrevivido, isto teria retornado um resultado usando o [[9,9],[9,9]]
    # de cima em vez de levantar "não definida".
    with pytest.raises(ExpressionError, match="Variável 'A' não definida"):
        _solve("B=[[1,2],[3,4]]\nA*B")


def test_evaluate_matrix_program_never_leaks_environment_to_the_caller() -> None:
    program = parse_matrix_program("A=[[1,2],[3,4]]\nA")
    result = evaluate_matrix_program(program)
    assert result.shape == (2, 2)
    # `ProgramNode`/`evaluate_matrix_program` não expõem nenhum objeto de
    # ambiente para fora — só o valor final, confirmando que não há
    # nenhuma estrutura de estado sobrevivendo além do retorno.


# --- Árvore produzida (parsing) ----------------------------------------


def test_parse_matrix_program_with_no_assignments_matches_pre_v221_shape() -> None:
    program = parse_matrix_program("[[1,2],[3,4]] + [[5,6],[7,8]]")
    assert program.assignments == ()
    assert isinstance(program.expression, MatrixBinaryOpNode)


def test_parse_matrix_program_produces_assignment_nodes_in_order() -> None:
    program = parse_matrix_program("A=[[1,2],[3,4]]\nB=[[5,6],[7,8]]\nA*B")
    assert [assignment.name for assignment in program.assignments] == ["A", "B"]
    assert isinstance(program.assignments[0].matrix, MatrixLiteralNode)
    assert isinstance(program.expression, MatrixBinaryOpNode)
    assert isinstance(program, ProgramNode)
    assert isinstance(program.assignments[0], AssignmentNode)


def test_bare_uppercase_reference_parses_as_scalar_node_resolved_later() -> None:
    # A árvore em si não sabe se "A" é variável ou escalar — quem decide é
    # o `evaluator.py`, no momento em que o ambiente já existe.
    program = parse_matrix_program("A=[[1,2],[3,4]]\nA")
    assert isinstance(program.expression, ScalarNode)
    assert program.expression.text == "A"


def test_validate_assignment_is_matrix_rejects_scalar_directly() -> None:
    with pytest.raises(ExpressionError, match="precisa ser uma matriz"):
        validate_assignment_is_matrix("A", Integer(5))


def test_validate_assignment_is_matrix_accepts_and_returns_matrix() -> None:
    from sympy import Matrix

    matrix = Matrix([[Rational(1, 2)]])
    assert validate_assignment_is_matrix("A", matrix) is matrix


# --- Contrato HTTP -------------------------------------------------------


def test_solve_endpoint_preserves_multi_line_expression_verbatim(client: TestClient) -> None:
    expression = "A=[[1,2],[3,4]]\nB=[[5,6],[7,8]]\nA*B"
    response = client.post("/solve", json={"expression": expression})
    assert response.status_code == 200
    assert response.json() == {
        "expression": expression,
        "result": "[[19, 22], [43, 50]]",
        "approx": None,
    }


def test_solve_endpoint_accepts_semicolon_separated_program(client: TestClient) -> None:
    response = client.post(
        "/solve", json={"expression": "A=[[1,2],[3,4]]; det(A)"}
    )
    assert response.status_code == 200
    assert response.json()["result"] == "-2"


def test_solve_endpoint_returns_400_for_undefined_variable(client: TestClient) -> None:
    response = client.post("/solve", json={"expression": "A=[[1,2],[3,4]]\nA+B"})
    assert response.status_code == 400
    assert "não definida" in response.json()["detail"]


def test_solve_endpoint_returns_400_for_duplicate_variable(client: TestClient) -> None:
    response = client.post(
        "/solve", json={"expression": "A=[[1,2],[3,4]]\nA=[[5,6],[7,8]]\nA"}
    )
    assert response.status_code == 400
    assert "já foi definida" in response.json()["detail"]


# --- Não-regressão -------------------------------------------------------


def test_existing_single_statement_matrix_expressions_still_work() -> None:
    assert _solve("[[1,2],[3,4]] + [[5,6],[7,8]]") == "[[6, 8], [10, 12]]"
    assert _solve("det([[1,2],[3,4]])") == "-2"
    assert _solve("2 * [[1,2],[3,4]]") == "[[2, 4], [6, 8]]"


def test_lowercase_free_symbol_still_works_exactly_as_before() -> None:
    # "a" minúsculo continua sendo parâmetro escalar livre — não entra no
    # namespace de variável de matriz, comportamento 100% intocado.
    assert _solve("a * [[1,2],[3,4]]") == "[[a, 2a], [3a, 4a]]"
    assert _solve("det([[a, 1],[0, a]])") == "a²"


def test_existing_algebra_still_works() -> None:
    assert _solve("2+2") == "4"


def test_existing_summation_still_works() -> None:
    assert _solve("Σ(i=1..10) i") == "55"


def test_existing_calculus_still_works() -> None:
    assert _solve("integral(x**2, x)") == "Integral: x³/3 + C"


def test_existing_equations_still_work() -> None:
    assert _solve("x**2 - 4 = 0") == "x₁ = -2, x₂ = 2"


def test_bare_undefined_uppercase_reference_without_any_assignment_falls_back_to_algebra() -> None:
    # Decisão consciente de escopo (ver relatório da sprint): sem NENHUMA
    # atribuição no texto, "A+B" não tem nenhum marcador que o distinga de
    # dois símbolos livres de álgebra comuns (o motor de matrizes só entra
    # em cena quando há "[[" ou uma chamada de função conhecida) — tratar
    # isso como matriz exigiria a detecção de domínio "sequestrar" QUALQUER
    # letra maiúscula solta em QUALQUER expressão, quebrando uso pré-
    # existente de símbolos maiúsculos em álgebra/equações/funções. Dentro
    # de um programa que JÁ tem alguma atribuição, o comportamento correto
    # (variável indefinida) já é coberto pelos testes acima.
    assert _solve("A+B") == "A + B"
