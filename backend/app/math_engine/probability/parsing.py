r"""Sprint V2.8 — reconhecimento léxico do Motor de Probabilidade.

Mesmo padrão de `combinatorics/parsing.py`: sintaxe própria, sem notação
algébrica livre, cada operação é uma chamada nomeada explícita, ancorada
nas duas pontas:

    probabilidade(favoraveis, total)
    complementar(p)
    uniao(pa, pb, pinter)
    intersecao_independente(pa, pb)
    condicional(pinter, pb)
    independentes(pa, pb, pinter)
    binomial(n, k, p)

Sem aliases acentuados (nenhum nome do vocabulário acima leva acento) e
sem apelidos de livro didático (diferente de C/A/P em combinatória, não há
letra maiúscula isolada consagrada para estas operações) — todo o
vocabulário já é a forma canônica.

Único desvio real de `combinatorics/parsing.py`: as `_TRANSFORMATIONS`
incluem `rationalize`, porque os argumentos aqui são frequentemente
literais decimais ("0.3", "0.5"), nunca só inteiros. `rationalize` converte
o literal para uma fração exata do SymPy (`Rational`) em vez de um `Float`
de ponto flutuante — sem isso, `0.4+0.5-0.2` fecharia em
`0.7000000000000001` (erro de arredondamento binário), não `0.7`. Testado
empiricamente: com `rationalize`, `parse_expr("0.3")` devolve `3/10` exato.
"""
from __future__ import annotations

import re

from sympy.core.expr import Expr
from sympy.parsing.sympy_parser import (
    implicit_multiplication_application,
    rationalize,
    standard_transformations,
)

from ..errors import ExpressionError
from ..safe_parsing import extract_safe_symbols, safe_parse_expr

_TRANSFORMATIONS = standard_transformations + (
    implicit_multiplication_application,
    rationalize,
)

CANONICAL_OPERATIONS: dict[str, str] = {
    "probabilidade": "probabilidade",
    "complementar": "complementar",
    "uniao": "uniao",
    "intersecao_independente": "intersecao_independente",
    "condicional": "condicional",
    "independentes": "independentes",
    "binomial": "binomial",
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


def match_probability_call(expression: str) -> tuple[str, str] | None:
    """Devolve (operação canônica, texto dos argumentos) ou None."""
    match = _CALL_PATTERN.match(expression)
    if match is None:
        return None
    return CANONICAL_OPERATIONS[match.group(1)], match.group(2)


def split_top_level_args(text: str) -> list[str]:
    """Divide argumentos por vírgula de nível mais alto (cópia deliberada do
    padrão das outras áreas — cada área do motor é self-contained, ver
    `combinatorics/parsing.py`)."""
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


def parse_probability_fragment(text: str) -> Expr:
    """Parse seguro de UM argumento — inteiro ou decimal literal (ex.
    "3", "0.3", "1-0.2"). Decimais viram `Rational` exato via
    `rationalize` (ver docstring do módulo); a validação semântica de
    `validation.py` é quem decide o que é aceito para cada papel
    (inteiro não negativo, probabilidade em [0,1] etc.)."""
    local_dict = extract_safe_symbols(text)
    try:
        return safe_parse_expr(
            text, transformations=_TRANSFORMATIONS, local_dict=local_dict
        )
    except ExpressionError:
        raise
    except Exception as exc:
        raise ExpressionError(f"Não foi possível interpretar a expressão: {text}") from exc
