"""Sprint V2.2 — validações semânticas do Motor de Matrizes.

Erros de SINTAXE (colchetes desbalanceados, matriz vazia, linhas de
tamanhos diferentes, elemento vazio) já são rejeitados em `parsing.py`,
antes de qualquer `sympy.Matrix` existir — mesma divisão de
responsabilidade de `summation/validation.py` vs. `summation/parsing.py`.

Este módulo cobre as validações que só fazem sentido sobre matrizes (e
expoentes) JÁ AVALIADOS — chamado por `evaluator.py` no momento exato de
cada operação, nunca antes (dimensões/quadrado/inversibilidade só existem
depois que os operandos, que podem ser expressões arbitrárias, já viraram
`sympy.Matrix`/`sympy.Expr` concretos)."""
from __future__ import annotations

from sympy.core.expr import Expr
from sympy.matrices import MatrixBase

from ..errors import ExpressionError

# Guarda de segurança, mesmo espírito de `summation/validation.py:MAX_TERMS`
# — nenhum caso didático do MVP precisa de matrizes maiores que isso, e sem
# um teto uma entrada adversarial poderia forçar operações (ex. inversão)
# caras o bastante para pressionar o timeout global sem necessidade.
MAX_DIMENSION = 20

# Mesmo raciocínio para o expoente de uma potência de matriz — sem teto,
# "[[1,0],[0,1]] ^ 1000000" força SymPy a fazer exponenciação repetida de
# matriz sem nenhum ganho didático.
MAX_MATRIX_POWER = 100


def validate_matrix_shape(matrix: MatrixBase) -> None:
    if matrix.rows > MAX_DIMENSION or matrix.cols > MAX_DIMENSION:
        raise ExpressionError(
            f"A matriz não pode ter mais de {MAX_DIMENSION} linhas ou colunas."
        )


def validate_same_shape(left: MatrixBase, right: MatrixBase, operation: str) -> None:
    if left.shape != right.shape:
        raise ExpressionError(
            f"Não é possível {operation} matrizes de dimensões diferentes "
            f"({left.rows}x{left.cols} e {right.rows}x{right.cols})."
        )


def validate_multipliable(left: MatrixBase, right: MatrixBase) -> None:
    if left.cols != right.rows:
        raise ExpressionError(
            "Não é possível multiplicar matrizes com dimensões incompatíveis "
            f"({left.rows}x{left.cols} e {right.rows}x{right.cols}) — o número de "
            "colunas da primeira precisa ser igual ao número de linhas da segunda."
        )


def validate_square(matrix: MatrixBase, subject: str) -> None:
    if matrix.rows != matrix.cols:
        raise ExpressionError(
            f"{subject} exige uma matriz quadrada (recebida: {matrix.rows}x{matrix.cols})."
        )


def validate_invertible(matrix: MatrixBase) -> None:
    validate_square(matrix, "A inversa")
    if matrix.det() == 0:
        raise ExpressionError("A matriz é singular (determinante zero) — não tem inversa.")


def validate_power_exponent(exponent: Expr) -> int:
    if not exponent.is_Integer:
        raise ExpressionError(
            "O expoente de uma potência de matriz precisa ser um número inteiro."
        )
    value = int(exponent)
    if value < 0:
        raise ExpressionError(
            "Esta versão não calcula potências negativas de matriz — use inv(...) "
            "para a inversa."
        )
    if value > MAX_MATRIX_POWER:
        raise ExpressionError(
            f"O expoente de uma potência de matriz não pode ser maior que {MAX_MATRIX_POWER}."
        )
    return value
