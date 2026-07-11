"""Hardening III, Etapa 2 — testes adversariais e de regressão para
`app.math_engine.safe_parsing.safe_parse_expr`, ANTES desse módulo
substituir os 11 pontos de chamada de `parse_expr` nos dispatchers de
domínio (essa substituição é uma etapa futura, ainda não aprovada — este
arquivo testa `safe_parse_expr` isoladamente, não afeta `/solve`).
"""
from __future__ import annotations

import pytest
from sympy.core.expr import Expr

from app.math_engine import safe_parsing
from app.math_engine.errors import ExpressionError
from app.math_engine.safe_parsing import safe_parse_expr


# --- Builtins reais do Python nunca são alcançáveis ---------------------
#
# O caminho de exploração confirmado (empiricamente, contra o parser SEM
# este patch) é sempre via aspas (para passar uma string a uma função real,
# ex. `__import__('os').system(...)`) ou via dunder (`__import__`,
# atributos como `.__class__`). Ambos já são bloqueados por outras camadas
# abaixo.
#
# Nomes de builtin SEM aspas e SEM dunder (ex. "eval(1+1)") nunca chegam a
# executar o builtin real, mesmo no parser sem patch, porque o argumento já
# foi convertido em um objeto SymPy antes do eval() real rodar (TypeError:
# "eval() arg 1 must be a string, bytes or code object"). No módulo
# hardened, esses nomes não resolvem em nada (globals sem builtins), e o
# `implicit_multiplication_application` do SymPy os reinterpreta como
# produto de símbolos de uma letra (ex. "eval(1+1)" -> "2*a*e*l*v") — um
# resultado estranho porém inofensivo, matemática simbólica pura, nenhum
# código real executado. O teste abaixo confirma exatamente isso: ou
# levanta ExpressionError, ou o resultado é um Expr do SymPy comum (nunca
# um tipo nativo do Python que indicaria execução real).
@pytest.mark.parametrize("payload", ["eval(1+1)", "exec(1+1)", "open(1)", "print(1)"])
def test_bare_builtin_names_never_execute_real_code(payload: str) -> None:
    try:
        result = safe_parse_expr(payload)
    except ExpressionError:
        return
    assert isinstance(result, Expr)


# O padrão real de exploração confirmado contra o parser SEM patch: aspas
# permitem passar uma string a uma função real do Python alcançada via
# fallback de builtins (`__import__('math').pi` chega a executar o import
# real e devolve um float nativo do Python, não um objeto SymPy). Esses
# payloads devem ser bloqueados pela whitelist de caracteres (sem aspas).
@pytest.mark.parametrize(
    "payload",
    [
        "__import__('math').pi",
        "__import__('os').system('dir')",
        "eval('1+1')",
    ],
)
def test_rejects_quote_based_builtin_exploitation(payload: str) -> None:
    with pytest.raises(ExpressionError):
        safe_parse_expr(payload)


# --- Dunder (introspecção de objeto / gadget chains) --------------------

@pytest.mark.parametrize(
    "payload",
    [
        "__builtins__",
        "__import__",
        "__class__",
        "x__class__",
    ],
)
def test_rejects_dunder_substrings(payload: str) -> None:
    with pytest.raises(ExpressionError):
        safe_parse_expr(payload)


# --- Acesso por atributo (bloqueado pela ausência de "." na whitelist) --

@pytest.mark.parametrize(
    "payload",
    [
        "x.__class__",
        "(1).__class__.__bases__",
        "x.foo",
    ],
)
def test_rejects_attribute_access(payload: str) -> None:
    with pytest.raises(ExpressionError):
        safe_parse_expr(payload)


# --- Aspas e barras ------------------------------------------------------

@pytest.mark.parametrize(
    "payload",
    [
        "'1+1'",
        '"1+1"',
        "`1+1`",
        "1+1\\",
    ],
)
def test_rejects_quotes_and_backslashes(payload: str) -> None:
    with pytest.raises(ExpressionError):
        safe_parse_expr(payload)


# --- Delimitadores incompatíveis / não fechados / sem abertura ----------

@pytest.mark.parametrize("payload", ["(0]", "[0)", "{0)", "(0}"])
def test_rejects_incompatible_delimiter_pairs(payload: str) -> None:
    with pytest.raises(ExpressionError):
        safe_parse_expr(payload)


@pytest.mark.parametrize("payload", ["(1+1", "[1,2", "{1", "1+1)", "1]", "1}"])
def test_rejects_unbalanced_delimiters(payload: str) -> None:
    with pytest.raises(ExpressionError):
        safe_parse_expr(payload)


# --- Profundidade máxima de aninhamento ---------------------------------

def test_rejects_expression_exceeding_max_nesting_depth(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(safe_parsing.settings, "max_expression_nesting_depth", 3)
    too_deep = "(" * 4 + "1" + ")" * 4
    with pytest.raises(ExpressionError):
        safe_parse_expr(too_deep)


def test_accepts_expression_within_max_nesting_depth(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(safe_parsing.settings, "max_expression_nesting_depth", 3)
    within_limit = "(" * 3 + "1" + ")" * 3
    assert safe_parse_expr(within_limit) == 1


# --- Preservação das expressões legítimas existentes --------------------

@pytest.mark.parametrize(
    "expression",
    [
        "2+2",
        "x**2 + 2*x + 1",
        "(x**2-1)/(x-1)",
        "sqrt(8)",
        "sin(x)**2 + cos(x)**2",
        "sin(pi/6)",
        "cos(pi/3)",
        "tan(pi/4)",
        "asin(1/2)",
        "acos(1/2)",
        "atan(1)",
        "log(100)",
        "ln(E)",
        "exp(0)",
        "Abs(x-3)",
        "x+y+z",
        "2*x+3",
        "x/x",
        "2*x+3=7",
        "x**2-4=0",
        "x>2",
    ],
)
def test_preserves_existing_legitimate_expressions(expression: str) -> None:
    from sympy.parsing.sympy_parser import (
        convert_equals_signs,
        implicit_multiplication_application,
        parse_expr,
        standard_transformations,
    )

    transformations = standard_transformations + (
        implicit_multiplication_application,
        convert_equals_signs,
    )
    expected = parse_expr(expression, transformations=transformations)
    assert safe_parse_expr(expression, transformations=transformations) == expected
