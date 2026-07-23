r"""Sprint V2.1 — parsing de somatórios finitos (Σ).

Sintaxe principal (prioritária em toda a interface/documentação):

    Σ(variavel=inferior..superior) expressao

Aliases secundários, mesma semântica e MESMA ORDEM de argumentos
(variável, inferior, superior, expressão):

    sum(variavel, inferior, superior, expressao)
    somatorio(variavel, inferior, superior, expressao)

Mesmo padrão de `calculus/dispatcher.py`: parsing puramente textual
(bracket-counting, nunca um regex-sobre-tudo) — os fragmentos já isolados
(limites, expressão) só chegam a `safe_parse_expr` depois, em
`evaluator.py`. Nenhum `eval`/`exec` em lugar nenhum deste módulo.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from ..errors import ExpressionError

_VARIABLE_PATTERN = re.compile(r"^[a-zA-Z_]\w*$")
_INTEGER_PATTERN = re.compile(r"^[+-]?\d+$")

_SIGMA_PREFIX = "Σ("
_ALIAS_CALL_PATTERN = re.compile(r"^\s*(sum|somatorio)\s*\((.*)\)\s*$", re.DOTALL | re.IGNORECASE)


@dataclass(frozen=True)
class SummationNode:
    """Um somatório finito já parseado, mas ainda não validado/avaliado.
    `expression` preserva o texto do corpo exatamente como foi digitado
    (sem normalização adicional além da já aplicada pelo pipeline geral
    antes do roteamento de domínio)."""

    variable: str
    lower: int
    upper: int
    expression: str

    @property
    def notation(self) -> str:
        """Sintaxe principal reconstruída a partir do nó já parseado — usada
        tanto por `steps.py` (cabeçalho da expansão) quanto por
        `dispatcher.py` (forma compacta quando o somatório não expande para
        poucos termos, Sprint V2.1)."""
        return f"Σ({self.variable}={self.lower}..{self.upper}) {self.expression}"


def _find_matching_paren(text: str, open_idx: int) -> int:
    """Índice do ")" que fecha o "(" em `open_idx`. Mesma técnica de
    bracket-counting usada em `parser/normalize.py`/`calculus/dispatcher.py`
    — nunca regex para isso, o corpo pode ter parênteses aninhados."""
    depth = 0
    for i in range(open_idx, len(text)):
        if text[i] == "(":
            depth += 1
        elif text[i] == ")":
            depth -= 1
            if depth == 0:
                return i
    raise ExpressionError(f"Parêntese do somatório não fechado: {text}")


def _split_top_level_args(text: str) -> list[str]:
    """Mesma técnica de `calculus/dispatcher.py:_split_top_level_args`,
    duplicada aqui deliberadamente (cada área do motor é self-contained,
    convenção registrada desde a Sprint 4/9)."""
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


def _parse_variable(text: str) -> str:
    text = text.strip()
    if not _VARIABLE_PATTERN.match(text):
        raise ExpressionError(f"Nome de variável inválido no somatório: '{text}'.")
    return text


def _parse_bound(text: str) -> int:
    text = text.strip()
    if not _INTEGER_PATTERN.match(text):
        raise ExpressionError("Os limites do somatório devem ser números inteiros.")
    return int(text)


def _parse_sigma_form(expression: str) -> SummationNode:
    """`expression` já vem sem espaços à esquerda e começando por "Σ(".
    Tudo depois do "(" que fecha o cabeçalho é o corpo, inteiro — inclusive
    se contiver mais chamadas de função com seus próprios parênteses (ex.
    "Σ(i=1..5) sin(i)^2 + cos(i)^2")."""
    open_idx = expression.index("(")
    close_idx = _find_matching_paren(expression, open_idx)
    header = expression[open_idx + 1 : close_idx]
    body = expression[close_idx + 1 :].strip()

    if "=" not in header:
        raise ExpressionError(f"Cabeçalho de somatório inválido: {header}")
    variable_text, bounds_text = header.split("=", 1)

    if ".." not in bounds_text:
        raise ExpressionError(f"Cabeçalho de somatório inválido: {header}")
    lower_text, upper_text = bounds_text.split("..", 1)

    if not body:
        raise ExpressionError("O somatório precisa de uma expressão para somar.")

    return SummationNode(
        variable=_parse_variable(variable_text),
        lower=_parse_bound(lower_text),
        upper=_parse_bound(upper_text),
        expression=body,
    )


def _parse_alias_form(expression: str) -> SummationNode:
    match = _ALIAS_CALL_PATTERN.match(expression)
    if not match:
        raise ExpressionError(f"Não foi possível interpretar a expressão: {expression}")
    _, argumentos = match.groups()
    partes = _split_top_level_args(argumentos)
    if len(partes) != 4:
        raise ExpressionError(
            "sum(...)/somatorio(...) esperam exatamente 4 argumentos: "
            "variável, limite inferior, limite superior e expressão."
        )
    variable_text, lower_text, upper_text, body = partes
    if not body.strip():
        raise ExpressionError("O somatório precisa de uma expressão para somar.")

    return SummationNode(
        variable=_parse_variable(variable_text),
        lower=_parse_bound(lower_text),
        upper=_parse_bound(upper_text),
        expression=body.strip(),
    )


def parse_summation_expression(expression: str) -> SummationNode:
    stripped = expression.lstrip()
    if stripped.startswith(_SIGMA_PREFIX):
        return _parse_sigma_form(stripped)
    return _parse_alias_form(expression)
