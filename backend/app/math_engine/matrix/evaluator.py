"""Sprint V2.2 — avaliação de uma árvore `MatrixNode` já parseada. Sprint
V2.2.1 (Variáveis Locais para Matrizes) — avaliação de um `ProgramNode`
inteiro (atribuições + expressão final).

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

`Environment` (Sprint V2.2.1) é um simples `dict[str, MatrixBase]` LOCAL —
`evaluate_matrix_program` cria um, passa por parâmetro através de toda a
recursão (`evaluate_matrix_node`/`_evaluate_binary`/`_evaluate_call`) e
descarta ao retornar. Nenhum estado global, nenhuma variável de módulo —
o ambiente de uma requisição nunca é visível a outra."""
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
    ProgramNode,
    ScalarNode,
)
from .validation import (
    validate_assignment_is_matrix,
    validate_invertible,
    validate_matrix_shape,
    validate_multipliable,
    validate_power_exponent,
    validate_same_shape,
    validate_square,
)

MatrixValue = Union[MatrixBase, Expr]
Environment = dict[str, MatrixBase]

_FUNCTION_SUBJECTS = {
    "det": "O determinante",
    "trace": "O traço",
}

# Mesma regra de `parsing.py:_NAME_PATTERN` (duplicada aqui deliberadamente
# — cada módulo desta área é self-contained): um identificador que COMEÇA
# com maiúscula está no namespace de variável de matriz. Se não estiver no
# ambiente local, é "não definida" — nunca vira parâmetro escalar livre
# por engano (diferente de um identificador minúsculo, que continua 100%
# como antes).
def _looks_like_matrix_variable_name(text: str) -> bool:
    return text[:1].isupper()


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


def _evaluate_call(node: MatrixCallNode, environment: Environment) -> MatrixValue:
    operand = evaluate_matrix_node(node.argument, environment)
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


def _evaluate_binary(node: MatrixBinaryOpNode, environment: Environment) -> MatrixValue:
    left = evaluate_matrix_node(node.left, environment)
    right = evaluate_matrix_node(node.right, environment)
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


def evaluate_matrix_node(node: MatrixNode, environment: Environment | None = None) -> MatrixValue:
    """`environment` (Sprint V2.2.1) é opcional e vazio por padrão —
    100% das chamadas da Sprint V2.2 (sem nenhuma atribuição no programa)
    continuam funcionando sem qualquer mudança de comportamento."""
    env = environment if environment is not None else {}

    if isinstance(node, MatrixLiteralNode):
        return _evaluate_literal(node)
    if isinstance(node, ScalarNode):
        if node.text in env:
            return env[node.text]
        if _looks_like_matrix_variable_name(node.text):
            raise ExpressionError(f"Variável '{node.text}' não definida.")
        return _evaluate_cell(node.text)
    if isinstance(node, MatrixCallNode):
        return _evaluate_call(node, env)
    if isinstance(node, MatrixBinaryOpNode):
        return _evaluate_binary(node, env)
    raise ExpressionError("Nó de matriz desconhecido.")


def evaluate_matrix_program(program: ProgramNode) -> MatrixValue:
    """Avalia um `ProgramNode` inteiro (Sprint V2.2.1) — cria o ambiente
    local, avalia cada atribuição NA ORDEM em que aparece (uma atribuição
    posterior pode referenciar uma variável já definida antes dela, ex.
    "A=[[1,2],[3,4]]\\nB=A^2\\nB"), valida que cada valor atribuído é
    realmente uma matriz, e por fim avalia a expressão final com esse
    ambiente já completo. `environment` é uma variável local desta função
    — nunca sobrevive além do `return`, nenhum estado entre requisições."""
    environment: Environment = {}
    for assignment in program.assignments:
        value = evaluate_matrix_node(assignment.matrix, environment)
        environment[assignment.name] = validate_assignment_is_matrix(assignment.name, value)

    return evaluate_matrix_node(program.expression, environment)
