"""Sprint V2.2 — avaliação de uma árvore `MatrixNode` já parseada.

Reaproveita 100% da infraestrutura segura existente — mesmo padrão de
`summation/evaluator.py`: `safe_parse_expr`/`extract_safe_symbols`
(`safe_parsing.py`) para cada célula/escalar, e `log_convention.LOCAL_DICT`
para que "log"/"ln" dentro de uma célula sigam a mesma convenção do
produto (log = base 10, ln = natural) em vez do "log" nativo do SymPy
(natural). Nenhum `eval`/`exec`.

Cada nó da árvore vira ou um `sympy.Matrix` ou um `sympy.Expr` escalar —
o tipo runtime do resultado (`isinstance(..., MatrixBase)`) é o que decide
a semântica de cada operador binário, exatamente como o Python nativo
decide `__add__` por tipo em tempo de execução; nenhum "modo" é rastreado
à parte na árvore em si.
"""
from __future__ import annotations

from typing import Union

from sympy import Matrix
from sympy.core.expr import Expr
from sympy.matrices import MatrixBase

from ..errors import ExpressionError
from ..log_convention import LOCAL_DICT as _LOG_LOCAL_DICT
from ..safe_parsing import extract_safe_symbols, safe_parse_expr
from .parsing import (
    MatrixBinaryOpNode,
    MatrixCallNode,
    MatrixLiteralNode,
    MatrixNode,
    ScalarNode,
)
from .validation import (
    validate_invertible,
    validate_matrix_shape,
    validate_multipliable,
    validate_power_exponent,
    validate_same_shape,
    validate_square,
)

MatrixValue = Union[MatrixBase, Expr]

_FUNCTION_SUBJECTS = {
    "det": "O determinante",
    "trace": "O traço",
}


def _evaluate_cell(text: str) -> Expr:
    """Um texto de célula/escalar ("3", "1/2", "a", "ln(2)"...) -> `Expr`.
    Mesma técnica de `summation/evaluator.py:parse_summation_body`: símbolos
    livres de uma letra são descobertos ANTES do parse (`extract_safe_symbols`)
    e entram no `local_dict` junto da convenção log/ln — nunca dependem do
    fallback implícito do SymPy."""
    extra_symbols = extract_safe_symbols(text, exclude=set(_LOG_LOCAL_DICT))
    local_dict = {**_LOG_LOCAL_DICT, **extra_symbols}
    try:
        return safe_parse_expr(text, local_dict=local_dict)
    except ExpressionError:
        raise
    except Exception as exc:
        raise ExpressionError(f"Elemento inválido na matriz: '{text}'.") from exc


def _evaluate_literal(node: MatrixLiteralNode) -> MatrixBase:
    data = [[_evaluate_cell(cell) for cell in row] for row in node.rows]
    matrix = Matrix(data)
    validate_matrix_shape(matrix)
    return matrix


def _evaluate_call(node: MatrixCallNode) -> MatrixValue:
    operand = evaluate_matrix_node(node.argument)
    if not isinstance(operand, MatrixBase):
        raise ExpressionError(f"'{node.name}' espera uma matriz como argumento.")

    if node.name in _FUNCTION_SUBJECTS:
        validate_square(operand, _FUNCTION_SUBJECTS[node.name])

    if node.name == "det":
        return operand.det()
    if node.name == "trace":
        return operand.trace()
    if node.name == "transpose":
        return operand.T
    if node.name == "inv":
        validate_invertible(operand)
        return operand.inv()
    raise ExpressionError(f"Função de matriz desconhecida: '{node.name}'.")


_ADDITIVE_OPERATION_LABELS = {"+": "somar", "-": "subtrair"}


def _evaluate_binary(node: MatrixBinaryOpNode) -> MatrixValue:
    left = evaluate_matrix_node(node.left)
    right = evaluate_matrix_node(node.right)
    left_is_matrix = isinstance(left, MatrixBase)
    right_is_matrix = isinstance(right, MatrixBase)

    if node.operator in ("+", "-"):
        if left_is_matrix != right_is_matrix:
            raise ExpressionError(
                "Não é possível somar/subtrair uma matriz com um escalar."
            )
        if left_is_matrix and right_is_matrix:
            validate_same_shape(left, right, _ADDITIVE_OPERATION_LABELS[node.operator])
        return left + right if node.operator == "+" else left - right

    if node.operator == "*":
        if left_is_matrix and right_is_matrix:
            validate_multipliable(left, right)
        return left * right

    if node.operator == "^":
        if right_is_matrix:
            raise ExpressionError(
                "O expoente de uma potência de matriz não pode ser uma matriz."
            )
        if not left_is_matrix:
            return left**right
        exponent = validate_power_exponent(right)
        validate_square(left, "Potência de matriz")
        try:
            return left**exponent
        except Exception as exc:
            raise ExpressionError(
                f"Não foi possível calcular a potência da matriz: {exc}"
            ) from exc

    raise ExpressionError(f"Operador desconhecido: '{node.operator}'.")


def evaluate_matrix_node(node: MatrixNode) -> MatrixValue:
    if isinstance(node, MatrixLiteralNode):
        return _evaluate_literal(node)
    if isinstance(node, ScalarNode):
        return _evaluate_cell(node.text)
    if isinstance(node, MatrixCallNode):
        return _evaluate_call(node)
    if isinstance(node, MatrixBinaryOpNode):
        return _evaluate_binary(node)
    raise ExpressionError("Nó de matriz desconhecido.")
