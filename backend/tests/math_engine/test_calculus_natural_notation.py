"""Sprint 12.1 — testes unitários puros de
`app.math_engine.calculus.natural_notation`.

Não depende de `solve_expression`/`safe_parse_expr`: cada caso verifica só
a transformação textual, antes de qualquer parsing ou roteamento de
domínio (mesmo padrão de `test_normalize.py`). Os casos de entrada aqui já
assumem a saída da Sprint Parser (ex. "sin(" em vez de "sen(", "oo" em vez
de "∞") porque é isso que `normalize_calculus_notation` recebe na
composição real de `math_engine/dispatcher.py:normalize_all()`.
"""
from __future__ import annotations

import pytest

from app.math_engine.calculus.natural_notation import normalize_calculus_notation
from app.math_engine.errors import ExpressionError


@pytest.mark.parametrize(
    "expression, expected",
    [
        # --- derivada: só a forma com parênteses ---
        ("d/dx(x**2)", "derivada(x**2, x)"),
        ("d/dx(sin(x))", "derivada(sin(x), x)"),
        ("d/dy(x*y)", "derivada(x*y, y)"),
        ("d / dx ( x**2 + 3*x )", "derivada(x**2 + 3*x, x)"),
        # --- integral indefinida, com/sem parênteses, espaços opcionais ---
        ("∫x**2 dx", "integral(x**2, x)"),
        ("∫ sin(x) dx", "integral(sin(x), x)"),
        ("∫(x**2+1)dx", "integral((x**2+1), x)"),
        ("∫x**2dx", "integral(x**2, x)"),
        # --- integral definida ASCII ---
        ("∫_0^1 x**2 dx", "integral(x**2, x, 0, 1)"),
        ("∫_-1^1 x**2 dx", "integral(x**2, x, -1, 1)"),
        ("∫_{1/2}^{pi} x dx", "integral(x, x, 1/2, pi)"),
        ("∫_0^oo x dx", "integral(x, x, 0, oo)"),
        # --- integral definida Unicode (só inteiros) ---
        ("∫₀¹x**2 dx", "integral(x**2, x, 0, 1)"),
        ("∫₀¹ x**2 dx", "integral(x**2, x, 0, 1)"),
        ("∫₋₁¹x**2 dx", "integral(x**2, x, -1, 1)"),
        # --- limite: 3 variantes de agrupamento ---
        ("lim x->0 sin(x)/x", "limite(sin(x)/x, x, 0)"),
        ("lim x→0 sin(x)/x", "limite(sin(x)/x, x, 0)"),
        ("lim(x→0) sin(x)/x", "limite(sin(x)/x, x, 0)"),
        ("lim_{x→0} sin(x)/x", "limite(sin(x)/x, x, 0)"),
        ("lim  x → oo  1/x", "limite(1/x, x, oo)"),
        ("lim x→-oo 1/x", "limite(1/x, x, -oo)"),
    ],
)
def test_normalize_calculus_notation(expression: str, expected: str) -> None:
    assert normalize_calculus_notation(expression) == expected


@pytest.mark.parametrize(
    "expression",
    [
        # --- derivada sem parênteses / vazia / dy/dx ---
        "d/dx x**2",
        "d/dx()",
        "dy/dx",
        # --- integral sem diferencial / com colchetes de intervalo ---
        "∫x**2",
        "∫[0,1] x**2 dx",
        # --- subscrito sem superscrito colado (par de limites inválido) ---
        "∫₀ x**2 dx",
        # --- "lim" não é um prefixo de outra palavra ---
        "limite(x, x, 0)",
        "limpar(x)",
        # --- entradas já em sintaxe técnica (idempotência) ---
        "derivada(x**2, x)",
        "integral(x**2, x)",
        "integral(x**2, x, 0, 1)",
        # --- sem nada a normalizar ---
        "x**2 + 2*x + 1",
        "",
    ],
)
def test_normalize_calculus_notation_passthrough(expression: str) -> None:
    assert normalize_calculus_notation(expression) == expression


@pytest.mark.parametrize(
    "expression",
    [
        "lim x->0+ 1/x",
        "lim x->0- 1/x",
        "lim(x→2+) 1/(x-2)",
    ],
)
def test_one_sided_limit_is_rejected_explicitly(expression: str) -> None:
    with pytest.raises(ExpressionError, match="laterais"):
        normalize_calculus_notation(expression)


@pytest.mark.parametrize(
    "expression",
    [
        "d/dx(x**2)",
        "∫x**2 dx",
        "∫_0^1 x**2 dx",
        "∫₀¹x**2 dx",
        "lim x→0 sin(x)/x",
        "lim(x→0) sin(x)/x",
        "derivada(x**2, x)",
        "x**2 + 2*x + 1",
        "d/dx x**2",
        "",
    ],
)
def test_normalize_calculus_notation_is_idempotent(expression: str) -> None:
    once = normalize_calculus_notation(expression)
    twice = normalize_calculus_notation(once)
    assert once == twice
