"""Sprint V2.7 — validações semânticas do Motor de Combinatória.

Só validação PÓS-parse (mesmo papel de `polynomials/validation.py`): os
argumentos já chegam como `Expr` do SymPy; aqui se decide o que é aceito
(apenas inteiros não negativos) com mensagens amigáveis em PT-BR — cada
mensagem vira literalmente o `detail` do HTTP 400 (ver `app/main.py`).
"""
from __future__ import annotations

from sympy.core.expr import Expr

from ..errors import ExpressionError


def reject_decimal_literal(text: str, role: str, operation: str) -> None:
    """Mensagem amigável para "2.5" ANTES do parse: a whitelist global de
    `safe_parsing.py` nem sequer aceita o caractere "." (produto de
    aritmética exata), então sem esta checagem o usuário receberia o
    genérico "Não foi possível interpretar a expressão: 2.5"."""
    if "." in text:
        raise ExpressionError(
            f"{operation} só está definida para números inteiros — "
            f"recebido {role} = {text}. Use um inteiro sem casas decimais."
        )


def as_nonnegative_int(expr: Expr, role: str, operation: str) -> int:
    """Converte um argumento em inteiro >= 0 ou explica por que não dá."""
    if not expr.is_Integer:
        if expr.is_number:
            raise ExpressionError(
                f"{operation} só está definida para números inteiros — "
                f"recebido {role} = {expr}. Use um inteiro sem casas decimais."
            )
        raise ExpressionError(
            f"{operation} só aceita números inteiros como argumento — "
            f"recebido {role} = {expr}, que não é um número."
        )
    value = int(expr)
    if value < 0:
        raise ExpressionError(
            f"{operation} não está definida para números negativos — "
            f"recebido {role} = {value}. Use um inteiro maior ou igual a zero."
        )
    return value


def require_k_at_most_n(n: int, k: int, operation: str) -> None:
    if k > n:
        raise ExpressionError(
            f"{operation} exige k ≤ n — recebido k = {k} maior que n = {n}. "
            "Não é possível escolher mais elementos do que o total disponível."
        )


def require_repetitions_fit(n: int, repetitions: list[int]) -> None:
    total = sum(repetitions)
    if total > n:
        soma = " + ".join(str(r) for r in repetitions)
        raise ExpressionError(
            "permutação_repetição(...) exige que a soma das repetições não "
            f"ultrapasse n — recebido n = {n} e repetições somando "
            f"{soma} = {total}."
        )
