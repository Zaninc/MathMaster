"""Sprint V2.1 — cobre `summation/`: sintaxe principal Σ(var=inf..sup) expr,
aliases sum(...)/somatorio(...), validações (limites, variável, expressão,
tamanho do intervalo), termo indefinido com índice exato, ordem da cascata
(summation antes de calculus/functions/trigonometry/logarithms/equations) e
não-regressão das áreas existentes."""
from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient
from sympy import Integer, Rational, log, sin

import app.execution as execution_module
from app.formatter.pipeline import format_result
from app.formatter.renderer import render_math
from app.math_engine.calculus.dispatcher import is_calculus_domain_expression
from app.math_engine.dispatcher import solve_expression
from app.math_engine.errors import ExpressionError
from app.math_engine.summation.dispatcher import is_summation_domain_expression
from app.math_engine.summation.evaluator import evaluate_summation
from app.math_engine.summation.parsing import parse_summation_expression
from app.math_engine.summation.steps import build_summation_steps


def _solve(expression: str) -> str:
    raw = solve_expression(expression)
    return render_math(format_result(expression, raw))


# --- Sintaxe principal Σ(var=inf..sup) expr --------------------------------


def test_sum_of_first_ten_naturals() -> None:
    assert _solve("Σ(i=1..10) i") == "55"


def test_sum_of_squares() -> None:
    assert _solve("Σ(i=1..5) i²") == "55"


def test_sum_with_linear_body_and_free_variable_name() -> None:
    assert _solve("Σ(k=1..4) (2*k+3)") == "32"


def test_sum_of_powers_of_two() -> None:
    assert _solve("Σ(n=0..5) 2^n") == "63"


def test_sum_with_negative_lower_bound_cancels_out() -> None:
    assert _solve("Σ(i=-5..5) i") == "0"


def test_sum_with_single_term_interval() -> None:
    assert _solve("Σ(i=5..5) i") == "5"


def test_sum_of_constant_body() -> None:
    assert _solve("Σ(i=1..5) 10") == "50"


def test_sum_with_rational_body() -> None:
    assert _solve("Σ(i=1..5) ((i²+1)/(2*i))") == "1037/120"


# --- Aliases secundários (mesma semântica, mesma ordem de argumentos) ------
# Ordem oficial: sum(variavel, inferior, superior, expressao).


def test_sum_alias_matches_sigma_syntax() -> None:
    assert _solve("sum(i,1,10,i)") == _solve("Σ(i=1..10) i")


def test_somatorio_alias_matches_sigma_syntax() -> None:
    assert _solve("somatorio(i,1,10,i)") == _solve("Σ(i=1..10) i")


def test_sum_alias_is_case_insensitive() -> None:
    assert _solve("SUM(i,1,10,i)") == "55"


def test_alias_wrong_argument_count_raises() -> None:
    with pytest.raises(ExpressionError, match="4 argumentos"):
        _solve("sum(i,1,10)")


# --- Validações -------------------------------------------------------------


def test_lower_bound_greater_than_upper_bound_raises() -> None:
    with pytest.raises(ExpressionError, match="limite inferior"):
        _solve("Σ(i=10..1) i")


def test_non_integer_bound_raises() -> None:
    with pytest.raises(ExpressionError, match="números inteiros"):
        _solve("Σ(i=1.5..10) i")


def test_symbolic_bound_raises_same_non_integer_message() -> None:
    with pytest.raises(ExpressionError, match="números inteiros"):
        _solve("Σ(i=1..n) i")


def test_interval_larger_than_ten_thousand_terms_raises() -> None:
    with pytest.raises(ExpressionError, match="10.000 termos"):
        _solve("Σ(i=1..10001) i")


def test_interval_with_exactly_ten_thousand_terms_is_allowed() -> None:
    assert _solve("Σ(i=1..10000) 1") == "10000"


def test_invalid_variable_name_raises() -> None:
    with pytest.raises(ExpressionError, match="[Vv]ariável"):
        _solve("Σ(2=1..10) i")


def test_missing_range_separator_raises() -> None:
    with pytest.raises(ExpressionError, match="[Cc]abeçalho"):
        _solve("Σ(i=1) i")


def test_empty_body_raises() -> None:
    with pytest.raises(ExpressionError, match="expressão para somar"):
        _solve("Σ(i=1..10)")


def test_invalid_body_expression_raises() -> None:
    with pytest.raises(ExpressionError, match="[Nn]ão foi possível interpretar"):
        _solve("Σ(i=1..5) )(")


def test_undefined_term_reports_exact_index() -> None:
    with pytest.raises(ExpressionError) as exc_info:
        _solve("Σ(i=-1..1) 1/i")
    assert str(exc_info.value) == "O termo do somatório é indefinido para i = 0."


def test_undefined_term_from_log_of_zero_reports_exact_index() -> None:
    with pytest.raises(ExpressionError) as exc_info:
        _solve("Σ(i=0..2) log(i)")
    assert str(exc_info.value) == "O termo do somatório é indefinido para i = 0."


# --- Ordem da cascata: summation antes de calculus/functions/trigonometry/
# logarithms/equations -------------------------------------------------------


def test_summation_prefix_is_not_claimed_by_calculus_domain_check() -> None:
    expression = "Σ(i=1..3) i"
    assert is_summation_domain_expression(expression) is True
    assert is_calculus_domain_expression(expression) is False


def test_summation_body_with_trig_functions_is_not_stolen_by_trigonometry() -> None:
    # "sin("/"cos(" em qualquer posição do corpo não deve roubar o domínio
    # de trigonometria — mesma garantia que já existe para calculus.
    assert _solve("Σ(i=1..5) sin(i)^2 + cos(i)^2") == "5"


def test_summation_body_with_log_uses_base10_convention() -> None:
    # Convenção log=base10/ln=natural (`log_convention.py`) aplicada ao
    # corpo — o valor não colapsa para um número limpo, então sobra como
    # "ln(x)/ln(10)" (mesmo padrão de apresentação de `logarithms`/`calculus`
    # quando a expressão base-10 não se resolve para um número exato).
    assert _solve("Σ(i=1..3) log(i+10)") == "ln(1716)/ln(10)"


def test_summation_body_free_parameter_stays_symbolic() -> None:
    assert _solve("Σ(i=1..3) a*i") == "6a"


def test_leading_whitespace_before_sigma_is_still_recognized() -> None:
    assert _solve("   Σ(i=1..10) i") == "55"


def test_sigma_in_the_middle_of_text_is_not_classified_as_summation() -> None:
    # Ajuste 2 do Theo: só reconhece por PREFIXO, nunca por ocorrência no
    # meio do texto.
    assert is_summation_domain_expression("x + Σ(i=1..10) i") is False


# --- Preservação da entrada original + integração HTTP -----------------------


def test_solve_endpoint_preserves_original_sigma_syntax_verbatim(client: TestClient) -> None:
    response = client.post("/solve", json={"expression": "Σ(i=1..10) i"})
    assert response.status_code == 200
    assert response.json() == {"expression": "Σ(i=1..10) i", "result": "55", "approx": None}


def test_solve_endpoint_preserves_original_alias_syntax_verbatim(client: TestClient) -> None:
    response = client.post("/solve", json={"expression": "sum(i,1,10,i)"})
    assert response.status_code == 200
    assert response.json() == {"expression": "sum(i,1,10,i)", "result": "55", "approx": None}


def test_solve_endpoint_returns_400_for_invalid_bounds(client: TestClient) -> None:
    response = client.post("/solve", json={"expression": "Σ(i=10..1) i"})
    assert response.status_code == 400
    assert "limite inferior" in response.json()["detail"]


# --- Timeout: reaproveita o mecanismo global existente (app.execution) -----


def test_summation_respects_the_existing_global_timeout(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(execution_module.settings, "compute_timeout_seconds", 0.01)
    response = client.post("/solve", json={"expression": "Σ(i=1..10000) i**2"})
    assert response.status_code == 400
    assert "tempo máximo" in response.json()["detail"]


# --- Não-regressão das áreas existentes -------------------------------------


def test_existing_algebra_still_works() -> None:
    assert _solve("2+2") == "4"


def test_existing_calculus_still_works() -> None:
    assert _solve("integral(x**2, x)") == "Integral: x³/3 + C"


def test_existing_equations_still_work() -> None:
    assert _solve("x**2 - 4 = 0") == "x₁ = -2, x₂ = 2"


# --- Segurança: extração de parâmetros livres nunca abre brecha nova -------


@pytest.mark.parametrize(
    "expression",
    [
        "Σ(i=1..3) __import__('os').system('dir')",
        "Σ(i=1..3) os.system(1)",
        "Σ(i=1..3) foo.bar",
        "Σ(i=1..3) i__class__",
        "Σ(i=1..3) ().__class__.__bases__",
        "sum(i,1,3,__import__('os').system('dir'))",
    ],
)
def test_summation_body_never_bypasses_security_layers(expression: str) -> None:
    with pytest.raises(ExpressionError):
        _solve(expression)


# --- steps.py: arquitetura preparada, não exposta pelo /solve --------------


def test_build_summation_steps_expands_small_interval() -> None:
    node = parse_summation_expression("Σ(i=1..5) 2*i")
    total = evaluate_summation(node)
    steps = build_summation_steps(node, total)
    assert steps[0] == "Σ(i=1..5) 2*i"
    assert steps[1] == "2*1 + 2*2 + 2*3 + 2*4 + 2*5"
    assert steps[2] == "30"


def test_build_summation_steps_uses_ellipsis_for_large_interval() -> None:
    node = parse_summation_expression("Σ(i=1..20) i")
    total = evaluate_summation(node)
    steps = build_summation_steps(node, total)
    assert steps == ["Σ(i=1..20) i", "...", "210"]


def test_summation_steps_are_not_part_of_the_solve_response(client: TestClient) -> None:
    response = client.post("/solve", json={"expression": "Σ(i=1..5) 2*i"})
    assert response.status_code == 200
    assert set(response.json().keys()) == {"expression", "result", "approx"}


# --- Hotfix (profiling): soma final nunca chama simplify()/trigsimp -------
#
# Causa-raiz medida empiricamente (ver evaluator.py e formatter/expr_clean.py):
# `simplify()`/`trigsimp` tentam achar identidades trigonométricas ENTRE
# todos os termos de uma soma — custo que cresce muito rápido com o número
# de átomos sin/cos de argumento numérico independentes (~31s para 30 termos
# mistos antes da correção; <1.2s depois, em ambas as camadas: `evaluator.py`
# nunca mais chama `simplify()`, e `formatter/expr_clean.py` limita
# `trigsimp` a expressões com poucos átomos trigonométricos). Um somatório
# de 30 termos NUNCA deveria se aproximar do timeout de 5s.
#
# Prazo de 3s usado nas asserções de tempo (bem acima do ~1.2s medido, bem
# abaixo do timeout de 5s) — dá margem para variação de máquina sem
# mascarar uma regressão real de performance.
_PERFORMANCE_BUDGET_SECONDS = 3.0


def test_sum_of_thirty_naturals_is_exact() -> None:
    assert _solve("Σ(i=1..30) i") == "465"


def test_sum_of_thirty_rational_terms_is_exact() -> None:
    node = parse_summation_expression("Σ(i=1..30) (i**2+2*i+1)/(i+3)")
    expected = sum((Rational(i, 1) ** 2 + 2 * i + 1) / (i + 3) for i in range(1, 31))
    assert evaluate_summation(node) == expected
    assert _solve("Σ(i=1..30) (i²+2*i+1)/(i+3)") == "1457234865551749/3281898929400"


def test_sum_of_thirty_natural_logs_collapses_to_log_of_factorial() -> None:
    # ln(1) + ln(2) + ... + ln(30) = ln(30!) — combinação estrutural via
    # `logcombine`, sem precisar de `simplify()`.
    node = parse_summation_expression("Σ(i=1..30) ln(i)")
    assert evaluate_summation(node) == log(Integer(265252859812191058636308480000000))
    assert _solve("Σ(i=1..30) ln(i)") == "ln(265252859812191058636308480000000)"


def test_sum_of_thirty_sines_stays_symbolic_and_exact() -> None:
    # Não há forma fechada mais simples — o valor exato correto É a soma dos
    # 30 átomos sin(k) (nunca uma aproximação numérica silenciosa).
    node = parse_summation_expression("Σ(i=1..30) sin(i)")
    expected = sum(sin(i) for i in range(1, 31))
    assert evaluate_summation(node) == expected


def test_mixed_thirty_term_summation_completes_within_budget_and_is_exact() -> None:
    expression = "Σ(i=1..30) ((i²+2*i+1)/(i+3)+sin(i)-ln(i))"
    node = parse_summation_expression("Σ(i=1..30) ((i**2+2*i+1)/(i+3)+sin(i)-ln(i))")

    start = time.perf_counter()
    total = evaluate_summation(node)
    elapsed = time.perf_counter() - start

    assert elapsed < _PERFORMANCE_BUDGET_SECONDS, f"levou {elapsed:.2f}s, esperado < {_PERFORMANCE_BUDGET_SECONDS}s"

    rational_part = sum((Rational(i, 1) ** 2 + 2 * i + 1) / (i + 3) for i in range(1, 31))
    sines_part = sum(sin(i) for i in range(1, 31))
    log_part = log(Integer(265252859812191058636308480000000))
    assert total == rational_part + sines_part - log_part

    start = time.perf_counter()
    result = _solve(expression)
    elapsed = time.perf_counter() - start
    assert elapsed < _PERFORMANCE_BUDGET_SECONDS, f"levou {elapsed:.2f}s, esperado < {_PERFORMANCE_BUDGET_SECONDS}s"
    # Apresentação progressiva (Sprint V2.1): 30 termos que não colapsam para
    # poucos ficam na própria notação Σ compacta (nunca a expansão de
    # dezenas de termos) — o valor exato continua sendo exatamente esse,
    # só reapresentado de forma compacta.
    assert result == "Σ(i=1..30) ((i²+2i+1)/(i+3)+sin(i)-ln(i))"


def test_ten_term_sine_plus_cosine_summation_completes_within_budget() -> None:
    # O caso que estourava o card no frontend (BUG 1) — aqui só valida que o
    # BACKEND não é o gargalo (20 átomos trigonométricos, abaixo do limite
    # de `_bounded_trigsimp`, ainda assim rápido).
    start = time.perf_counter()
    result = _solve("Σ(i=1..10) (sin(i)+cos(i))")
    elapsed = time.perf_counter() - start
    assert elapsed < _PERFORMANCE_BUDGET_SECONDS, f"levou {elapsed:.2f}s, esperado < {_PERFORMANCE_BUDGET_SECONDS}s"
    assert result != ""


def test_twenty_term_sine_cosine_log_summation_completes_within_budget() -> None:
    start = time.perf_counter()
    result = _solve("Σ(i=1..20) (sin(i)+cos(i)+ln(i))")
    elapsed = time.perf_counter() - start
    assert elapsed < _PERFORMANCE_BUDGET_SECONDS, f"levou {elapsed:.2f}s, esperado < {_PERFORMANCE_BUDGET_SECONDS}s"
    assert result != ""


def test_solve_endpoint_does_not_time_out_for_thirty_term_mixed_summation(
    client: TestClient,
) -> None:
    response = client.post(
        "/solve", json={"expression": "Σ(i=1..30) ((i²+2*i+1)/(i+3)+sin(i)-ln(i))"}
    )
    assert response.status_code == 200
    assert response.json()["result"] == "Σ(i=1..30) ((i²+2i+1)/(i+3)+sin(i)-ln(i))"
