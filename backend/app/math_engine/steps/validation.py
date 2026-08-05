"""Sprint V2.9 — mensagens amigáveis e guards compartilhados entre
`linear_equations.py`/`linear_systems.py`/`dispatcher.py`. Nenhuma lógica
de resolução mora aqui — só decisões de "isto está dentro do escopo desta
primeira versão?", sempre terminando em `ExpressionError` (nunca uma
exceção interna do SymPy/Python vazando, mesmo contrato de
`safe_parsing.py`)."""
from __future__ import annotations

from sympy import degree

from ..errors import ExpressionError

UNSUPPORTED_DOMAIN_MESSAGE = (
    "Passo a passo disponível apenas para equações lineares de uma incógnita "
    "e sistemas lineares 2x2 nesta versão."
)
UNSUPPORTED_EQUATION_MESSAGE = (
    "Passo a passo disponível apenas para equações lineares de uma única "
    "incógnita nesta versão."
)
UNSUPPORTED_INEQUALITY_MESSAGE = (
    "Passo a passo ainda não está disponível para inequações nesta versão."
)
UNSUPPORTED_SYSTEM_MESSAGE = (
    "Passo a passo disponível apenas para sistemas lineares 2x2 nesta versão."
)
TOO_MANY_UNKNOWNS_MESSAGE = (
    "Passo a passo ainda não disponível para sistemas com mais de duas incógnitas."
)
EMPTY_EXPRESSION_MESSAGE = "A expressão não pode estar vazia."


def require_single_symbol(symbols: set) -> None:
    if len(symbols) != 1:
        raise ExpressionError(UNSUPPORTED_EQUATION_MESSAGE)


def require_linear_degree(diff, symbol) -> None:
    """`diff` é `lhs - rhs` já expandido. Sem símbolo nenhum sobrando =
    identidade/contradição (grau é irrelevante, tratado à parte por
    `linear_equations.reduce_to_value`); com símbolo, exige grau exatamente
    1 — grau >= 2 (ou não-polinomial, capturado pela exceção) fica fora do
    escopo desta sprint."""
    if not diff.free_symbols:
        return
    try:
        grau = degree(diff, symbol)
    except Exception as exc:
        raise ExpressionError(UNSUPPORTED_EQUATION_MESSAGE) from exc
    if grau != 1:
        raise ExpressionError(UNSUPPORTED_EQUATION_MESSAGE)
