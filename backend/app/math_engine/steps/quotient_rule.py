"""Sprint V2.13 — passo a passo de derivadas pela regra do quociente
`(f/g)' = (f'g - fg')/g²`. Camada puramente didática — NUNCA um segundo
motor de derivadas: reaproveita `calculus/dispatcher.py:parse_derivative_
call` (o mesmo parser da V2.10/V2.11) e, principalmente,
`calculus/derivatives.py:compute_derivative` (o MESMO `sympy.diff` que o
`/solve` já usa) para TODO valor final mostrado. Este módulo só decide
COMO apresentar a divisão do quociente em etapas; nunca calcula uma
derivada por conta própria.

Detecção via ÁRVORE do SymPy, nunca regex: `expr.as_numer_denom()` decide
se há um denominador de verdade dependendo da variável — denominador
constante (`x²/5`) continua pela regra da potência/produto/cadeia já
existentes (V2.10/V2.11), nunca passa por aqui.

Reuso automático de potência/cadeia/produto: a derivada do numerador (e
do denominador, pela mesma lógica) usa `advanced_derivatives.factor_
derivative_steps` — a MESMA função já usada pela V2.11 para derivar cada
fator de um produto, agora também capaz de recursar em outro produto
aninhado (`(x+1)*(x²+3)` como numerador de um quociente). Zero código
copiado da V2.10/V2.11: se o numerador for uma composição (`(x²+1)³`),
`factor_derivative_steps` embute os passos da regra da cadeia
automaticamente; se for um produto (`(x+1)*(x²+3)`), embute os passos da
regra do produto; caso contrário, um único passo com o valor real de
`compute_derivative`."""
from __future__ import annotations

import re

from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..calculus.derivatives import compute_derivative
from ..calculus.dispatcher import parse_derivative_call
from ..errors import ExpressionError
from .advanced_derivatives import factor_derivative_steps
from .formatting import wrap_if_sum
from .models import MathStep
from .validation import UNSUPPORTED_DERIVATIVE_MESSAGE

# Mesma convenção/técnica já usada em `calculus/dispatcher.py`/
# `logarithms/dispatcher.py` (duplicada aqui deliberadamente — cada área
# é self-contained, mesmo precedente de `_split_top_level_args`): qualquer
# "log(" que sobreviver num valor real do SymPy É sempre log NATURAL (a
# base 10 deste produto nunca aparece como um nó "log(...)" isolado —
# ver `log_convention.py`), então renomear para "ln(" ao construir a
# string de apresentação é sempre seguro. Necessário aqui porque
# `d/dx(ln(x)/x)` é um caso exigido desta sprint — as sprints anteriores
# (V2.10/V2.11/V2.12) nunca precisaram disso, nenhuma delas usa log/ln.
_NATURAL_LOG_PATTERN = re.compile(r"\blog(?=\()")


def _rename_natural_log(text: str) -> str:
    return _NATURAL_LOG_PATTERN.sub("ln", text)


def is_quotient_shape(expr: Expr, symbol: Symbol) -> tuple[Expr, Expr] | None:
    """`(numerador, denominador)` se `expr` for uma razão de verdade com o
    DENOMINADOR dependendo de `symbol`. `None` (nunca "chuta") quando o
    denominador é 1 ou não depende da variável (`x²/5`, `x²/sin(1)`) —
    esses continuam pela regra da potência/produto/cadeia já existentes,
    tratando o denominador como um coeficiente comum."""
    numer, denom = expr.as_numer_denom()
    if denom == 1 or not denom.has(symbol):
        return None
    return numer, denom


def _mul_text(a: Expr, b: Expr) -> str:
    """"a*b" SEM simplificar, exceto quando um dos dois é exatamente 1 —
    nesse caso o fator unitário nunca aparece explicitamente (mesmo
    espírito de `_coeff_times_symbol` da V2.12.1: coeficiente 1 nunca é
    mostrado por extenso numa string construída à mão)."""
    if a == 1:
        return wrap_if_sum(b)
    if b == 1:
        return wrap_if_sum(a)
    return f"{wrap_if_sum(a)}*{wrap_if_sum(b)}"


def quotient_rule_steps(
    expr: Expr, numer: Expr, denom: Expr, symbol: Symbol
) -> tuple[Expr, list[MathStep]]:
    """Sprint "Derivação Implícita" — promovida de `_quotient_rule_steps`
    (privada) para pública, devolvendo agora `(derivada, passos)` — mesmo
    contrato de `advanced_derivatives.factor_derivative_steps` — para que
    `implicit_differentiation.py` reaproveite a regra do quociente completa
    num TERMO qualquer de uma equação implícita, sem duplicar nada desta
    função. `generate_quotient_rule_steps` abaixo continua o único
    consumidor do `/solve/steps` normal; comportamento dela é 100%
    preservado (só passou a descartar o valor de retorno extra)."""
    steps = [
        MathStep(
            title="Identificando um quociente",
            expression=_rename_natural_log(f"f={numer}, g={denom}"),
        ),
        MathStep(
            title="Aplicando a Regra do Quociente",
            expression=(
                f"derivada(f/g, {symbol})="
                f"(derivada(f, {symbol})*g-f*derivada(g, {symbol}))/g**2"
            ),
        ),
    ]

    f_derivative, f_steps = factor_derivative_steps(
        numer, symbol, "f", trivial_title="Calculando f'"
    )
    steps.extend(f_steps)
    g_derivative, g_steps = factor_derivative_steps(
        denom, symbol, "g", trivial_title="Calculando g'"
    )
    steps.extend(g_steps)

    numerator_text = f"{_mul_text(f_derivative, denom)}-{_mul_text(numer, g_derivative)}"
    # Parênteses SEMPRE ao redor de "g**2" aqui — nunca só quando `denom`
    # é uma soma: "/" e "*" têm a mesma precedência (esquerda->direita),
    # então ".../(x+1)**2*sin(x)**2" (sem parênteses) dividiria só pelo
    # PRIMEIRO fator de "g**2" quando `denom` é um produto (ex. denominador
    # de uma fração aninhada que já virou produto, `(x+1)*sin(x)`) — um
    # erro matemático real, pego empiricamente testando um caso assim
    # antes de escrever este teste.
    substitution = f"({numerator_text})/({denom**2})"
    steps.append(MathStep(title="Substituindo", expression=_rename_natural_log(substitution)))

    total = compute_derivative(expr, symbol)
    steps.append(MathStep(title="Simplificando", expression=_rename_natural_log(str(total))))
    return total, steps


def generate_quotient_rule_steps(text: str) -> list[MathStep]:
    expr, symbol = parse_derivative_call(text)
    steps = [
        MathStep(
            title="Função original",
            expression=_rename_natural_log(f"derivada({expr}, {symbol})"),
        )
    ]

    quotient = is_quotient_shape(expr, symbol)
    if quotient is None:
        # Nunca deveria acontecer no fluxo normal — `steps/dispatcher.py`
        # só chama esta função quando `is_quotient_shape` já confirmou a
        # forma. Defesa contra uso indevido direto deste módulo.
        raise ExpressionError(UNSUPPORTED_DERIVATIVE_MESSAGE)

    numer, denom = quotient
    _, quotient_steps = quotient_rule_steps(expr, numer, denom, symbol)
    steps.extend(quotient_steps)
    return steps
