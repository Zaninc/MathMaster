"""Hardening III, Etapa 2 — testes adversariais e de regressão para
`app.math_engine.safe_parsing.safe_parse_expr`, ANTES desse módulo
substituir os 11 pontos de chamada de `parse_expr` nos dispatchers de
domínio (essa substituição é uma etapa futura, ainda não aprovada — este
arquivo testa `safe_parse_expr` isoladamente, não afeta `/solve`).
"""
from __future__ import annotations

import pytest
from sympy import Symbol
from sympy.core.expr import Expr

from app.math_engine import safe_parsing
from app.math_engine.errors import ExpressionError
from app.math_engine.safe_parsing import extract_safe_symbols, safe_parse_expr


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


# --- Sprint Parser: rejeição de identificadores ambíguos --------------

# "xy"/"abc" eram silenciosamente quebrados letra a letra e multiplicados
# pelo `split_symbols` do SymPy antes desta sprint (ex. "xy" -> "x*y",
# resultado matemático diferente do pretendido, sem nenhum erro); "x2"/"x1"
# falhavam com um NameError interno genérico (bug de whitelist, ver
# _REQUIRED_CONSTRUCTORS["Number"] acima). Todos agora são rejeitados de
# forma explícita e uniforme por `_reject_ambiguous_identifiers`.
@pytest.mark.parametrize("payload", ["xy", "abc", "x2", "x1", "tau", "area"])
def test_rejects_ambiguous_multiletter_identifiers(payload: str) -> None:
    with pytest.raises(ExpressionError):
        safe_parse_expr(payload)


# Nomes de 1 caractere nunca são ambíguos, mesmo fora da whitelist.
@pytest.mark.parametrize("payload", ["x", "y", "k", "z"])
def test_accepts_single_letter_identifiers(payload: str) -> None:
    result = safe_parse_expr(payload)
    assert str(result) == payload


# `local_dict` (mesmo mecanismo já usado por trigonometry/ para "tau", ou
# por functions/ para o nome do parâmetro de uma função do usuário) isenta
# um nome específico da rejeição, só para aquela chamada.
def test_local_dict_exempts_name_from_ambiguity_rejection() -> None:
    from sympy import Symbol

    result = safe_parse_expr("area", local_dict={"area": Symbol("area")})
    assert str(result) == "area"


def test_digit_suffixed_identifier_raises_clean_expression_error() -> None:
    # Confirma que o bug de whitelist do Number (NameError interno genérico)
    # não vaza mais: "x2" agora é rejeitado pela camada de ambiguidade, uma
    # ExpressionError limpa, nunca uma exceção crua do Python/SymPy.
    with pytest.raises(ExpressionError) as exc_info:
        safe_parse_expr("x2")
    assert "x2" in str(exc_info.value)


def test_cbrt_of_negative_literal_returns_real_root() -> None:
    # sympy.cbrt sozinho devolve a raiz complexa principal para negativos
    # (2*(-1)**(1/3)); o wrapper `_cbrt` de safe_parsing.py usa real_root
    # para números literais, dando o valor real que um estudante espera.
    result = safe_parse_expr("cbrt(-8)")
    assert result == -2


def test_cbrt_of_symbolic_argument_stays_symbolic() -> None:
    result = safe_parse_expr("cbrt(x)")
    assert str(result) == "x**(1/3)"


# --- Correção do "^" (potência, nunca XOR) -------------------------------
#
# Bug pré-existente: "^" nunca foi convertido para "**" em lugar nenhum do
# pipeline. Para símbolos isso já rejeitava com um erro genérico; para dois
# números, o SymPy resolvia "^" como XOR lógico bit a bit e devolvia uma
# resposta matematicamente ERRADA sem lançar nada ("2^3" == "1", não "8") —
# mais grave que uma rejeição limpa. Ver `_convert_caret_power`.


def test_caret_converts_to_power_between_numbers() -> None:
    assert safe_parse_expr("2^3") == 8


def test_caret_never_silently_resolves_as_xor() -> None:
    assert safe_parse_expr("2^3") != 1


def test_caret_converts_to_power_with_symbol() -> None:
    x = Symbol("x")
    assert safe_parse_expr("x^2", local_dict={"x": x}) == x**2


def test_caret_is_idempotent_alongside_existing_double_star() -> None:
    x = Symbol("x")
    caret = safe_parse_expr("x^2 + 1", local_dict={"x": x})
    double_star = safe_parse_expr("x**2 + 1", local_dict={"x": x})
    assert caret == double_star


# --- extract_safe_symbols -------------------------------------------------


def test_extract_safe_symbols_finds_single_letter_free_parameters() -> None:
    names = extract_safe_symbols("a*x**2 + b*x + c", exclude={"x"})
    assert set(names) == {"a", "b", "c"}


def test_extract_safe_symbols_excludes_the_active_variable() -> None:
    names = extract_safe_symbols("A**(1/x)", exclude={"x"})
    assert set(names) == {"A"}
    assert "x" not in names


def test_extract_safe_symbols_returns_real_sympy_symbols() -> None:
    names = extract_safe_symbols("A**(1/x)", exclude={"x"})
    assert names["A"] == Symbol("A")


@pytest.mark.parametrize("known_name", ["sin", "cos", "log", "ln", "pi", "E", "I", "oo", "sqrt"])
def test_extract_safe_symbols_never_overrides_known_functions_or_constants(known_name: str) -> None:
    names = extract_safe_symbols(f"{known_name}(x) + {known_name}", exclude={"x"})
    assert known_name not in names


def test_extract_safe_symbols_ignores_multiletter_identifiers() -> None:
    # Nomes com 2+ letras não fazem parte deste mecanismo — continuam
    # rejeitados por `_reject_ambiguous_identifiers` dentro de
    # `safe_parse_expr`, nunca "adivinhados" como parâmetro aqui.
    assert extract_safe_symbols("foo + bar", exclude=set()) == {}


def test_extract_safe_symbols_empty_for_expression_without_free_parameters() -> None:
    assert extract_safe_symbols("x**2 + 1", exclude={"x"}) == {}
