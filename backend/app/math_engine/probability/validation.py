"""Sprint V2.8 — validações semânticas do Motor de Probabilidade.

Reutiliza de `combinatorics/validation.py` (mensagens já genéricas,
parametrizadas por `role`/`operation`, sem vocabulário específico de
combinatória): `as_nonnegative_int` (favoráveis/total/n/k — sempre
inteiros, nunca decimais aqui) e `reject_decimal_literal` (mesmo papel:
mensagem amigável para "2.5" quando um inteiro é esperado). `binomial(...)`
também reutiliza `require_k_at_most_n` — a mesma relação C(n,k) da
combinatória, vocabulário "escolher k de n" se aplica sem adaptação.

O que é próprio deste domínio (probabilidade em si — inteiros não bastam,
mas números, positivos, entre 0 e 1) fica aqui.
"""
from __future__ import annotations

from sympy.core.expr import Expr

from ..errors import ExpressionError
from .formatter import format_decimal

# Reexportados para o dispatcher poder importar tudo de um único módulo de
# validação, sem precisar saber que parte vem de `combinatorics/`.
from ..combinatorics.validation import (  # noqa: F401
    as_nonnegative_int,
    reject_decimal_literal,
    require_k_at_most_n,
)


def as_number(expr: Expr, role: str, operation: str) -> Expr:
    """Converte um argumento em número do SymPy ou explica por que não dá."""
    if not expr.is_number:
        raise ExpressionError(
            f"{operation} só aceita números como argumento — recebido "
            f"{role} = {expr}, que não é um número."
        )
    return expr


def as_probability(expr: Expr, role: str, operation: str) -> Expr:
    """Converte um argumento em probabilidade válida (número entre 0 e 1)."""
    value = as_number(expr, role, operation)
    if value < 0:
        raise ExpressionError(
            f"{operation} não está definida para probabilidades negativas — "
            f"recebido {role} = {format_decimal(value)}. Use um valor entre 0 e 1."
        )
    if value > 1:
        raise ExpressionError(
            f"{operation} exige probabilidades entre 0 e 1 — recebido "
            f"{role} = {format_decimal(value)}, maior que 1."
        )
    return value


def require_total_positive(total: int, operation: str) -> None:
    if total == 0:
        raise ExpressionError(
            f"{operation} exige total > 0 — recebido total = 0. O número de "
            "casos possíveis não pode ser zero."
        )


def require_favoraveis_within_total(favoraveis: int, total: int, operation: str) -> None:
    if favoraveis > total:
        raise ExpressionError(
            f"{operation} exige favoráveis ≤ total — recebido favoráveis = "
            f"{favoraveis} maior que total = {total}. Não é possível ter mais "
            "casos favoráveis do que casos possíveis."
        )


def require_nonzero(value: Expr, role: str, operation: str) -> None:
    if value == 0:
        raise ExpressionError(
            f"{operation} não está definida para {role} = 0 — divisão por zero."
        )
