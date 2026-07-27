r"""Sprint V2.7 — dispatcher do Motor de Combinatória.

Sintaxe própria, sem notação algébrica livre — mesmo padrão de
`polynomials/`/`calculus/` (cada operação é uma chamada nomeada explícita):

    fatorial(n)                          (fat)
    permutacao(n)                        (permutação, P)
    arranjo(n, k)                        (A)
    combinacao(n, k)                     (combinação, C)
    permutacao_repeticao(n, a, b, ...)   (permutação_repetição)

Ver `parsing.py` para o reconhecimento léxico completo (aliases PT-BR/
ASCII/livro didático) e a posição desta área na cascata de
`math_engine/dispatcher.py` (logo depois de `polynomials`, antes de
`calculus`/`functions`/`trigonometry`/`logarithms`/`equations` — os
argumentos aqui são só inteiros, mas a posição segue a convenção das áreas
de chamada nomeada, e nenhum detector anterior casa com este vocabulário).

"5!"/"factorial(5)" soltos continuam na álgebra (fallback), intocados —
esta área só reivindica as chamadas nomeadas acima, ancoradas.

Não implementado nesta versão (fora de escopo, reservado para a V2.8):
probabilidade, distribuição binomial, triângulo de Pascal, princípio
multiplicativo.
"""
from __future__ import annotations

from ..errors import ExpressionError
from .evaluator import (
    evaluate_arrangement,
    evaluate_combination,
    evaluate_factorial,
    evaluate_permutation,
    evaluate_permutation_with_repetition,
)
from .formatter import (
    format_arrangement,
    format_combination,
    format_factorial,
    format_permutation,
    format_permutation_with_repetition,
)
from .parsing import (
    match_combinatorics_call,
    parse_combinatorics_fragment,
    split_top_level_args,
)
from .validation import (
    as_nonnegative_int,
    reject_decimal_literal,
    require_k_at_most_n,
    require_repetitions_fit,
)

# Nome de exibição usado nas mensagens de erro (forma acentuada, amigável).
_DISPLAY_NAMES = {
    "fatorial": "fatorial(...)",
    "permutacao": "permutação(...)",
    "arranjo": "arranjo(...)",
    "combinacao": "combinação(...)",
    "permutacao_repeticao": "permutação_repetição(...)",
}


def is_combinatorics_domain_expression(expression: str) -> bool:
    return match_combinatorics_call(expression) is not None


def _parse_args(operacao: str, argumentos: str, expected: int) -> list[int]:
    display = _DISPLAY_NAMES[operacao]
    partes = split_top_level_args(argumentos)
    if len(partes) != expected or any(parte == "" for parte in partes):
        if expected == 1:
            raise ExpressionError(f"{display} espera exatamente 1 argumento: n.")
        raise ExpressionError(f"{display} espera exatamente 2 argumentos: n e k.")
    roles = ["n", "k"]
    values: list[int] = []
    for i, parte in enumerate(partes):
        reject_decimal_literal(parte, roles[i], display)
        values.append(
            as_nonnegative_int(parse_combinatorics_fragment(parte), roles[i], display)
        )
    return values


def _solve_permutation_with_repetition(argumentos: str) -> str:
    display = _DISPLAY_NAMES["permutacao_repeticao"]
    partes = split_top_level_args(argumentos)
    if len(partes) < 2 or any(parte == "" for parte in partes):
        raise ExpressionError(
            f"{display} espera pelo menos 2 argumentos: n e as repetições "
            "(ex.: permutacao_repeticao(8, 3, 2, 2))."
        )
    reject_decimal_literal(partes[0], "n", display)
    n = as_nonnegative_int(parse_combinatorics_fragment(partes[0]), "n", display)
    repetitions: list[int] = []
    for i, parte in enumerate(partes[1:]):
        role = f"repetição {i + 1}"
        reject_decimal_literal(parte, role, display)
        repetitions.append(
            as_nonnegative_int(parse_combinatorics_fragment(parte), role, display)
        )
    require_repetitions_fit(n, repetitions)
    value = evaluate_permutation_with_repetition(n, repetitions)
    return format_permutation_with_repetition(n, repetitions, value)


def solve_combinatorics_text(expression: str) -> str:
    match = match_combinatorics_call(expression)
    if match is None:
        raise ExpressionError(f"Não foi possível interpretar a expressão: {expression}")
    operacao, argumentos = match

    if operacao == "permutacao_repeticao":
        return _solve_permutation_with_repetition(argumentos)

    if operacao == "fatorial":
        (n,) = _parse_args(operacao, argumentos, 1)
        return format_factorial(n, evaluate_factorial(n))

    if operacao == "permutacao":
        (n,) = _parse_args(operacao, argumentos, 1)
        return format_permutation(n, evaluate_permutation(n))

    if operacao == "arranjo":
        n, k = _parse_args(operacao, argumentos, 2)
        require_k_at_most_n(n, k, _DISPLAY_NAMES[operacao])
        return format_arrangement(n, k, evaluate_arrangement(n, k))

    if operacao == "combinacao":
        n, k = _parse_args(operacao, argumentos, 2)
        require_k_at_most_n(n, k, _DISPLAY_NAMES[operacao])
        return format_combination(n, k, evaluate_combination(n, k))

    raise ExpressionError(f"Operação de combinatória não reconhecida: {operacao}")
