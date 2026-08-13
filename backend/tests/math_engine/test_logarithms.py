"""Hardening II, Etapa 6 — cobre `logarithms/` fora da avaliação numérica
simples: o branch GERAL, e a validação de domínio via regex sobre o texto
bruto (log/ln de argumento literal <= 0, que o SymPy não rejeita
nativamente — ver domain.py)."""
from __future__ import annotations

import pytest

from app.formatter.pipeline import format_result
from app.formatter.renderer import render_math
from app.math_engine.dispatcher import solve_expression
from app.math_engine.errors import ExpressionError


def _solve(expression: str) -> str:
    raw = solve_expression(expression)
    return render_math(format_result(expression, raw))


def test_general_log_expression_combines_terms() -> None:
    assert _solve("log(x)+log(y)") == (
        "Tipo: expressão logarítmica/exponencial; "
        "Resultado: ln(x**(1/ln(10))*y**(1/ln(10)))"
    )


@pytest.mark.parametrize("expression", ["log(-5)", "log(0)", "ln(-1)", "ln(0)"])
def test_log_of_nonpositive_literal_raises(expression: str) -> None:
    with pytest.raises(ExpressionError, match=r"fora do domínio"):
        _solve(expression)


# --- Hotfix V2.12.2a: símbolo solto "e" reinterpretado como Euler ---------
#
# Quando o usuário digita "e" (em vez de `exp(...)`), o parser cria um
# `Symbol` genérico de uma letra — o SymPy não sabe que representa Euler,
# então "ln(e)" nunca colapsava para 1 sozinho. `log(e)`, porém, segue a
# convenção OFICIAL do produto (log = base 10): `log(e)` é `ln(e)/ln(10)`,
# que colapsa corretamente para `1/ln(10)` — NÃO para 1 (isso violaria a
# própria convenção log=base10/ln=natural já estabelecida em todo o
# projeto, ver `calculus/dispatcher.py`), então não é tratado aqui.


def test_ln_of_bare_e_symbol_collapses_to_one() -> None:
    assert _solve("ln(e)") == "Tipo: avaliação numérica; Resultado: 1"


def test_coefficient_times_ln_of_bare_e_symbol() -> None:
    assert _solve("2*ln(e)") == "Tipo: avaliação numérica; Resultado: 2"
    assert _solve("5*ln(e)") == "Tipo: avaliação numérica; Resultado: 5"


def test_log_of_bare_e_symbol_follows_base_10_convention_not_forced_to_one() -> None:
    assert _solve("log(e)") == "Tipo: avaliação numérica; Resultado: 1/ln(10)"


# --- Sprint "Exponenciais e Logaritmos" — equações exponenciais/logarítmicas -
#
# Causa raiz do bug original ("e^x=5" nunca resolvia): (1) "e" solto nunca
# era canonicalizado para a constante de Euler antes de contar símbolos
# livres da equação (`Eq(e**x, 5)` tinha "e" E "x" como incógnitas
# distintas); (2) os padrões de roteamento de `logarithms/dispatcher.py`
# nunca casavam "e^x"/"2^x=8" (só "exp(" literal ou base numérica com "**"
# literal) — ambos corrigidos em `logarithms/dispatcher.py` e
# `logarithms/equations.py`.


@pytest.mark.parametrize(
    ("expression", "expected"),
    [
        ("e^x=5", "x = ln(5)"),
        ("e^(2x)=7", "x = ln(7)/2"),
        ("e^(x+1)=10", "x = -1 + ln(10)"),
        ("2e^x=8", "x = ln(4)"),
        ("3e^(2x)=12", "x = ln(2)"),
        ("2^x=8", "x = 3"),
        ("3^(x+1)=27", "x = 2"),
        ("4^(2x)=16", "x = 1"),
        ("e^x=1", "x = 0"),
    ],
)
def test_exponential_equation_regression_examples(expression: str, expected: str) -> None:
    assert _solve(expression) == expected


def test_exponential_equation_without_exact_base_gives_log_ratio() -> None:
    assert _solve("5^x=13") == "x = ln(13)/ln(5)"


def test_exponential_equation_caret_and_double_star_agree() -> None:
    assert _solve("2^x=8") == _solve("2**x=8") == "x = 3"


def test_exponential_equation_with_no_real_solution_raises_friendly_error() -> None:
    with pytest.raises(ExpressionError, match="não possui solução real"):
        _solve("e^x=-5")


def test_exponential_equation_filters_spurious_complex_solutions() -> None:
    # Achado real desta sprint: `sympy.solve()` devolve ramos complexos
    # espúrios (periodicidade do log complexo) junto da raiz real genuína
    # para expoentes compostos — `solve_log_equation` filtra por `.is_real`.
    result = _solve("e^(2x)=7")
    assert "I" not in result
    assert result == "x = ln(7)/2"
