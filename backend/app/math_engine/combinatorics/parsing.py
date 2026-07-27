r"""Sprint V2.7 — reconhecimento léxico do Motor de Combinatória.

Sintaxe própria, sem notação algébrica livre — mesmo padrão de
`polynomials/parsing.py` (cada operação é uma chamada nomeada explícita,
ancorada nas duas pontas, nunca "adivinhada" no meio de uma expressão):

    fatorial(n)                     (fat)
    permutacao(n)                   (permutação, P)
    arranjo(n, k)                   (A)
    combinacao(n, k)                (combinação, C)
    permutacao_repeticao(n, a, b, ...)  (permutação_repetição e formas mistas)

Aliases acentuados entram por tabela literal (padrão `raízes`/`divisão` da
V2.6): `parser/normalize.py` não remove acentos, e a whitelist de
`safe_parsing.py` rejeitaria `ç`/`ã` — então o acento precisa ser consumido
aqui, pelo regex ancorado, antes de qualquer parse. Só o texto DENTRO dos
parênteses chega a `safe_parse_expr`.

`C`/`A`/`P` (maiúsculas, notação de livro didático) são aceitos porque são
exatamente as cabeças que o formatter devolve na dedução simbólica
("C(10,3) = 10!/(3!*7!) = 120") — assim o resultado é round-trip: qualquer
pedaço da dedução pode ser digitado de volta. Antes da V2.7 as três formas
eram erro de interpretação, então não há mudança de comportamento existente.
Minúsculas ficam de fora de propósito ("a(1,2)" pertence à álgebra livre).
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

# Alias digitável -> nome canônico da operação. Alternativas mais longas
# primeiro no regex (ver abaixo) para "permutacao_repeticao" nunca parar em
# "permutacao" e "fatorial" nunca parar em "fat".
CANONICAL_OPERATIONS: dict[str, str] = {
    "fatorial": "fatorial",
    "fat": "fatorial",
    "permutacao_repeticao": "permutacao_repeticao",
    "permutação_repetição": "permutacao_repeticao",
    "permutacao_repetição": "permutacao_repeticao",
    "permutação_repeticao": "permutacao_repeticao",
    "permutacao": "permutacao",
    "permutação": "permutacao",
    "P": "permutacao",
    "arranjo": "arranjo",
    "A": "arranjo",
    "combinacao": "combinacao",
    "combinação": "combinacao",
    "C": "combinacao",
}

_CALL_PATTERN = re.compile(
    r"^\s*("
    + "|".join(
        re.escape(name)
        for name in sorted(CANONICAL_OPERATIONS, key=len, reverse=True)
    )
    + r")\s*\((.*)\)\s*$",
    re.DOTALL,
)


def match_combinatorics_call(expression: str) -> tuple[str, str] | None:
    """Devolve (operação canônica, texto dos argumentos) ou None."""
    match = _CALL_PATTERN.match(expression)
    if match is None:
        return None
    return CANONICAL_OPERATIONS[match.group(1)], match.group(2)


def split_top_level_args(text: str) -> list[str]:
    """Divide argumentos por vírgula de nível mais alto (cópia deliberada do
    padrão das outras áreas — cada área do motor é self-contained)."""
    parts: list[str] = []
    current: list[str] = []
    depth = 0
    for char in text:
        if char in "([{":
            depth += 1
        elif char in ")]}":
            depth -= 1
        if char == "," and depth == 0:
            parts.append("".join(current))
            current = []
        else:
            current.append(char)
    parts.append("".join(current))
    return [part.strip() for part in parts]


def parse_combinatorics_fragment(text: str) -> Expr:
    """Parse seguro de UM argumento (esperado: um inteiro literal, mas
    expressões numéricas como "4+6" também resolvem — a validação semântica
    de `validation.py` é quem decide o que é aceito)."""
    local_dict = extract_safe_symbols(text)
    try:
        return safe_parse_expr(
            text, transformations=_TRANSFORMATIONS, local_dict=local_dict
        )
    except ExpressionError:
        raise
    except Exception as exc:
        raise ExpressionError(f"Não foi possível interpretar a expressão: {text}") from exc
