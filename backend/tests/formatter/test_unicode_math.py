"""Sprint Formatter Fix — testes unitários de `formatter/unicode_math.py`
isolados do pipeline completo, cobrindo a lacuna de apresentação deixada
após a Sprint Parser: `sqrt(...)` com argumento composto, e remoção de "*"
implícito (coeficiente×símbolo, coeficiente×√, parêntese×parêntese) sem
introduzir ambiguidade (função×parêntese, número×número, símbolo×símbolo,
I/E reservados)."""
from __future__ import annotations

import pytest

from app.formatter.renderer import render_math
from app.formatter.unicode_math import (
    merge_coefficient_products,
    merge_parenthesized_products,
    render_sqrt,
)


@pytest.mark.parametrize(
    "text, expected",
    [
        ("sqrt(2)", "√2"),
        ("sqrt(x)", "√x"),
        ("sqrt(pi)", "√pi"),  # replace_constants() runs afterwards -> √π
        ("2*sqrt(2)", "2*√2"),  # merge_coefficient_products() runs afterwards
    ],
)
def test_render_sqrt_atomic_argument_unwrapped(text: str, expected: str) -> None:
    assert render_sqrt(text) == expected


@pytest.mark.parametrize(
    "text, expected",
    [
        ("sqrt(x + 1)", "√(x + 1)"),
        ("sqrt(x**2 + 1)", "√(x**2 + 1)"),
        ("3*sqrt(x**2 + 1)", "3*√(x**2 + 1)"),
        ("sqrt((x - 1)*(x + 1))", "√((x - 1)*(x + 1))"),  # nested parens
    ],
)
def test_render_sqrt_compound_argument_wrapped(text: str, expected: str) -> None:
    assert render_sqrt(text) == expected


def test_render_sqrt_leaves_text_without_sqrt_untouched() -> None:
    assert render_sqrt("x + 1") == "x + 1"


@pytest.mark.parametrize(
    "text, expected",
    [
        ("2*x", "2x"),
        ("2*π", "2π"),
        ("3*√2", "3√2"),
        ("3*√(x + 1)", "3√(x + 1)"),
        ("5*x", "5x"),
        ("-2*x", "-2x"),
    ],
)
def test_merge_coefficient_products_collapses_unambiguous_cases(
    text: str, expected: str
) -> None:
    assert merge_coefficient_products(text) == expected


@pytest.mark.parametrize(
    "text",
    [
        "2*3",  # número×número — nunca colapsa
        "π*k",  # símbolo×símbolo — nunca colapsa
        "2*I",  # unidade imaginária reservada
        "2*E",  # constante de Euler reservada
        "2*sin(x)",  # chamada de função — colapsar viraria "2sin(x)"
    ],
)
def test_merge_coefficient_products_preserves_ambiguous_cases(text: str) -> None:
    assert merge_coefficient_products(text) == text


@pytest.mark.parametrize(
    "text, expected",
    [
        ("(x - 1)*(x + 1)", "(x - 1)(x + 1)"),
        ("(x - 1)*(x + 1)*(x - 2)", "(x - 1)(x + 1)(x - 2)"),
    ],
)
def test_merge_parenthesized_products_collapses_bare_factors(
    text: str, expected: str
) -> None:
    assert merge_parenthesized_products(text) == expected


@pytest.mark.parametrize(
    "text",
    [
        "sin(x)*(x + 1)",  # grupo esquerdo é chamada de função
        "f(x)*(x + 1)",
    ],
)
def test_merge_parenthesized_products_preserves_function_call_left_side(
    text: str,
) -> None:
    assert merge_parenthesized_products(text) == text


# Regressão: "pi" seguido de expoente Unicode (pi**2 -> pi²) não era
# convertido para π. Causa: Python's \w/\b tratam dígitos superescritos
# ("²", "³", ...) como caracteres de palavra, então "\bpi\b" perdia o
# boundary de fechamento quando replace_constants() rodava depois de
# superscript_exponents(). Corrigido invertendo a ordem em render_math()
# (ver renderer.py) — testado aqui via pipeline completo, não via
# replace_constants() isolado, pois o bug só se manifesta na composição.
@pytest.mark.parametrize(
    "text, expected",
    [
        ("pi**2", "π²"),
        ("pi**3", "π³"),
        ("2*pi**2", "2π²"),
        ("pi*x", "π*x"),
        ("2*pi", "2π"),  # já correto antes da correção — sem regressão
        ("pi+pi", "π+π"),  # já correto antes da correção — sem regressão
        ("tau**2", "τ²"),  # mesma causa raiz, mesma correção
    ],
)
def test_render_math_converts_pi_before_unicode_superscript(
    text: str, expected: str
) -> None:
    assert render_math(text) == expected
