"""Sprint V2.1 — validações de domínio do `SummationNode` já parseado.

Erros de SINTAXE (variável inválida, limites não inteiros, cabeçalho mal
formado) já são rejeitados em `parsing.py`, antes de um `SummationNode`
sequer existir. Este módulo cobre as validações que só fazem sentido depois
que os dois limites já são inteiros conhecidos: ordem dos limites e
tamanho do intervalo.
"""
from __future__ import annotations

from ..errors import ExpressionError
from .parsing import SummationNode

MAX_TERMS = 10_000


def validate_summation_node(node: SummationNode) -> None:
    if node.lower > node.upper:
        raise ExpressionError(
            "O limite inferior do somatório não pode ser maior que o limite superior."
        )

    term_count = node.upper - node.lower + 1
    if term_count > MAX_TERMS:
        raise ExpressionError(
            f"O somatório não pode ter mais de {MAX_TERMS:,} termos.".replace(",", ".")
        )
