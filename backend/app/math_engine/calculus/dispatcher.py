r"""Sprint 12 — dispatcher de cálculo (derivada, integral, limite).

Sintaxe própria, sem notação algébrica livre — mesmo padrão de
`analytic_geometry/` (cada operação é uma chamada nomeada explícita):

    derivada(expr, var)
    integral(expr, var)                        -> indefinida, "+ C" só na apresentação
    integral(expr, var, inferior, superior)     -> definida
    limite(expr, var, ponto)                    -> bilateral (ver limits.py)

Notação livre (d/dx, ∫...dx, lim_{x->0}) exigiria gramática nova, fora do
escopo desta sprint (reservada para o futuro Parser Inteligente); "->"/">"
também colidiriam com o roteador de equações (`_INEQUALITY_PATTERN`) — a
sintaxe por vírgula evita isso por completo.

Cálculo entra na cascata de `math_engine/dispatcher.py` ANTES de
`functions`/`trigonometry`/`logarithms`/`equations`: essas áreas decidem por
`.search()` livre no texto inteiro (ex. "\bsin\(" em qualquer posição da
string) — uma chamada como `integral(sin(x), x)` seria roubada por
`trigonometry` se cálculo fosse verificado depois. Ver auditoria da
Sprint 12.

Convenção do produto log=base10/ln=natural (`log_convention.py`) é aplicada
sempre ao corpo de qualquer operação de cálculo (decisão explícita da
Sprint 12) — diferente de `functions/`, que só aplica a convenção às 4
formas canônicas por um motivo de escopo específico daquela área que não
existe aqui.
"""
from __future__ import annotations

import re

from sympy import Symbol
from sympy.parsing.sympy_parser import (
    implicit_multiplication_application,
    standard_transformations,
)

from ..errors import ExpressionError
from ..log_convention import LOCAL_DICT as _LOG_LOCAL_DICT
from ..safe_parsing import safe_parse_expr
from .derivatives import compute_derivative
from .integrals import compute_definite_integral, compute_indefinite_integral
from .limits import compute_limit

_TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application,)

_CALL_PATTERN = re.compile(r"^\s*(derivada|integral|limite)\s*\((.*)\)\s*$", re.DOTALL)
_VARIABLE_PATTERN = re.compile(r"^[a-zA-Z_]\w*$")

# "log(" nativo do SymPy que sobreviver na saída é sempre log natural (a
# nossa base 10 nunca aparece como um nó "log(...)" isolado — mesmo
# raciocínio já usado por `logarithms/dispatcher.py`/`functions/dispatcher.py`).
_NATURAL_LOG_PATTERN = re.compile(r"\blog(?=\()")


def _rename_natural_log(text: str) -> str:
    return _NATURAL_LOG_PATTERN.sub("ln", text)


def is_calculus_domain_expression(expression: str) -> bool:
    return bool(_CALL_PATTERN.match(expression))


def _split_top_level_args(text: str) -> list[str]:
    """Mesma técnica de bracket-counting de `parser/normalize.py`/
    `formatter/safe_parse.py`, duplicada aqui deliberadamente — cada área do
    motor é self-contained (convenção registrada desde a Sprint 4/9)."""
    parts: list[str] = []
    depth = 0
    current: list[str] = []
    for char in text:
        if char in "([{":
            depth += 1
        elif char in ")]}":
            depth -= 1
        if char == "," and depth == 0:
            parts.append("".join(current))
            current = []
            continue
        current.append(char)
    parts.append("".join(current))
    return [part.strip() for part in parts]


def _parse_variable(text: str) -> Symbol:
    if not _VARIABLE_PATTERN.match(text):
        raise ExpressionError(f"Nome de variável inválido: '{text}'.")
    return Symbol(text)


def _parse_fragment(text: str, symbol: Symbol):
    local_dict = {symbol.name: symbol, **_LOG_LOCAL_DICT}
    try:
        return safe_parse_expr(text, transformations=_TRANSFORMATIONS, local_dict=local_dict)
    except Exception as exc:
        raise ExpressionError(f"Não foi possível interpretar a expressão: {text}") from exc


def solve_calculus_text(expression: str) -> str:
    match = _CALL_PATTERN.match(expression)
    if not match:
        raise ExpressionError(f"Não foi possível interpretar a expressão: {expression}")

    operacao, argumentos = match.groups()
    partes = _split_top_level_args(argumentos)

    if operacao == "derivada":
        if len(partes) != 2:
            raise ExpressionError(
                "derivada(...) espera exatamente 2 argumentos: expressão e variável."
            )
        symbol = _parse_variable(partes[1])
        expr = _parse_fragment(partes[0], symbol)
        resultado = compute_derivative(expr, symbol)
        return _rename_natural_log(f"Derivada: {resultado}")

    if operacao == "limite":
        if len(partes) != 3:
            raise ExpressionError(
                "limite(...) espera exatamente 3 argumentos: expressão, variável e ponto."
            )
        symbol = _parse_variable(partes[1])
        expr = _parse_fragment(partes[0], symbol)
        ponto = _parse_fragment(partes[2], symbol)
        resultado = compute_limit(expr, symbol, ponto)
        return _rename_natural_log(f"Limite: {resultado}")

    if operacao == "integral":
        if len(partes) == 2:
            symbol = _parse_variable(partes[1])
            expr = _parse_fragment(partes[0], symbol)
            resultado = compute_indefinite_integral(expr, symbol)
            return _rename_natural_log(f"Integral: {resultado} + C")
        if len(partes) == 4:
            symbol = _parse_variable(partes[1])
            expr = _parse_fragment(partes[0], symbol)
            inferior = _parse_fragment(partes[2], symbol)
            superior = _parse_fragment(partes[3], symbol)
            resultado = compute_definite_integral(expr, symbol, inferior, superior)
            return _rename_natural_log(f"Integral definida: {resultado}")
        raise ExpressionError(
            "integral(...) espera 2 argumentos (indefinida) ou 4 argumentos (definida)."
        )

    raise ExpressionError(f"Operação de cálculo não reconhecida: {operacao}")
