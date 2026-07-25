r"""Sprint V2.3 — Motor de Números Complexos: reconhecimento léxico de
chamadas de função conhecidas e extração estrutural do argumento de
`polar(...)`.

Sintaxe principal (prioritária em toda a interface/documentação):

    i                                     unidade imaginária
    2+i / 3-4i / -5+2i                    números complexos em forma retangular
    (2+i)*(3-i) / (1+i)^5 / (5+2i)/(1-i)  operações (soma, subtração,
                                           multiplicação, divisão, potência
                                           inteira) — já suportadas
                                           NATIVAMENTE por `safe_parse_expr`/
                                           SymPy assim que "i" resolve para a
                                           unidade imaginária (ver
                                           `evaluator.py`); este módulo não
                                           precisa de nenhuma árvore
                                           sintática própria para elas —
                                           confirmado empiricamente durante o
                                           planejamento da sprint.

Funções (aliases PT-BR/EN entre parênteses, mesma semântica):

    conjugate (conjugado, conj)
    modulus   (modulo, abs)
    argument  (argumento, arg)
    polar

`conjugate`/`modulus`/`argument` entram direto no `local_dict` de
`evaluator.py` como qualquer outra função matemática (mesmo mecanismo de
`log_convention.LOCAL_DICT`) — uma chamada delas, isolada ou composta com
outras operações (ex. "modulo(3+4i) + 1", "2*conjugado(1+i)"), é só
sintaxe de chamada de função normal que `safe_parse_expr` já entende
nativamente, sem caso especial nenhum.

`polar(...)` é a ÚNICA exceção, por decisão explícita de arquitetura
(Theo, revisão pré-sprint): produz uma expressão SIMBÓLICA
`r*(cos(θ)+i*sin(θ))` via SymPy — nunca uma string improvisada — o que
significa que não é um `Expr` composável como as outras três. Por isso
precisa ser tratada como a expressão COMPLETA ("2*polar(z)"/"polar(z)+1"
são rejeitados explicitamente por `dispatcher.py`, nunca "adivinhados") e
precisa de extração estrutural do argumento por bracket-matching — mesma
técnica de `matrix/parsing.py:_find_matching_bracket`, duplicada aqui
deliberadamente (cada área do motor é self-contained, mesmo padrão já
usado por matrix/summation/calculus para suas próprias variantes desta
mesma função)."""
from __future__ import annotations

import re

# Nome digitado -> nome canônico usado por `evaluator.py` (chave do
# `local_dict`) — também a fonte única do vocabulário reconhecido por
# `contains_complex_call` abaixo.
CANONICAL_FUNCTION_NAMES: dict[str, str] = {
    "conjugado": "conjugate",
    "conj": "conjugate",
    "modulo": "modulus",
    "abs": "modulus",
    "argumento": "argument",
    "arg": "argument",
    "polar": "polar",
}

_CALL_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(name) for name in CANONICAL_FUNCTION_NAMES) + r")\s*\("
)

_POLAR_CALL_PATTERN = re.compile(r"\bpolar\s*\(")
_POLAR_PREFIX = re.compile(r"^\s*polar\s*\(")


def contains_complex_call(expression: str) -> bool:
    """True se `expression` contiver, em QUALQUER posição, uma chamada a
    uma das funções desta área (canônica ou alias PT-BR/EN) — mesmo
    critério de `.search()` já usado por
    `matrix/dispatcher.py:is_matrix_domain_expression` para det/inv/
    transpose/trace, necessário aqui porque a chamada pode vir composta
    com outras operações (ex. "2*conjugado(1+i)")."""
    return bool(_CALL_PATTERN.search(expression))


def contains_polar_call(expression: str) -> bool:
    return bool(_POLAR_CALL_PATTERN.search(expression))


def _find_matching_paren(text: str, open_idx: int) -> int | None:
    """Índice do ")" que fecha o "(" em `open_idx`, ou `None` se não houver
    fechamento — mesma técnica de
    `matrix/parsing.py:_find_matching_bracket`, duplicada aqui de
    propósito (área self-contained)."""
    depth = 0
    for i in range(open_idx, len(text)):
        if text[i] == "(":
            depth += 1
        elif text[i] == ")":
            depth -= 1
            if depth == 0:
                return i
    return None


def extract_whole_polar_argument(expression: str) -> str | None:
    """Se `expression` (ignorando espaços nas pontas) for EXATAMENTE uma
    chamada "polar(...)" — "(" abre logo após "polar" e o ")" que o fecha
    é o último caractere não-espaço da string —, devolve o texto do
    argumento (ainda cru; `evaluator.py` que sympifica). Devolve `None` em
    qualquer outro caso (chamada incompleta, composta com outra operação
    tipo "2*polar(z)"/"polar(z)+1", ou nem é uma chamada a polar) —
    `dispatcher.py` decide o que fazer com cada caso, nunca "adivinhado"
    aqui."""
    stripped = expression.strip()
    match = _POLAR_PREFIX.match(stripped)
    if match is None:
        return None
    open_idx = match.end() - 1
    close_idx = _find_matching_paren(stripped, open_idx)
    if close_idx is None or close_idx != len(stripped) - 1:
        return None
    return stripped[open_idx + 1 : close_idx]
