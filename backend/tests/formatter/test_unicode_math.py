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
    render_abs,
    render_sqrt,
    replace_eulers_number,
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


# --- Módulo/valor absoluto: Abs(...) -> |...| (camada de apresentação) ---
#
# Só cosmético: `sympy.Abs` continua sendo a representação interna em todo
# o pipeline (math_engine, parser); só o TEXTO final de exibição muda.


@pytest.mark.parametrize(
    "text, expected",
    [
        ("Abs(x)", "|x|"),
        ("Abs(x - 5)", "|x - 5|"),
        ("Abs(x**2 - 9)", "|x**2 - 9|"),
        ("Abs(sin(x) + cos(x))", "|sin(x) + cos(x)|"),
        ("Abs(x - 1) + Abs(x + 2)", "|x - 1| + |x + 2|"),
        ("3*Abs(x)", "3*|x|"),  # merge_coefficient_products() roda depois
    ],
)
def test_render_abs_wraps_argument_in_pipes(text: str, expected: str) -> None:
    assert render_abs(text) == expected


def test_render_abs_handles_nested_different_arguments() -> None:
    # "Abs(Abs(x))" com o MESMO argumento nunca chega aqui de verdade — o
    # SymPy já colapsa |{|y|}| = |y| durante o simplify. Argumentos
    # DIFERENTES, no entanto, permanecem aninhados na string de saída e
    # precisam da recursão (renderiza de dentro pra fora).
    assert render_abs("Abs(x - Abs(y))") == "|x - |y||"


def test_render_abs_leaves_text_without_abs_untouched() -> None:
    assert render_abs("x + 1") == "x + 1"


@pytest.mark.parametrize(
    "text, expected",
    [
        ("Abs(x)", "|x|"),
        ("Abs(x**2 - 9)", "|x² - 9|"),  # superscript_exponents() roda depois
        ("3*Abs(x)", "3|x|"),  # merge_coefficient_products() reconhece "|"
        ("Abs(x - Abs(y))", "|x - |y||"),
    ],
)
def test_render_math_converts_abs_via_full_pipeline(text: str, expected: str) -> None:
    assert render_math(text) == expected


@pytest.mark.parametrize(
    "text, expected",
    [
        ("2*x", "2x"),
        ("2*π", "2π"),
        ("3*√2", "3√2"),
        ("3*√(x + 1)", "3√(x + 1)"),
        ("5*x", "5x"),
        ("-2*x", "-2x"),
        ("3*|x|", "3|x|"),
        ("2*|x - 1|", "2|x - 1|"),
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


# --- Hotfix de apresentação: constante de Euler (sympy.E) -> "e" ---------
#
# "E" nunca é um parâmetro livre do usuário na saída do math_engine
# (math_engine.safe_parsing.extract_safe_symbols exclui "E" explicitamente,
# junto de pi/I/oo, de qualquer criação de símbolo livre) — então um "E"
# isolado só pode significar a constante de Euler. Mesma garantia e mesmo
# padrão já usados por replace_imaginary_unit() (I -> i).


@pytest.mark.parametrize(
    "text, expected",
    [
        ("E", "e"),
        ("E**2", "e**2"),
        ("1 + E", "1 + e"),
        ("sin(E)", "sin(e)"),
    ],
)
def test_replace_eulers_number_converts_bare_token(text: str, expected: str) -> None:
    assert replace_eulers_number(text) == expected


@pytest.mark.parametrize(
    "text",
    [
        "exp(2)",  # "exp" não contém um "E" isolado (minúsculo, sem boundary)
        "Equação",  # "E" seguido de "q" — sem boundary de fechamento
        "1E5",  # "E" colado a um dígito — sem boundary de abertura
        "x + y",  # nenhum "E" no texto
    ],
)
def test_replace_eulers_number_never_touches_non_standalone_e(text: str) -> None:
    assert replace_eulers_number(text) == text


@pytest.mark.parametrize(
    "text, expected",
    [
        ("Limite: E", "Limite: e"),
        ("2*E", "2*e"),  # "*" preservado (mesma convenção de "2*I" -> "2*i")
        ("E**(1/x)", "e**(1/x)"),  # E como base de potência simbólica
        ("exp(2)", "exp(2)"),  # "exp(" nunca tem um "E" isolado — nunca tocado
    ],
)
def test_render_math_converts_eulers_number_via_full_pipeline(text: str, expected: str) -> None:
    assert render_math(text) == expected


def test_render_math_still_preserves_pi_i_oo_alongside_e() -> None:
    assert render_math("E + pi + I + oo") == "e + π + i + ∞"
