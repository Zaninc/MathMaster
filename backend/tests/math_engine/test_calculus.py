"""Sprint 12 — cobre `calculus/`: derivada, integral (indefinida e
definida), limite bilateral, e os casos de rejeição explícita (integral não
avaliada, integral definida divergente, limite oscilante/lados
discordantes). Também cobre a ordem da cascata (cálculo antes de
trigonometria) e a denylist de nomes reservados."""
from __future__ import annotations

import pytest

from app.formatter.pipeline import format_result
from app.formatter.renderer import render_math
from app.math_engine.dispatcher import solve_expression
from app.math_engine.errors import ExpressionError


def _solve(expression: str) -> str:
    raw = solve_expression(expression)
    return render_math(format_result(expression, raw))


def test_derivative_of_polynomial() -> None:
    assert _solve("derivada(x**2+3*x, x)") == "Derivada: 2x + 3"


def test_derivative_of_log_uses_base10_convention() -> None:
    assert _solve("derivada(log(x), x)") == "Derivada: 1/(x*ln(10))"


def test_indefinite_integral_of_polynomial_shows_constant() -> None:
    assert _solve("integral(x**2, x)") == "Integral: x³/3 + C"


def test_indefinite_integral_of_sin() -> None:
    assert _solve("integral(sin(x), x)") == "Integral: -cos(x) + C"


def test_definite_integral() -> None:
    assert _solve("integral(x**2, x, 0, 2)") == "Integral definida: 8/3"


def test_limit_removable_singularity() -> None:
    assert _solve("limite(sin(x)/x, x, 0)") == "Limite: 1"


def test_limit_at_infinity() -> None:
    assert _solve("limite(1/x, x, oo)") == "Limite: 0"


def test_limit_diverging_sides_raises_without_leaking_internal_repr() -> None:
    with pytest.raises(ExpressionError) as exc_info:
        _solve("limite(1/x, x, 0)")
    message = str(exc_info.value)
    assert "não existe" in message
    assert "limites laterais são diferentes" in message
    # Não deve vazar o repr interno dos lados calculados (-oo/oo).
    assert "oo" not in message


def test_limit_oscillating_raises_without_leaking_accumbounds_repr() -> None:
    with pytest.raises(ExpressionError) as exc_info:
        _solve("limite(sin(1/x), x, 0)")
    message = str(exc_info.value)
    assert "não existe" in message
    assert "oscila" in message
    assert "AccumBounds" not in message


def test_indefinite_integral_without_closed_form_raises() -> None:
    with pytest.raises(ExpressionError, match=r"[Nn]ão foi possível calcular"):
        _solve("integral(x**x, x)")


def test_definite_integral_diverges_raises() -> None:
    with pytest.raises(ExpressionError, match=r"diverge"):
        _solve("integral(1/x, x, -1, 1)")


def test_calculus_is_routed_before_trigonometry() -> None:
    # "integral(sin(x), x)" contém "sin(" — se trigonometry fosse checado
    # antes de calculus na cascata, essa chamada seria roubada e nunca
    # chegaria como uma integral.
    assert _solve("integral(sin(x), x)") == "Integral: -cos(x) + C"


def test_derivative_wrong_argument_count_raises() -> None:
    with pytest.raises(ExpressionError, match=r"2 argumentos"):
        _solve("derivada(x**2)")


def test_reserved_calculus_name_is_not_stolen_as_function_definition() -> None:
    with pytest.raises(ExpressionError, match=r"[Nn]ão reconhecido|[Nn]ão foi possível"):
        _solve("derivada(x) = 5")


# --- Sprint 12.1: notação natural de cálculo — paridade com a sintaxe técnica ---


def test_natural_derivative_notation_matches_technical_syntax() -> None:
    assert _solve("d/dx(x**2+3*x)") == _solve("derivada(x**2+3*x, x)")


def test_natural_indefinite_integral_notation_matches_technical_syntax() -> None:
    assert _solve("∫x**2 dx") == _solve("integral(x**2, x)")


def test_natural_integral_of_sin_is_routed_before_trigonometry() -> None:
    # Mesma garantia de test_calculus_is_routed_before_trigonometry, agora
    # também para a entrada em notação natural (∫sin(x)dx contém "sin(").
    assert _solve("∫ sin(x) dx") == "Integral: -cos(x) + C"


def test_natural_definite_integral_ascii_bounds_matches_technical_syntax() -> None:
    assert _solve("∫_0^2 x**2 dx") == _solve("integral(x**2, x, 0, 2)")


def test_natural_definite_integral_unicode_bounds_matches_technical_syntax() -> None:
    assert _solve("∫₀²x**2 dx") == _solve("integral(x**2, x, 0, 2)")


def test_natural_limit_notation_matches_technical_syntax() -> None:
    assert _solve("lim x→0 sin(x)/x") == _solve("limite(sin(x)/x, x, 0)")
    assert _solve("lim(x→0) sin(x)/x") == _solve("limite(sin(x)/x, x, 0)")
    assert _solve("lim_{x→0} sin(x)/x") == _solve("limite(sin(x)/x, x, 0)")


def test_natural_limit_at_infinity_matches_technical_syntax() -> None:
    assert _solve("lim x→∞ 1/x") == _solve("limite(1/x, x, oo)")


def test_one_sided_limit_natural_notation_raises_dedicated_message() -> None:
    with pytest.raises(ExpressionError, match="laterais"):
        _solve("lim x→0+ 1/x")


def test_derivative_without_parentheses_falls_through_to_clean_rejection() -> None:
    # "d/dx x**2" (sem parênteses) não é reconhecido como notação natural
    # (ambíguo — ver auditoria da Sprint 12.1); "dx" sobra como identificador
    # de 2 letras não reconhecido, já rejeitado pelo safe_parsing existente.
    with pytest.raises(ExpressionError, match=r"[Nn]ão reconhecido|[Nn]ão foi possível"):
        _solve("d/dx x**2")


# --- Parâmetros livres (A, a, b, c, k...) tratados como constantes -------
#
# A variável ativa de cada operação já vem nomeada explicitamente na
# sintaxe (`derivada(expr, var)`, `limite(expr, var, ponto)`) — qualquer
# outra letra solta na expressão é um parâmetro, nunca uma segunda
# incógnita. Ver `safe_parsing.extract_safe_symbols`.


def test_power_with_free_base_parameter_stays_symbolic() -> None:
    assert _solve("A^(1/x)") == "A**(1/x)"


def test_derivative_of_quadratic_with_free_coefficients() -> None:
    assert _solve("derivada(a*x^2 + b*x + c, x)") == "Derivada: 2a*x + b"


def test_derivative_of_ax2_matches_expected_coefficient_form() -> None:
    assert _solve("derivada(a*x**2, x)") == "Derivada: 2a*x"


def test_indefinite_integral_with_free_coefficient() -> None:
    assert _solve("integral(k*x, x)") == "Integral: k*x²/2 + C"


def test_indefinite_integral_of_k_sin_x() -> None:
    assert _solve("integral(k*sin(x), x)") == "Integral: -k*cos(x) + C"


def test_limit_at_infinity_of_free_base_to_the_reciprocal_of_x() -> None:
    # lim x->oo A^(1/x): SymPy devolve 1 independente de A ser marcado
    # positive=True, negative=True ou sem assumption nenhuma (verificado
    # empiricamente) — é o resultado matematicamente correto e geral pra
    # qualquer A != 0 (lim_{w->0} z**w == 1 pra qualquer z fixo não-nulo,
    # continuidade da potência complexa fora do ponto de ramificação).
    # A == 0 é o único caso degenerado (0**w -> 0 pra w>0 real), e não é
    # tratado aqui pela mesma razão que o resto do motor não aponta
    # domínio (ex. 1/x não avisa "exceto x=0"): decisão consistente com o
    # padrão já estabelecido no restante do código, não um caso especial
    # novo inventado pra esta expressão.
    assert _solve("lim x->oo A^(1/x)") == "Limite: 1"
    assert _solve("limite(A**(1/x), x, oo)") == "Limite: 1"


def test_limit_natural_notation_with_unicode_infinity_and_caret() -> None:
    assert _solve("lim x→∞ A^(1/x)") == "Limite: 1"


def test_free_parameter_never_shadows_eulers_number() -> None:
    # "E" é o único ponto de sobreposição real: E é constante de Euler
    # (single-letter) E TAMBÉM passaria no critério "uma letra" de
    # extract_safe_symbols se não fosse explicitamente excluído. Confirma
    # que a derivada de E**x continua reconhecendo E como Euler (dá
    # exp(x)), nunca cria um símbolo livre "E" genérico.
    assert _solve("derivada(E**x, x)") == "Derivada: exp(x)"


def test_free_parameter_never_shadows_pi() -> None:
    assert _solve("derivada(pi*x, x)") == "Derivada: π"


def test_caret_power_regression_matches_double_star_syntax() -> None:
    assert _solve("derivada(a*x^2 + b*x + c, x)") == _solve("derivada(a*x**2 + b*x + c, x)")


# --- Segurança: extração de parâmetros livres nunca abre brecha nova ----


@pytest.mark.parametrize(
    "expression",
    [
        "derivada(__import__('os').system('dir'), x)",
        "derivada(os.system(1), x)",
        "derivada(foo.bar, x)",
        "derivada(x__class__, x)",
        "derivada(().__class__.__bases__, x)",
    ],
)
def test_free_symbol_extraction_never_bypasses_security_layers(expression: str) -> None:
    with pytest.raises(ExpressionError):
        _solve(expression)


def test_free_symbol_extraction_rejects_reserved_multiletter_name() -> None:
    # "tau" é um nome reservado conhecido pelo parser (constante de
    # trigonometria) mas fora do vocabulário de cálculo — continua
    # rejeitado como identificador ambíguo, nunca virando parâmetro.
    with pytest.raises(ExpressionError):
        _solve("derivada(tau*x, x)")


def test_free_symbol_extraction_rejects_long_suspicious_identifier() -> None:
    with pytest.raises(ExpressionError):
        _solve("derivada(umidentificadorlongoesuspeitoparadetectar*x, x)")


@pytest.mark.parametrize("known_name", ["sin", "log", "pi", "E", "I", "oo"])
def test_free_symbol_extraction_never_overrides_known_names(known_name: str) -> None:
    # Tentar usar um nome de função/constante conhecida (chamada ou não)
    # nunca faz esse nome virar um parâmetro livre genérico — continua
    # significando a função/constante real do SymPy.
    from app.math_engine.safe_parsing import extract_safe_symbols

    assert known_name not in extract_safe_symbols(f"{known_name}(x) + {known_name}", exclude={"x"})
