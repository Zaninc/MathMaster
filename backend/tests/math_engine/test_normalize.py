"""Sprint Parser — testes unitários puros de `app.math_engine.parser.normalize`.

Não depende de `solve_expression`/`safe_parse_expr`: cada caso verifica só a
transformação textual (camadas [1]/[2] da arquitetura), antes de qualquer
parsing ou roteamento de domínio.
"""
from __future__ import annotations

import pytest

from app.math_engine.parser.normalize import normalize_expression


@pytest.mark.parametrize(
    "expression, expected",
    [
        # --- sobrescritos: expoente sobre átomo ---
        ("x²", "x**2"),
        ("x³", "x**3"),
        ("x⁰", "x**0"),
        ("x¹⁰", "x**10"),
        ("2⁻³", "2**-3"),
        ("x**2", "x**2"),  # já normalizado, intocado
        # --- sobrescritos: expoente sobre grupo entre parênteses ---
        ("(x+1)²", "(x+1)**2"),
        ("(x-1)³", "(x-1)**3"),
        # --- sobrescrito "dangling" (sem base válida antes) — fica intocado ---
        ("²", "²"),
        ("+²x", "+²x"),
        # --- raiz quadrada ---
        ("√x", "sqrt(x)"),
        ("√8", "sqrt(8)"),
        ("√(x+1)", "sqrt(x+1)"),
        ("√(x+1)+1", "sqrt(x+1)+1"),
        # --- raiz cúbica ---
        ("∛x", "cbrt(x)"),
        ("∛8", "cbrt(8)"),
        ("∛(x+1)", "cbrt(x+1)"),
        # --- constantes e operadores Unicode ---
        ("π", "pi"),
        ("2π", "2pi"),
        ("√π", "sqrt(pi)"),
        # --- infinito (Sprint 12.1) ---
        ("∞", "oo"),
        ("-∞", "-oo"),
        ("x<∞", "x<oo"),
        ("x×2", "x*2"),
        ("6÷2", "6/2"),
        ("3−2", "3-2"),
        ("x≤2", "x<=2"),
        ("x≥2", "x>=2"),
        ("x≠2", "x!=2"),
        # --- aliases em português (forma de chamada apenas) ---
        ("sen(x)", "sin(x)"),
        ("tg(x)", "tan(x)"),
        ("raiz(x)", "sqrt(x)"),
        ("raiz(x+1)", "sqrt(x+1)"),
        ("sen(x)+tg(x)", "sin(x)+tan(x)"),
        # aliases não devem casar como substring de outro identificador
        ("sensor(x)", "sensor(x)"),
        ("tigela(x)", "tigela(x)"),
        # --- potência natural sobre chamada de função ("nome²(arg)") ---
        ("sen²(x)", "sin(x)**2"),
        ("sen²(x+1)", "sin(x+1)**2"),
        ("cos²(x)", "cos(x)**2"),
        ("tg²(x)", "tan(x)**2"),
        # --- potência natural sobre chamada já fechada (forma "nome(arg)²") ---
        ("sin(x)²", "sin(x)**2"),
        ("cos(x)²+sin(x)²", "cos(x)**2+sin(x)**2"),
        # --- combinações compostas ---
        ("sen²(x) + cos²(x)", "sin(x)**2 + cos(x)**2"),
        ("3√2", "3sqrt(2)"),
        ("x²-4=0", "x**2-4=0"),
        # --- entradas sem nada a normalizar ---
        ("2+2", "2+2"),
        ("x**2 + 2*x + 1", "x**2 + 2*x + 1"),
    ],
)
def test_normalize_expression(expression: str, expected: str) -> None:
    assert normalize_expression(expression) == expected


@pytest.mark.parametrize(
    "expression",
    [
        "x²", "x²-4=0", "(x+1)²", "2⁻³", "x**2",
        "√x", "√(x+1)", "√8", "∛x", "∛(x+1)", "∛8",
        "π", "2π", "3√2", "√π", "∞", "-∞",
        "x×2", "6÷2", "3−2", "x≤2", "x≥2", "x≠2",
        "sen(x)", "tg(x)", "raiz(x)", "raiz(x+1)",
        "sen²(x)", "sen²(x+1)", "sin(x)²", "cos²(x)",
        "sensor(x)", "x2", "2+2", "",
    ],
)
def test_normalize_expression_is_idempotent(expression: str) -> None:
    once = normalize_expression(expression)
    twice = normalize_expression(once)
    assert once == twice
