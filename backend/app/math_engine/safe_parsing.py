"""Hardening III, Etapa 2 — ponto único e seguro para transformar texto do
usuário em objetos SymPy, usado pelos dispatchers de domínio.

Este módulo NÃO é a Sprint Parser (gramática dedicada, ainda não iniciada).
É um remendo defensivo sobre `sympy.parsing.sympy_parser.parse_expr`, que os
11 dispatchers de domínio já chamavam diretamente antes desta etapa.

Por que isso é necessário: `parse_expr`/`sympify` são baseados em `eval()`.
O próprio SymPy documenta que isso não é seguro sobre entrada não confiável,
porque o `global_dict` padrão (construído a partir de `from sympy import *`)
não remove `__builtins__` do namespace — qualquer nome não encontrado no
namespace do SymPy cai de volta nos builtins reais do Python (`eval`,
`exec`, `open`, `__import__`, ...). Confirmado empiricamente contra o
parser sem patch: `__import__('math').pi` executa o `__import__` real e
devolve um `float` nativo do Python, não um objeto SymPy.

Este módulo fecha essa brecha em quatro camadas independentes:

1. `_SAFE_GLOBAL_DICT`: um namespace mínimo e explícito, montado só com os
   construtores que o próprio SymPy precisa internamente (`Symbol`,
   `Integer`, `Float`, `Rational`, `Eq` — usados pelas transformations
   `auto_symbol`/`auto_number`/`convert_equals_signs` para reescrever o
   código antes do `eval`) mais a whitelist explícita de funções e
   constantes matemáticas hoje suportadas. `__builtins__` fica vazio, então
   qualquer nome fora dessa lista levanta `NameError` em vez de resolver
   para um builtin real. Validado empiricamente: os 151 testes atuais
   passam sem nenhuma falha de `NameError` usando só este conjunto.
2. Bloqueio de `__` (dunder) antes de qualquer parse — cobre tanto nomes
   como `__import__` quanto cadeias de introspecção de objeto como
   `().__class__.__bases__`. Nenhum caractere do namespace mínimo depende
   de dunder, então isso nunca rejeita entrada legítima.
3. Whitelist de caracteres permitidos — rejeita aspas, crase e barra
   invertida (nenhuma expressão matemática legítima usa literais de
   string) e qualquer símbolo fora do conjunto usado pelos dispatchers
   atuais. `.` foi removido deliberadamente: nenhum caso legítimo hoje
   testado usa número decimal (confirmado por varredura de todos os casos
   de regressão); se um domínio futuro precisar de decimais, o caractere
   deve voltar aqui com um teste que o justifique.
4. Validação estrutural dos delimitadores `()[]{}` com pilha: rejeita
   fechamento sem abertura, pares incompatíveis (ex. "(0]") e delimitador
   não fechado, além de aplicar `settings.max_expression_nesting_depth` —
   protege contra expressões desenhadas para estourar o limite de
   recursão do Python.
"""
from __future__ import annotations

import re

from sympy import (
    Abs,
    E,
    Eq,
    Float,
    I,
    Integer,
    Number,
    Rational,
    Symbol,
    acos,
    asin,
    atan,
    cbrt,
    cos,
    exp,
    factorial,
    ln,
    log,
    oo,
    pi,
    real_root,
    sin,
    sqrt,
    tan,
)
from sympy.parsing.sympy_parser import (
    implicit_multiplication_application,
    parse_expr as _sympy_parse_expr,
    standard_transformations,
)

from app.config import settings

from .errors import ExpressionError

DEFAULT_TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application,)

# Construtores que o SymPy precisa internamente para reescrever o código do
# usuário antes do eval (auto_symbol -> Symbol(...), auto_number ->
# Integer(...)/Float(...)/Rational(...), convert_equals_signs -> Eq(...)).
# Nunca digitados diretamente pelo usuário, mas obrigatórios no namespace.
_REQUIRED_CONSTRUCTORS = {
    "Symbol": Symbol,
    "Integer": Integer,
    "Float": Float,
    "Rational": Rational,
    "Eq": Eq,
    # Sprint Parser: a transformation `split_symbols` (parte de
    # `implicit_multiplication_application`) gera código que chama
    # `Number(...)` internamente ao tentar separar um identificador
    # terminado em dígito (ex. "x2") em símbolo + número — sem isso na
    # whitelist, esse caminho falhava com um `NameError` interno genérico
    # em vez de uma rejeição deliberada.
    "Number": Number,
}


def _cbrt(value):
    """Sprint Parser (raiz cúbica, "∛"). `sympy.cbrt` sozinho devolve a raiz
    complexa principal para números negativos (ex. `cbrt(-8)` ==
    `2*(-1)**(1/3)`, não `-2`) — confirmado empiricamente, e matematicamente
    errado para o caso que um estudante espera. Para um NÚMERO literal
    (`is_number`), usa `real_root` (raiz real de verdade: `real_root(-8, 3)
    == -2`). Para uma expressão simbólica (ex. "∛x"), `real_root` produz uma
    `Piecewise` (não pode provar o sinal de x em geral) — pior para leitura
    do que o `cbrt` simbólico limpo (`x**(1/3)`), que é o que já se espera
    de qualquer outra raiz/potência simbólica neste projeto.
    """
    if getattr(value, "is_number", False):
        return real_root(value, 3)
    return cbrt(value)


# Whitelist explícita das funções matemáticas hoje suportadas pelos
# dispatchers de domínio (trigonometria, logaritmos/exponencial, módulo).
_ALLOWED_FUNCTIONS = {
    "Abs": Abs,
    "sin": sin,
    "cos": cos,
    "tan": tan,
    "asin": asin,
    "acos": acos,
    "atan": atan,
    "log": log,
    "ln": ln,
    "exp": exp,
    "sqrt": sqrt,
    "cbrt": _cbrt,
    "factorial": factorial,
}

# Constantes matemáticas hoje suportadas (mesmo conjunto já reconhecido por
# formatter/safe_parse.py:_RESERVED_TOKENS).
_ALLOWED_CONSTANTS = {
    "pi": pi,
    "E": E,
    "I": I,
    "oo": oo,
}

_SAFE_GLOBAL_DICT: dict = {
    **_REQUIRED_CONSTRUCTORS,
    **_ALLOWED_FUNCTIONS,
    **_ALLOWED_CONSTANTS,
    "__builtins__": {},
}

_FORBIDDEN_SUBSTRINGS = ("__",)
_ALLOWED_CHARS_PATTERN = re.compile(r"^[0-9A-Za-z_+\-*/^%,()\[\]{}=<>!:\s]*$")
_BRACKET_PAIRS = {")": "(", "]": "[", "}": "{"}
_OPENERS = set(_BRACKET_PAIRS.values())
_CLOSERS = set(_BRACKET_PAIRS.keys())

# Sprint Parser — nomes que o usuário pode digitar sem parênteses e que já
# são conhecidos pelo sistema (funções e constantes matemáticas). Não inclui
# `_REQUIRED_CONSTRUCTORS`: esses nomes (Symbol, Integer, Number...) existem
# só para o SymPy reescrever código internamente, nunca são digitados por um
# usuário legítimo.
_KNOWN_IDENTIFIER_NAMES = frozenset(_ALLOWED_FUNCTIONS) | frozenset(_ALLOWED_CONSTANTS)

_IDENTIFIER_PATTERN = re.compile(r"[a-zA-Z_]\w*")


def _reject_forbidden_content(text: str) -> None:
    for token in _FORBIDDEN_SUBSTRINGS:
        if token in text:
            raise ExpressionError(f"Não foi possível interpretar a expressão: {text}")
    if not _ALLOWED_CHARS_PATTERN.match(text):
        raise ExpressionError(f"Não foi possível interpretar a expressão: {text}")


def _reject_ambiguous_identifiers(text: str, local_dict: dict | None) -> None:
    """Sprint Parser, camada [3] — antes desta etapa, um identificador de
    múltiplas letras que não é um nome conhecido (ex. "xy", "abc", "x2")
    caía silenciosamente na transformação `split_symbols` do SymPy, que o
    quebra letra a letra e multiplica ("xy" -> "x*y", "sen" -> "e*n*s*x*..."
    quando seguido de outro identificador) — uma resposta matemática
    diferente da pretendida, sem nenhum erro. Ver auditoria da Sprint
    Parser: qualquer alias em português (sen/tg/raiz) precisa ser resolvido
    ANTES desta checagem (já é, em `parser/normalize.py`, que roda antes de
    `safe_parse_expr`); qualquer nome que sobra aqui e não é de 1 caractere
    nem está na whitelist é rejeitado explicitamente, nunca adivinhado.

    `local_dict` é o mesmo dicionário já passado pelo chamador a
    `safe_parse_expr` (ex. `{"tau": 2*pi}` em trigonometria, ou o nome do
    parâmetro de uma função do usuário) — nomes ali são tratados como
    conhecidos só para esta chamada, sem precisar duplicar a whitelist
    global.
    """
    known = _KNOWN_IDENTIFIER_NAMES | frozenset(local_dict) if local_dict else _KNOWN_IDENTIFIER_NAMES
    for match in _IDENTIFIER_PATTERN.finditer(text):
        name = match.group()
        if len(name) == 1 or name in known:
            continue
        raise ExpressionError(
            f"Nome não reconhecido: '{name}'. Use uma única letra por variável "
            "(ex. x, y) ou uma função/constante conhecida."
        )


def _validate_delimiters(text: str) -> None:
    stack: list[str] = []
    max_depth = 0
    for char in text:
        if char in _OPENERS:
            stack.append(char)
            max_depth = max(max_depth, len(stack))
        elif char in _CLOSERS:
            if not stack:
                raise ExpressionError(
                    f"Delimitador de fechamento sem abertura correspondente: {text}"
                )
            if stack[-1] != _BRACKET_PAIRS[char]:
                raise ExpressionError(f"Delimitadores incompatíveis: {text}")
            stack.pop()
    if stack:
        raise ExpressionError(f"Expressão contém delimitador não fechado: {text}")
    if max_depth > settings.max_expression_nesting_depth:
        raise ExpressionError(
            "Expressão excede a profundidade máxima de aninhamento permitida "
            f"({settings.max_expression_nesting_depth})."
        )


def safe_parse_expr(text: str, *, local_dict: dict | None = None, transformations=None):
    """Substituto direto de `sympy.parsing.sympy_parser.parse_expr` para uso
    com texto originado do usuário. Levanta `ExpressionError` (nunca deixa
    uma exceção interna do SymPy ou do Python vazar) para entrada que:
    contenha `__`; contenha caracteres fora da whitelist; tenha delimitadores
    incompatíveis, não fechados ou fechados sem abertura; exceda a
    profundidade máxima de aninhamento; contenha um identificador de
    múltiplas letras não reconhecido (Sprint Parser — ver
    `_reject_ambiguous_identifiers`); ou falhe o parse por qualquer outro
    motivo.
    """
    _reject_forbidden_content(text)
    _validate_delimiters(text)
    _reject_ambiguous_identifiers(text, local_dict)

    resolved_transformations = (
        transformations if transformations is not None else DEFAULT_TRANSFORMATIONS
    )

    try:
        return _sympy_parse_expr(
            text,
            transformations=resolved_transformations,
            local_dict=dict(local_dict) if local_dict else {},
            global_dict=dict(_SAFE_GLOBAL_DICT),
        )
    except ExpressionError:
        raise
    except Exception as exc:
        raise ExpressionError(f"Não foi possível interpretar a expressão: {text}") from exc
