r"""Sprint V2.8 — dispatcher do Motor de Probabilidade.

Sintaxe própria, sem notação algébrica livre — mesmo padrão de
`combinatorics/`/`polynomials/` (cada operação é uma chamada nomeada
explícita):

    probabilidade(favoraveis, total)
    complementar(p)
    uniao(pa, pb, pinter)
    intersecao_independente(pa, pb)
    condicional(pinter, pb)
    independentes(pa, pb, pinter)
    binomial(n, k, p)

Ver `parsing.py` para o reconhecimento léxico completo e a posição desta
área na cascata de `math_engine/dispatcher.py` (logo depois de
`combinatorics`, pela mesma razão que justifica a posição de lá: os
argumentos aqui são números — inteiros ou decimais —, sem risco real de
"roubar" uma expressão de outra área, mas a posição segue a convenção das
áreas de chamada nomeada).

Não implementado nesta versão (fora de escopo, reservado para V2.8.x
futuras): Teorema de Bayes, distribuição de Poisson, distribuição normal,
distribuição hipergeométrica, árvores de probabilidade, variáveis
aleatórias contínuas, esperança matemática.
"""
from __future__ import annotations

from ..errors import ExpressionError
from .evaluator import (
    evaluate_binomial_term,
    evaluate_complementar,
    evaluate_condicional,
    evaluate_independentes,
    evaluate_intersecao_independente,
    evaluate_probabilidade,
    evaluate_uniao,
)
from .formatter import (
    format_binomial,
    format_complementar,
    format_condicional,
    format_independentes,
    format_intersecao_independente,
    format_probabilidade,
    format_uniao,
)
from .parsing import (
    match_probability_call,
    parse_probability_fragment,
    split_top_level_args,
)
from .validation import (
    as_nonnegative_int,
    as_probability,
    reject_decimal_literal,
    require_favoraveis_within_total,
    require_k_at_most_n,
    require_nonzero,
    require_total_positive,
)

# Nome de exibição usado nas mensagens de erro.
_DISPLAY_NAMES = {
    "probabilidade": "probabilidade(...)",
    "complementar": "complementar(...)",
    "uniao": "uniao(...)",
    "intersecao_independente": "intersecao_independente(...)",
    "condicional": "condicional(...)",
    "independentes": "independentes(...)",
    "binomial": "binomial(...)",
}

# Papéis (nomes de parâmetro) de cada operação, na ordem posicional —
# usados só para compor a mensagem de contagem de argumentos.
_ARG_ROLES: dict[str, list[str]] = {
    "probabilidade": ["favoráveis", "total"],
    "complementar": ["p"],
    "uniao": ["pa", "pb", "pinter"],
    "intersecao_independente": ["pa", "pb"],
    "condicional": ["pinter", "pb"],
    "independentes": ["pa", "pb", "pinter"],
    "binomial": ["n", "k", "p"],
}


def is_probability_domain_expression(expression: str) -> bool:
    return match_probability_call(expression) is not None


def _split_args(operacao: str, argumentos: str) -> list[str]:
    display = _DISPLAY_NAMES[operacao]
    roles = _ARG_ROLES[operacao]
    partes = split_top_level_args(argumentos)
    if len(partes) != len(roles) or any(parte == "" for parte in partes):
        plural = "s" if len(roles) != 1 else ""
        raise ExpressionError(
            f"{display} espera exatamente {len(roles)} argumento{plural}: "
            f"{', '.join(roles)}."
        )
    return partes


def _solve_probabilidade(argumentos: str) -> str:
    display = _DISPLAY_NAMES["probabilidade"]
    partes = _split_args("probabilidade", argumentos)
    reject_decimal_literal(partes[0], "favoráveis", display)
    reject_decimal_literal(partes[1], "total", display)
    favoraveis = as_nonnegative_int(parse_probability_fragment(partes[0]), "favoráveis", display)
    total = as_nonnegative_int(parse_probability_fragment(partes[1]), "total", display)
    require_total_positive(total, display)
    require_favoraveis_within_total(favoraveis, total, display)
    value = evaluate_probabilidade(favoraveis, total)
    return format_probabilidade(favoraveis, total, value)


def _solve_complementar(argumentos: str) -> str:
    display = _DISPLAY_NAMES["complementar"]
    partes = _split_args("complementar", argumentos)
    p = as_probability(parse_probability_fragment(partes[0]), "p", display)
    value = evaluate_complementar(p)
    return format_complementar(p, value)


def _solve_uniao(argumentos: str) -> str:
    display = _DISPLAY_NAMES["uniao"]
    partes = _split_args("uniao", argumentos)
    pa = as_probability(parse_probability_fragment(partes[0]), "pa", display)
    pb = as_probability(parse_probability_fragment(partes[1]), "pb", display)
    pinter = as_probability(parse_probability_fragment(partes[2]), "pinter", display)
    value = evaluate_uniao(pa, pb, pinter)
    return format_uniao(pa, pb, pinter, value)


def _solve_intersecao_independente(argumentos: str) -> str:
    display = _DISPLAY_NAMES["intersecao_independente"]
    partes = _split_args("intersecao_independente", argumentos)
    pa = as_probability(parse_probability_fragment(partes[0]), "pa", display)
    pb = as_probability(parse_probability_fragment(partes[1]), "pb", display)
    value = evaluate_intersecao_independente(pa, pb)
    return format_intersecao_independente(pa, pb, value)


def _solve_condicional(argumentos: str) -> str:
    display = _DISPLAY_NAMES["condicional"]
    partes = _split_args("condicional", argumentos)
    pinter = as_probability(parse_probability_fragment(partes[0]), "pinter", display)
    pb = as_probability(parse_probability_fragment(partes[1]), "pb", display)
    require_nonzero(pb, "pb", display)
    value = evaluate_condicional(pinter, pb)
    return format_condicional(pinter, pb, value)


def _solve_independentes(argumentos: str) -> str:
    display = _DISPLAY_NAMES["independentes"]
    partes = _split_args("independentes", argumentos)
    pa = as_probability(parse_probability_fragment(partes[0]), "pa", display)
    pb = as_probability(parse_probability_fragment(partes[1]), "pb", display)
    pinter = as_probability(parse_probability_fragment(partes[2]), "pinter", display)
    product, is_independent = evaluate_independentes(pa, pb, pinter)
    return format_independentes(pa, pb, pinter, product, is_independent)


def _solve_binomial(argumentos: str) -> str:
    display = _DISPLAY_NAMES["binomial"]
    partes = _split_args("binomial", argumentos)
    reject_decimal_literal(partes[0], "n", display)
    reject_decimal_literal(partes[1], "k", display)
    n = as_nonnegative_int(parse_probability_fragment(partes[0]), "n", display)
    k = as_nonnegative_int(parse_probability_fragment(partes[1]), "k", display)
    require_k_at_most_n(n, k, display)
    p = as_probability(parse_probability_fragment(partes[2]), "p", display)
    combinations, p_pow_k, one_minus_p_pow, value = evaluate_binomial_term(n, k, p)
    return format_binomial(n, k, p, combinations, p_pow_k, one_minus_p_pow, value)


_SOLVERS = {
    "probabilidade": _solve_probabilidade,
    "complementar": _solve_complementar,
    "uniao": _solve_uniao,
    "intersecao_independente": _solve_intersecao_independente,
    "condicional": _solve_condicional,
    "independentes": _solve_independentes,
    "binomial": _solve_binomial,
}


def solve_probability_text(expression: str) -> str:
    match = match_probability_call(expression)
    if match is None:
        raise ExpressionError(f"Não foi possível interpretar a expressão: {expression}")
    operacao, argumentos = match
    return _SOLVERS[operacao](argumentos)
