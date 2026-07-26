"""Hardening II, Etapa 6 — cobre branches de `equations/` não exercitados
pela suíte de compatibilidade: sistema com N>2 incógnitas, soluções
complexas e entrada multi-linha via "\\n" (a suíte de compatibilidade só
usava ";" como separador)."""
from __future__ import annotations

from app.formatter.pipeline import format_result
from app.formatter.renderer import render_math
from app.math_engine.dispatcher import solve_expression
from app.math_engine.errors import ExpressionError

import pytest


def _solve(expression: str) -> str:
    raw = solve_expression(expression)
    return render_math(format_result(expression, raw))


def test_linear_system_with_three_unknowns() -> None:
    assert _solve("x+y+z=6; x-y=0; y-z=1") == "x = 7/3, y = 7/3, z = 4/3"


def test_quadratic_equation_with_complex_roots() -> None:
    assert _solve("x**2+1=0") == "x₁ = -i, x₂ = i"


def test_system_separated_by_newlines_instead_of_semicolons() -> None:
    assert _solve("x+y=5\nx-y=1") == "x = 3, y = 2"


def test_degenerate_zero_coefficient_equation_raises() -> None:
    # "0*x=5" não é uma equação de verdade (sem incógnita de fato) — o
    # parser rejeita antes mesmo de chegar ao cálculo de grau. Documentado
    # aqui como o comportamento real observado, não assumido.
    with pytest.raises(ExpressionError):
        _solve("0*x=5")


# --- Regressão: equações com parâmetro livre continuam fora de escopo ---
#
# Cálculo (derivada/integral/limite) já nomeia a variável ativa
# explicitamente na sintaxe, então parâmetros livres (a, b, c...) já são
# aceitos como constantes lá. Equações não têm essa declaração explícita —
# "a*x + b = 0" tem 3 símbolos livres e não há como saber qual é "a
# incógnita" sem inventar uma convenção nova. Decisão explícita: manter a
# rejeição atual aqui, não expandir a sintaxe de equações nesta sprint.


def test_equation_with_free_parameters_still_requires_single_unknown() -> None:
    with pytest.raises(ExpressionError, match="única incógnita"):
        _solve("a*x + b = 0")


def test_quadratic_equation_with_free_parameters_still_requires_single_unknown() -> None:
    with pytest.raises(ExpressionError, match="única incógnita"):
        _solve("a*x**2 + b*x + c = 0")


def test_solve_wrapper_syntax_is_not_valid_and_fails_cleanly() -> None:
    # "solve(...)" não é uma forma reconhecida por nenhum dispatcher do
    # MathMaster (equações são digitadas diretamente, ex. "a*x+b=0", sem
    # wrapper) — confirma que isso falha de forma limpa, nunca crasha.
    with pytest.raises(ExpressionError):
        _solve("solve(a*x + b = 0, x)")


# --- Guarda contra sistemas não lineares (correção pós-Sprint V2.4) -----
#
# `solve_linear_system` usa `sympy.linsolve`, estritamente linear — um
# termo não linear em qualquer equação do sistema (potência, produto entre
# incógnitas, função transcendental) fazia o sympy levantar
# `NonlinearError`, que ANTES desta correção não era tratada em lugar
# nenhum: subia como exceção genérica, virava "internal_error" em
# `app/execution.py` (tratado como bug real, não como entrada inválida) —
# o usuário recebia um erro de servidor em vez de uma mensagem de
# validação. `equations/systems.py:solve_linear_system` agora captura
# SÓ `NonlinearError` e a converte em `ExpressionError`.

_NONLINEAR_SYSTEM_MESSAGE = "Sistemas não lineares ainda não são suportados nesta versão."


def test_system_with_power_term_raises_friendly_error_not_crash() -> None:
    with pytest.raises(ExpressionError, match=_NONLINEAR_SYSTEM_MESSAGE):
        _solve("x**2+y=5\nx-y=1")


def test_system_with_product_of_unknowns_raises_friendly_error_not_crash() -> None:
    with pytest.raises(ExpressionError, match=_NONLINEAR_SYSTEM_MESSAGE):
        _solve("x*y=2\nx+y=3")


def test_system_with_transcendental_function_never_reaches_internal_error() -> None:
    # Caso diferente dos dois acima: "sin(x)+y=1\nx-y=0" contém "sin(", e o
    # roteador de domínio (`math_engine/dispatcher.py`) checa trigonometria
    # ANTES de equations — a entrada inteira é roteada para
    # `solve_trigonometry_text`, não para `solve_linear_system`/`linsolve`.
    # NUNCA chega na guarda nova (não é o alvo desta correção), mas o
    # requisito do produto ("erro amigável, nunca 500") já valia antes: o
    # parser de equação trigonométrica de UMA linha rejeita o texto
    # multi-linha com uma `ExpressionError` própria. Documentado aqui para
    # não regredir — se algum dia a cascata de domínios mudar, este teste
    # falha e sinaliza a mudança.
    with pytest.raises(ExpressionError, match="Não foi possível interpretar a equação"):
        _solve("sin(x)+y=1\nx-y=0")


def test_valid_linear_system_still_resolves_after_nonlinear_guard() -> None:
    assert _solve("x+y=5\nx-y=1") == "x = 3, y = 2"
    assert _solve("x+y+z=6\nx-y=0\ny-z=1") == "x = 7/3, y = 7/3, z = 4/3"


def test_impossible_system_still_returns_no_solution_message() -> None:
    assert _solve("x+y=2\nx+y=3") == "Sistema sem solução"


def test_indeterminate_system_still_returns_parametric_solution() -> None:
    assert _solve("x+y=2\n2x+2y=4") == "x = 2 - y, y = y"


def test_unexpected_exception_from_linsolve_is_not_masked_as_expression_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A guarda captura SÓ `NonlinearError` — qualquer outra exceção (um bug
    real dentro do sympy/linsolve, nada a ver com não-linearidade) precisa
    continuar subindo intocada, nunca mascarada como `ExpressionError`
    (que `app/execution.py` trata como entrada inválida esperada, não como
    bug — ver `_run_solve`: só `ExpressionError` vira mensagem amigável,
    qualquer outra exceção vira "internal_error")."""

    def _boom(*args: object, **kwargs: object) -> None:
        raise TypeError("bug simulado, não relacionado a não-linearidade")

    monkeypatch.setattr("app.math_engine.equations.systems.linsolve", _boom)

    with pytest.raises(TypeError, match="bug simulado"):
        _solve("x+y=5\nx-y=1")
