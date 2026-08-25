"""Sprint "L'Hôpital com Aplicações Sucessivas" — cobertura de
`math_engine.steps.lhopital`'s laço iterativo: cada nova aplicação exige
reconfirmação de 0/0 ou ∞/∞ (`_is_indeterminate_ratio`), para
imediatamente ao deixar de ser indeterminado, e tem dois limites
defensivos (`MAX_LHOPITAL_APPLICATIONS`, detecção de ciclo) — nunca um
loop infinito, nunca um resultado inventado. Todo caso suportado é
comparado contra `sympy.limit` (oráculo, nunca gerador de passos)."""
from __future__ import annotations

import pytest
from sympy import Rational, limit

from app.math_engine.errors import ExpressionError
from app.math_engine.steps import generate_steps
from app.math_engine.steps.lhopital import MAX_LHOPITAL_APPLICATIONS, generate_lhopital_steps


def _final_expression(text: str) -> str:
    return generate_steps(text)[-1].expression


def _application_count(steps: list) -> int:
    return sum(1 for s in steps if s.title == "Aplicando a Regra de L'Hôpital (novo limite)")


# --- Caso obrigatório: 1 aplicação (regressão) ----------------------------


def test_one_application_still_gives_correct_result() -> None:
    steps = generate_steps("limite((exp(x)-1)/x, x, 0)")
    assert _application_count(steps) == 1
    assert steps[-1].expression == "1"


# --- Caso obrigatório: 2 aplicações ---------------------------------------


def test_two_applications_matches_ticket_example() -> None:
    steps = generate_steps("limite((exp(x)-1-x)/x**2, x, 0)")
    assert _application_count(steps) == 2
    assert steps[-1].expression == "1/2"


def test_two_applications_titles_show_it_happened_twice() -> None:
    titles = [s.title for s in generate_steps("limite((exp(x)-1-x)/x**2, x, 0)")]
    assert titles.count("Aplicando a Regra de L'Hôpital (novo limite)") == 2
    assert any("continua na forma" in t for t in titles)


# --- Caso obrigatório: 3 aplicações — prova que é iterativo, não hardcoded --


def test_three_applications_matches_ticket_example() -> None:
    steps = generate_steps("limite((exp(x)-1-x-x**2/2)/x**3, x, 0)")
    assert _application_count(steps) == 3
    assert steps[-1].expression == "1/6"


# --- Caso trigonométrico obrigatório ---------------------------------------


def test_trigonometric_case_three_applications() -> None:
    steps = generate_steps("limite((sin(x)-x)/x**3, x, 0)")
    assert _application_count(steps) == 3
    assert steps[-1].expression == "-1/6"


def test_trigonometric_case_does_not_get_intercepted_by_fundamental_limits() -> None:
    # `is_trigonometric_fundamental_shape` só reconhece sen(ax)/x, x/sen(x),
    # sen(ax)/sen(bx) e (1-cos(ax))/x² — "(sin(x)-x)/x³" (numerador é uma
    # SOMA, não um sen(ax) isolado) nunca casa nenhuma dessas formas, então
    # sempre cai no caminho de L'Hôpital, nunca é roubado incorretamente.
    titles = [s.title for s in generate_steps("limite((sin(x)-x)/x**3, x, 0)")]
    assert "Reconhecendo o limite fundamental" not in titles


# --- Caso logarítmico obrigatório -------------------------------------------


def test_logarithmic_case_one_application() -> None:
    steps = generate_steps("limite(ln(x)/(x-1), x, 1)")
    assert _application_count(steps) == 1
    assert steps[-1].expression == "1"


# --- Caso ∞/∞ obrigatório: prova que agora resolve com múltiplas aplicações -


def test_infinity_over_infinity_two_applications() -> None:
    steps = generate_steps("limite(x**2/exp(x), x, oo)")
    assert _application_count(steps) == 2
    assert steps[-1].expression == "0"


# --- Casos onde L'Hôpital NÃO deve ser aplicado -----------------------------


def test_direct_substitution_never_uses_lhopital() -> None:
    titles = [s.title for s in generate_steps("limite((x**2+1)/(x+1), x, 0)")]
    assert "Aplicando a Regra de L'Hôpital (novo limite)" not in titles
    assert generate_steps("limite((x**2+1)/(x+1), x, 0)")[-1].expression == "1"


def test_zero_over_nonzero_never_uses_lhopital() -> None:
    titles = [s.title for s in generate_steps("limite(x/(x+1), x, 0)")]
    assert "Aplicando a Regra de L'Hôpital (novo limite)" not in titles
    assert generate_steps("limite(x/(x+1), x, 0)")[-1].expression == "0"


def test_nonzero_over_zero_does_not_auto_apply_lhopital() -> None:
    # "1/x" em x->0 não é 0/0 — continua fora de escopo do motor de
    # limites (comportamento pré-existente, intocado por esta sprint).
    with pytest.raises(ExpressionError):
        generate_steps("limite(1/x, x, 0)")


# --- Stops imediatamente quando a indeterminação desaparece -----------------


def test_stops_as_soon_as_indeterminate_form_disappears() -> None:
    # Depois de UMA aplicação, "exp(x)/1" em x->0 já não é 0/0 — o laço
    # nunca deve tentar uma segunda derivada.
    steps = generate_steps("limite((exp(x)-1)/x, x, 0)")
    assert _application_count(steps) == 1


# --- Hardening (seção 32): classificação SUPPORTED, sempre contra o oráculo --


@pytest.mark.parametrize(
    ("call", "expected"),
    [
        ("limite((exp(x)-1-x)/x**2, x, 0)", Rational(1, 2)),
        ("limite((exp(x)-1-x-x**2/2)/x**3, x, 0)", Rational(1, 6)),
        ("limite((sin(x)-x)/x**3, x, 0)", Rational(-1, 6)),
        ("limite((cos(x)-1+x**2/2)/x**4, x, 0)", Rational(1, 24)),
        ("limite(x**2/exp(x), x, oo)", 0),
        ("limite(ln(x)/(x-1), x, 1)", 1),
        ("limite((x-ln(1+x))/x**2, x, 0)", Rational(1, 2)),
    ],
)
def test_hardening_cases_match_final_expression(call: str, expected) -> None:
    assert _final_expression(call) == str(expected)


# --- Stress test obrigatório: 4 aplicações ----------------------------------


def test_four_applications_stress_test() -> None:
    steps = generate_steps("limite((exp(x)-1-x-x**2/2-x**3/6)/x**4, x, 0)")
    assert _application_count(steps) == 4
    assert steps[-1].expression == "1/24"


# --- Validação contra o oráculo SymPy (nunca gerador de passos) ------------


@pytest.mark.parametrize(
    "call",
    [
        "limite((exp(x)-1-x)/x**2, x, 0)",
        "limite((exp(x)-1-x-x**2/2)/x**3, x, 0)",
        "limite((sin(x)-x)/x**3, x, 0)",
        "limite((exp(x)-1-x-x**2/2-x**3/6)/x**4, x, 0)",
        "limite(x**2/exp(x), x, oo)",
    ],
)
def test_matches_sympy_limit_oracle(call: str) -> None:
    from app.math_engine.calculus.dispatcher import parse_limit_call

    expr, symbol, point = parse_limit_call(call)
    oracle = limit(expr, symbol, point)
    assert str(oracle) == _final_expression(call)


# --- Aplicação direta da engine, contornando o portão do dispatcher --------


def test_direct_engine_call_on_pure_polynomial_ratio_still_iterates_correctly() -> None:
    # Via o dispatcher normal, "(3x²+2x)/(x²-1)" em x->oo é resolvido pela
    # comparação de graus (`limits.py`), nunca por L'Hôpital (`is_lhopital_
    # shape` exclui razões inteiramente polinomiais de propósito — ver
    # docstring do módulo). Chamando a engine de L'Hôpital DIRETAMENTE
    # (contornando esse portão), o laço ainda funciona corretamente sobre
    # uma razão polinomial-polinomial, confirmando que a generalização não
    # depende de "não ser polinomial".
    steps = generate_lhopital_steps("limite((3*x**2+2*x)/(x**2-1), x, oo)")
    assert _application_count(steps) == 2
    assert steps[-1].expression == "3"


def test_dispatcher_still_prefers_degree_comparison_for_pure_polynomial_ratio() -> None:
    titles = [s.title for s in generate_steps("limite((3*x**2+2*x)/(x**2-1), x, oo)")]
    assert "Dividindo o numerador e o denominador por x**2" in titles
    assert "Aplicando a Regra de L'Hôpital (novo limite)" not in titles


# --- MAX_LHOPITAL_APPLICATIONS: teste de limite de segurança ---------------


def test_max_applications_constant_is_reasonable() -> None:
    # Precisa cobrir com folga o stress test obrigatório de 4 aplicações
    # (seção 33 do ticket) sem ser absurdamente grande.
    assert MAX_LHOPITAL_APPLICATIONS >= 4


def test_exceeding_max_applications_stops_safely(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.math_engine.steps.lhopital as lhopital_module

    monkeypatch.setattr(lhopital_module, "MAX_LHOPITAL_APPLICATIONS", 2)
    with pytest.raises(ExpressionError, match="número máximo de vezes"):
        # Esta expressão genuinamente precisa de 3 aplicações — com o teto
        # artificialmente baixado para 2, o laço deve parar com segurança
        # em vez de continuar aplicando ou travar.
        lhopital_module.generate_lhopital_steps("limite((exp(x)-1-x-x**2/2)/x**3, x, 0)")


# --- Detecção de ciclo -------------------------------------------------------


def test_cycle_detection_stops_when_derivative_pair_repeats(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.math_engine.steps.lhopital as lhopital_module

    # Mock deliberado (seção 40 do ticket permite "construir/mocar"): faz
    # `compute_derivative` devolver a MESMA expressão recebida, sem
    # calcular nada — assim o par (numerador, denominador) da primeira
    # "derivada" é idêntico ao par original, e a detecção de ciclo deve
    # interromper ANTES mesmo de chegar perto de MAX_LHOPITAL_APPLICATIONS.
    monkeypatch.setattr(lhopital_module, "compute_derivative", lambda expr, symbol: expr)
    with pytest.raises(ExpressionError, match="ciclo"):
        lhopital_module.generate_lhopital_steps("limite((exp(x)-1)/x, x, 0)")


# --- Regressão: mensagem amigável, nunca erro cru para denominador nulo ----


def test_zero_derivative_denominator_never_raises_raw_division_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.math_engine.steps.lhopital as lhopital_module
    from sympy import Integer

    real_derivative = lhopital_module.compute_derivative

    def fake_derivative(expr, symbol):
        # Segunda chamada (derivada do denominador) devolve 0
        # identicamente — mock deliberado só para exercitar a guarda
        # defensiva, sem precisar de um exemplo matemático real onde a
        # derivada do denominador se anula (seção 21 do ticket).
        if expr == symbol:
            return Integer(0)
        return real_derivative(expr, symbol)

    monkeypatch.setattr(lhopital_module, "compute_derivative", fake_derivative)
    with pytest.raises(ExpressionError, match="identicamente zero"):
        lhopital_module.generate_lhopital_steps("limite((exp(x)-1)/x, x, 0)")


# --- Regressões gerais: limites fundamentais, fatoração, comparação de graus -


def test_sin_over_x_regression() -> None:
    assert _final_expression("limite(sin(x)/x, x, 0)") == "1"


def test_x_over_sin_x_regression() -> None:
    assert _final_expression("limite(x/sin(x), x, 0)") == "1"


def test_sin_ax_over_sin_bx_regression() -> None:
    assert _final_expression("limite(sin(2*x)/sin(3*x), x, 0)") == "2/3"


def test_one_minus_cos_regression() -> None:
    assert _final_expression("limite((1-cos(2*x))/x**2, x, 0)") == "2"


def test_factoring_cancellation_regression() -> None:
    titles = [s.title for s in generate_steps("limite((x**2-4)/(x-2), x, 2)")]
    assert "Fatorando" in titles
    assert "Aplicando a Regra de L'Hôpital (novo limite)" not in titles


def test_degree_comparison_regression() -> None:
    assert _final_expression("limite((3*x**2+1)/(x**2-5), x, oo)") == "3"


# --- Contrato geral -----------------------------------------------------------


def test_every_step_is_pure_text_never_latex() -> None:
    for call in [
        "limite((exp(x)-1-x)/x**2, x, 0)",
        "limite((sin(x)-x)/x**3, x, 0)",
        "limite(x**2/exp(x), x, oo)",
    ]:
        for step in generate_steps(call):
            assert "\\" not in step.expression
            assert "$" not in step.expression
            assert "<" not in step.expression


def test_no_identical_repeated_blocks_for_successive_applications() -> None:
    # Seção 18 do ticket: a segunda aplicação em diante usa um título
    # DIFERENTE ("continua na forma...") da primeira ("Reconhecemos uma
    # forma indeterminada."), nunca repete o bloco idêntico sem contexto.
    titles = [s.title for s in generate_steps("limite((exp(x)-1-x)/x**2, x, 0)")]
    assert titles.count("Reconhecemos uma forma indeterminada.") == 1
