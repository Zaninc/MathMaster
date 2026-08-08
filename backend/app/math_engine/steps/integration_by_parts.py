"""Sprint V2.15 — passo a passo de integração por partes:
`∫u dv = uv - ∫v du`. Camada puramente didática — NUNCA um segundo
resolvedor de integrais: reaproveita `calculus/dispatcher.py:
parse_integral_call` (o mesmo parser da V2.10.1/V2.14) e, principalmente,
`calculus/integrals.py:compute_indefinite_integral` (o MESMO
`sympy.integrate` que o `/solve` já usa) para TODO valor mostrado — a
integral restante `∫v du` é resolvida com uma chamada REAL a esse mesmo
integrador, nunca uma tabela de regras escrita à mão; o resultado final
(com "+ C") vem de uma chamada DIRETA a `compute_indefinite_integral`
sobre a expressão ORIGINAL, garantindo zero divergência do `/solve`.

Escolha de u/dv determinística, inspirada em LIATE (Logarítmica >
Algébrica > Trigonométrica > Exponencial), decidida sobre a ÁRVORE do
SymPy — nunca regex, nunca uma tabela de casos por nome de expressão:
`_classify_factor` reconhece só 4 formas (log(x)/exp(x)/sen(x)/cos(x) com
argumento EXATAMENTE igual à variável — argumento composto já pertence à
V2.14 — e "coeficiente*x^n", reaproveitando `formatting.
classify_polynomial_term`, a MESMA classificação de termo já usada desde
a V2.10). Só os pares "log × algébrico" e "algébrico × trig/exp" são
suportados (os únicos documentados no ticket); qualquer outra combinação
(log × trig, trig × exp, dois fatores algébricos, argumento composto...)
devolve `None` e cai na mensagem amigável genérica de `integrals.py`, sem
nenhum código de rejeição dedicado.

Uma única aplicação por vez: quando o fator algébrico emparelhado com
trig/exp tem expoente >= 2 (ex. `x²·eˣ`), uma aplicação NÃO basta — o
próximo produto `v·du` ainda seria "algébrico(grau-1) × trig/exp", a
MESMA forma. Em vez de fingir resolver ou tentar recursão, o módulo
detecta isso ANTES de gerar qualquer passo e rejeita com uma mensagem
amigável dedicada (mesmo espírito de `lhopital.py`, que também nunca
finge resolver aplicações sucessivas). O par "log × algébrico" nunca
precisa dessa checagem: cada aplicação elimina o próprio log (`d(ln x) =
dx/x`), então `v·du` sempre volta a ser um polinômio puro, resolvido
diretamente pelo motor real independentemente do grau."""
from __future__ import annotations

import re

from sympy import S, cos, diff, exp, expand, log, sin
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..calculus.dispatcher import parse_integral_call
from ..calculus.integrals import compute_indefinite_integral
from ..errors import ExpressionError
from .formatting import INTEGRATION_CONSTANT_EXPLANATION, classify_polynomial_term
from .models import MathStep
from .validation import (
    UNSUPPORTED_INTEGRAL_MESSAGE,
    UNSUPPORTED_INTEGRATION_BY_PARTS_MULTIPLE_APPLICATIONS_MESSAGE,
)

# (u, dv, precisa_de_aplicacoes_sucessivas)
_IbpPlan = tuple[Expr, Expr, bool]

# Mesma convenção/técnica já usada em `u_substitution.py`/`quotient_rule.py`/
# `calculus/dispatcher.py`/`logarithms/dispatcher.py`: qualquer "log(" que
# sobreviver num valor real do SymPy é sempre log NATURAL.
_NATURAL_LOG_PATTERN = re.compile(r"\blog(?=\()")


def _rename_natural_log(text: str) -> str:
    return _NATURAL_LOG_PATTERN.sub("ln", text)


def _is_bare_log(expr: Expr, symbol: Symbol) -> bool:
    return expr.func == log and len(expr.args) == 1 and expr.args[0] == symbol


def _classify_factor(factor: Expr, symbol: Symbol) -> tuple[str, object] | None:
    """`("log"|"exp"|"trig", None)` para `log(x)`/`exp(x)`/`sen(x)`/`cos(x)`
    com argumento EXATAMENTE `symbol` (argumento composto, ex. `exp(x**2)`,
    já pertence à V2.14 e nunca casa aqui), `("poly", expoente)` para
    `coeficiente*x^expoente` (expoente >= 1, mesma forma de
    `classify_polynomial_term`). `None` para qualquer outra forma —
    inclusive constante pura (expoente 0), nunca "chuta"."""
    if _is_bare_log(factor, symbol):
        return "log", None
    if factor.func == exp and len(factor.args) == 1 and factor.args[0] == symbol:
        return "exp", None
    if factor.func in (sin, cos) and len(factor.args) == 1 and factor.args[0] == symbol:
        return "trig", factor.func
    classified = classify_polynomial_term(factor, symbol)
    if classified is not None and classified[1] >= 1:
        return "poly", classified[1]
    return None


def find_integration_by_parts(expr: Expr, symbol: Symbol) -> _IbpPlan | None:
    """`(u, dv, precisa_de_aplicacoes_sucessivas)` se `expr` for uma forma
    imediata de integração por partes (um único fator algébrico
    emparelhado com log/trig/exp, ou `log(x)` sozinho, tratado como
    `1*log(x)`), escolhendo u/dv pela prioridade LIATE. `None` (nunca
    "chuta") para qualquer outra forma — inclusive quando `expr` já é uma
    forma de substituição (V2.14) ou puramente polinomial (V2.10.1),
    porque nenhuma delas tem um fator log/trig/exp de argumento
    NÃO-composto emparelhado com um fator algébrico."""
    coeff, rest = expr.as_independent(symbol, as_Add=False)
    if coeff.has(symbol):
        return None

    if _is_bare_log(rest, symbol):
        return coeff * rest, S.One, False

    if not rest.is_Mul:
        return None
    factors = rest.args
    if len(factors) != 2:
        return None

    classified = [(_classify_factor(factor, symbol), factor) for factor in factors]
    if any(kind is None for kind, _factor in classified):
        return None

    poly_matches = [(detail, factor) for (kind, detail), factor in classified if kind == "poly"]
    other_matches = [(kind, factor) for (kind, detail), factor in classified if kind != "poly"]
    if len(poly_matches) != 1 or len(other_matches) != 1:
        return None

    poly_exponent, poly_factor = poly_matches[0]
    other_kind, other_factor = other_matches[0]

    if other_kind == "log":
        return coeff * other_factor, poly_factor, False
    # trig ou exp: LIATE coloca o fator algébrico antes na escolha de u.
    return coeff * poly_factor, other_factor, poly_exponent >= 2


def is_integration_by_parts_shape(expr: Expr, symbol: Symbol) -> bool:
    return find_integration_by_parts(expr, symbol) is not None


def _dx_text(name: str, value: Expr) -> str:
    return f"{name}=dx" if value == 1 else f"{name}={value}*dx"


def _paren_if_leads_with_minus(value: Expr) -> str:
    """Mesmo espírito de `formatting.paren_if_negative`, mas usando
    `could_extract_minus_sign()` (técnica já usada em
    `formatting.linear_combination_expression`) em vez de `.is_negative`:
    `-cos(x)` não é provavelmente negativo para o SymPy (`.is_negative` é
    `None`, sinal depende de x), mas syntaticamente COMEÇA com um sinal de
    menos — concatenar sem parênteses produziria "x*-cos(x)", ambíguo."""
    return f"({value})" if value.could_extract_minus_sign() else str(value)


def generate_integration_by_parts_steps(text: str) -> list[MathStep]:
    expr, symbol = parse_integral_call(text)
    steps = [
        MathStep(
            title="Integral original",
            expression=_rename_natural_log(f"integral({expr}, {symbol})"),
        )
    ]

    plan = find_integration_by_parts(expr, symbol)
    if plan is None:
        # Nunca deveria acontecer no fluxo normal — `steps/dispatcher.py`
        # só chama esta função quando `find_integration_by_parts` já
        # confirmou a forma. Defesa contra uso indevido direto do módulo.
        raise ExpressionError(UNSUPPORTED_INTEGRAL_MESSAGE)
    u_expr, dv_expr, needs_repetition = plan
    if needs_repetition:
        raise ExpressionError(UNSUPPORTED_INTEGRATION_BY_PARTS_MULTIPLE_APPLICATIONS_MESSAGE)

    dv_text = "dx" if dv_expr == 1 else f"{dv_expr}*dx"
    steps.append(
        MathStep(
            title="Identificando integração por partes",
            expression=_rename_natural_log(f"u={u_expr}, dv={dv_text}"),
        )
    )

    du = diff(u_expr, symbol)
    steps.append(MathStep(title="Derivando u", expression=_rename_natural_log(_dx_text("du", du))))

    v = compute_indefinite_integral(dv_expr, symbol)
    steps.append(MathStep(title="Integrando dv", expression=_rename_natural_log(f"v={v}")))

    steps.append(
        MathStep(title="Aplicando a fórmula", expression="integral(u, v)=u*v-integral(v, u)")
    )

    remaining_integrand = expand(v * du)
    substitution_text = (
        f"integral({expr}, {symbol})="
        f"{u_expr}*{_paren_if_leads_with_minus(v)}-integral({remaining_integrand}, {symbol})"
    )
    steps.append(MathStep(title="Substituindo", expression=_rename_natural_log(substitution_text)))

    remaining_antiderivative = compute_indefinite_integral(remaining_integrand, symbol)
    partial_result = expand(u_expr * v) - remaining_antiderivative
    steps.append(
        MathStep(
            title="Calculando a integral restante",
            expression=_rename_natural_log(str(partial_result)),
        )
    )

    primitive = compute_indefinite_integral(expr, symbol)
    steps.append(
        MathStep(
            title="Adicionando a constante de integração",
            explanation=INTEGRATION_CONSTANT_EXPLANATION,
            expression=_rename_natural_log(f"{primitive} + C"),
        )
    )
    return steps
