"""Hardening II, Etapa 6 — testes unitários de `formatter/safe_parse.py`,
incluindo o caso documentado no próprio módulo (`safe_sympify('{a, b}')`
retornaria um `set` Python puro, não um `sympy.FiniteSet` — por isso
`pipeline._format_finiteset` nunca sympifica as chaves como um todo)."""
from __future__ import annotations

from sympy import Integer

from app.formatter.safe_parse import guess_symbol, safe_sympify, split_top_level


def test_safe_sympify_parses_valid_expression() -> None:
    assert safe_sympify("2 + 3") == Integer(5)


def test_safe_sympify_returns_none_on_invalid_syntax() -> None:
    assert safe_sympify("2 + + +") is None


def test_safe_sympify_returns_none_on_empty_text() -> None:
    assert safe_sympify("") is None
    assert safe_sympify("   ") is None


def test_split_top_level_ignores_commas_inside_parentheses() -> None:
    assert split_top_level("(1,2),(3,4)") == ["(1,2)", "(3,4)"]


def test_split_top_level_ignores_commas_inside_brackets_and_braces() -> None:
    assert split_top_level("[1,2],{3,4}") == ["[1,2]", "{3,4}"]


def test_split_top_level_with_custom_separator() -> None:
    assert split_top_level("a;b;c", separator=";") == ["a", "b", "c"]


def test_guess_symbol_finds_single_unambiguous_variable() -> None:
    assert guess_symbol("sin(x) = 1/2") == "x"


def test_guess_symbol_excludes_call_names_and_reserved_tokens() -> None:
    assert guess_symbol("log(y) + sqrt(y)") == "y"


def test_guess_symbol_returns_none_when_ambiguous() -> None:
    assert guess_symbol("x + y = 5") is None


def test_guess_symbol_returns_none_when_no_candidate() -> None:
    assert guess_symbol("sin(pi/6)") is None
