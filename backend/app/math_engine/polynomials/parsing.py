r"""Sprint V2.6 — Motor de Polinômios Avançados: reconhecimento léxico das
sete operações e extração dos argumentos.

Sintaxe (nomes canônicos, aliases PT-BR/ASCII entre parênteses):

    fatorar(expr)
    expandir(expr)
    simplificar(expr)
    grau(expr)
    coeficientes(expr)
    raizes(expr)                    (raízes)
    divisao(dividendo, divisor)     (divisão)

Cada chamada precisa ser a expressão INTEIRA (mesmo padrão ancorado de
`calculus/dispatcher.py:_CALL_PATTERN` — "^...(...)$" nas duas pontas),
nunca uma sub-chamada composta com outra operação: "fatorar(x²-9)" é
reconhecido, "2*fatorar(x²-9)" não é (cai no fallback de álgebra, que
rejeita "fatorar" como identificador de múltiplas letras desconhecido —
erro claro em vez de um resultado adivinhado).

Entra na cascata de `math_engine/dispatcher.py` logo depois de `complex` e
ANTES de `calculus`/`functions`/`trigonometry`/`logarithms`/`equations`
pelo mesmo motivo que já justifica a posição de `calculus`: o argumento de
qualquer uma destas sete chamadas pode conter livremente "sin(", "log(",
"=" etc., que essas áreas casariam por `.search()`/regex no texto inteiro
se checadas antes.
"""
from __future__ import annotations

import re

from sympy.core.expr import Expr
from sympy.parsing.sympy_parser import (
    implicit_multiplication_application,
    standard_transformations,
)

from ..errors import ExpressionError
from ..safe_parsing import extract_safe_symbols, safe_parse_expr

_TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application,)

# Nome digitado -> nome canônico ASCII usado internamente por
# `dispatcher.py` — mesmo padrão de `matrix/parsing.py:CANONICAL_FUNCTION_NAMES`
# / `complex/parsing.py:CANONICAL_FUNCTION_NAMES`. "raízes"/"divisão" (com
# acento) e "raizes"/"divisao" (ASCII) são o MESMO comando — o acento nunca
# chega a `safe_parse_expr` porque é consumido aqui, antes do parse do
# argumento (só o texto DENTRO dos parênteses é parseado).
CANONICAL_OPERATIONS: dict[str, str] = {
    "fatorar": "fatorar",
    "expandir": "expandir",
    "simplificar": "simplificar",
    "grau": "grau",
    "coeficientes": "coeficientes",
    "raizes": "raizes",
    "raízes": "raizes",
    "divisao": "divisao",
    "divisão": "divisao",
}

_CALL_PATTERN = re.compile(
    r"^\s*(" + "|".join(re.escape(name) for name in CANONICAL_OPERATIONS) + r")\s*\((.*)\)\s*$",
    re.DOTALL,
)


def match_polynomial_call(expression: str) -> tuple[str, str] | None:
    """(operação canônica, texto cru do(s) argumento(s)) ou `None` se
    `expression` não for, INTEIRA, uma chamada a uma das sete operações."""
    match = _CALL_PATTERN.match(expression)
    if match is None:
        return None
    nome, argumentos = match.groups()
    return CANONICAL_OPERATIONS[nome], argumentos


def split_top_level_args(text: str) -> list[str]:
    """Mesma técnica de bracket-counting de
    `calculus/dispatcher.py:_split_top_level_args` — duplicada aqui
    deliberadamente (cada área do motor é self-contained). Usada só por
    `divisao(dividendo, divisor)`, a única operação com 2 argumentos."""
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


def parse_polynomial_fragment(text: str) -> Expr:
    """Parâmetros livres (ex. o "a"/"b"/"c" de "a*x**2+b*x+c") são
    descobertos explicitamente ANTES do parse, mesmo padrão de
    `calculus/dispatcher.py:_parse_fragment` — sem convenção log/ln
    (log_convention.py): esta área é puramente algébrica, o mesmo escopo
    já usado pelo fallback de `algebra/dispatcher.py`."""
    local_dict = extract_safe_symbols(text)
    try:
        return safe_parse_expr(text, transformations=_TRANSFORMATIONS, local_dict=local_dict)
    except ExpressionError:
        raise
    except Exception as exc:
        raise ExpressionError(f"Não foi possível interpretar a expressão: {text}") from exc
